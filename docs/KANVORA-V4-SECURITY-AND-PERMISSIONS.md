# Kanvora V4 — security and permissions

The V4 change set is **frontend only**. The backend tree, both manifests and
the route inventory are byte-identical to the released V3 build
`a08046c33baa9326e097a3bfaee6aff3433466d4`; the route inventory hash is
unchanged (`71f6098b6451139df77900738e56409046a22b68aca81c7f32562425f7ec937e`,
71 definitions / 70 API definitions). No permission rule, status-code
semantics, payload contract, schema or session setting was changed.

---

## 1. The server remains the authority

The V4 change that touches a security-relevant boundary is the reordering of
the board load: the board now emits `join-project` **before** it reads the
board, instead of after. That is the one change that could have opened a
hole, so it was reviewed against the server and then tested.

**The server still decides who may enter a room.** `Backend/socket.js:205-239`
calls `authorized(projectId)` **before** `socket.join(room)`; `authorized`
(`socket.js:174-192`) re-reads the account's `sessionVersion` from the
database, rejects an expired session, and then resolves the project through
`findProject(projectId, userId, 'read')` — the same policy check the HTTP
route uses. A client without access gets `{ok:false}` and no room. The client
is not trusted for anything, including the `user` object it passes, which the
server ignores.

**Evidence from the live run:** an authenticated outsider who opened the
shared board received HTTP **404** and the page "This board is not available";
no card, list or member name appeared in the DOM; the write attempt was
refused with 404; the socket join was refused and the outsider received no
board frame. A workspace VIEWER could read the board and its write was
refused with 404.

**The client-supplied user is ignored.** `Backend/socket.js:204` validates
`join-user` against the authenticated socket identity
(`id === userId`), so a client cannot subscribe to another account's
notification room. The existing integration test
(`Backend/tests/integration/socket-security.test.js:94`) already asserts that
a forged user cannot gain a room.

## 2. The partial card save cannot write a field the server would refuse

The card editor now sends only the fields the user changed. That is a
concurrency fix, and it does not widen what a client may write:

- the server's field allowlist is unchanged and still strict
  (`Backend/APIs/ProjectsAPI.js:95-98`, `strictObject` rejects any unknown
  key), so omitting fields cannot smuggle new ones;
- every submitted assignee is still validated against the project
  (`ProjectsAPI.js:133-136`), so an assignment to a non-member is rejected
  regardless of what the client sends;
- `memberId` is **derived** by the server from the vetted `memberIds` array
  (`normalizeMemberFields`, `ProjectsAPI.js:287-307`), so a client cannot set
  it independently; the client therefore sends `memberIds` only;
- `order` cannot be hijacked through a card write
  (`ProjectsAPI.js:837-840`), and a move target is re-resolved inside the
  transaction (`ProjectsAPI.js:846-848`).

## 3. The failure messages do not leak

The new classifier maps a status code to a **fixed enum** and the interface
renders a **static table** (`Frontend/src/utils/requestError.js`). No server
message, id, title or member data is carried into the interface:

| Cause | Status | What the user is told |
|---|---|---|
| Expired session | 401 | "Your session has expired. Sign in again to continue." |
| Permission | 403 | "You do not have permission to do that." |
| Gone | 404 | "That item is no longer available." |
| Conflict | 409 | "Someone else changed this first. Reload to see the current state." |
| Rate limited | 429 | "Too many requests. Wait a moment and try again." |
| Server | 5xx | "The server could not complete the request. Try again in a moment." |
| No connection | — | "The server could not be reached. Check your connection and try again." |

The board's read-failure badge shows the same static text plus a retry, and
the retry uses a list id the client already holds. A 403 and a 404 are both
answered by the resource layer as "not found" (`resources.js:75,83,93`), so
the client cannot be used as an existence oracle.

## 4. Cross-account state

The notification store keeps a small map of live deliveries so a read in
flight cannot wipe them. It is cleared on every account transition:
`reset()` empties it, and `resetAccountData()` runs on login, logout, profile
changes and any change of the signed-in account
(`Frontend/src/store/authStore.js:29,42,81,91,159`). The live delivery
handler is additionally guarded by the account epoch
(`notificationStore.js`), and the read is guarded by the same epoch before
anything is merged. The independent security review traced every account
transition and found no path that skips the reset.

## 5. A revoked session cannot be kept alive

On a server-initiated disconnect the client does **not** auto-reconnect: it
disconnects locally and revalidates over HTTP with the real session. A
revoked or expired session is refused by the server on that read, and the
server re-checks `sessionVersion` and the token expiry on every socket event
(`Backend/socket.js:181-185`). The revalidation is a bounded number of
requests (one project read, one list read, one card read per list), it does
not re-join a room, and it does not retry. Transport-level drops are
excluded, so an ordinary network flap does not trigger it.

## 6. Static analysis

| Scan | Rulesets | Files | Result |
|---|---|---|---|
| Semgrep OSS | `p/javascript`, `p/security-audit`, `p/secrets`, Trail of Bits | 173 (131 in the JavaScript scope) | 4 scans complete, **no partial, failed or skipped scan**, 0 findings in the three registry rulesets, 8 Trail of Bits findings |
| Merged SARIF | — | — | 10 findings retained |

The 10 retained findings are the same set the V3 release triaged, and **none
of them comes from a V4 file**:

| Finding | Location | Disposition |
|---|---|---|
| `mongodb-insecure-transport` ×4 | `.github/workflows/ci.yml:75,145,147`, `Backend/scripts/routes.mjs:2`, `README.md:176`, `docs/DEPLOYMENT.md:57` | Loopback URIs in CI, a test script and documentation. Transport security is a deployment concern. |
| `port-all-interfaces` | `.github/workflows/ci.yml:131` | The CI service publishes the disposable database port on the hosted runner. |
| `v3-potentially-bad-cors` | `Backend/socket.js:88` | Socket.IO, not Apollo. The origin list is explicit and `allowRequest` rejects anything outside it. |
| `detected-bcrypt-hash` | `Backend/controllers/usercontroller.js:16` | A fixed dummy hash used to equalise the timing of an unknown-account login. Not a credential. |
| `raw-html-format` | `Backend/controllers/workspaceController.js:152` | The interpolated values are escaped by the shared helper before insertion. |

Semgrep Pro and CodeQL were **not** run: Pro requires the proprietary engine
and a login, and CodeQL is not installed. OSS rulesets are not cross-file
analysis, and the scan does not cover ignored or generated files.

The repository secret scan is clean over **266 tracked files**.

## 7. The independent security review

A read-only reviewer with a security lens, working from the actual diff and
the actual backend code, returned **CLEAN** — no confirmed weakening of the
permission model. It specifically confirmed:

1. the early room join cannot admit a user without access, and the client's
   own `user` argument is ignored by the server;
2. the partial save introduces no new write vector, and `memberId` cannot be
   set independently of the vetted array;
3. the failure banner and the classified messages carry no server text, no
   ids and no other member's data, and introduce no existence oracle;
4. the notification retention cannot cross accounts, because the map is
   cleared on every account transition and both the delivery and the read are
   epoch-guarded;
5. the disconnect revalidation cannot keep a revoked session alive and cannot
   amplify server load.

Its one informational note: on a server-initiated disconnect the client does
not clear its local board state, so a **future** code path that reconnected
that socket would revalidate a board the user may have lost. No such path
exists today — the socket is deliberately not reconnected — and any such
path would pass through the same server-side gate.

## 8. Independent review coverage

| Lens | Reviewer | Verdict |
|---|---|---|
| Concurrency and stale-response correctness | independent reviewer | **APPROVE WITH CHANGES** — one MAJOR (a deleted notification could be resurrected) and several MINOR. All were fixed in `26e747f`, with regression tests. |
| Security and permissions | independent reviewer | **CLEAN** — no confirmed weakening. |
| Test coverage and evidence integrity | independent reviewer | 9 of 19 behavioural tests were genuine regression tests; the reviewer **proved** the fail-on-revert property experimentally in a throwaway copy and **named every test that passed either way**. Each of those was rewritten to exercise the behaviour. |

The reviewers were read-only and worked from the real diff; one of them
reverted the baseline files in a scratch copy to measure which tests actually
guard the fixes. The project tree was not modified by the reviews.

The concurrency reviewer's "confusing" findings were also useful: it confirmed
that the three biggest probes — resurrecting a deleted card, an unauthorised
room join, and a revalidation storm — all close safely against the actual
backend code.
