#!/usr/bin/env bash
#
# Secret-exposure scan over the tracked working tree.
#
# Self-contained by design: bash + `git grep` only. No third-party action,
# service or vendored scanner, so it runs on a stock GitHub runner as-is.
#
# Output contract
#   A finding is reported as "<path>:<line>: <pattern-name>".
#   The matched value is NEVER printed.
#
# Exit codes
#   0  no findings
#   1  at least one finding
#   2  the scan could not run (not a git checkout, bad pattern, ...)
set -uo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)" || exit 2
cd "$repo_root" || exit 2

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "secret-scan: not inside a git work tree" >&2
  exit 2
fi

# --- Paths that must never be scanned -------------------------------------
#   lockfiles     public package checksums, not credentials
#   node_modules  vendored, not authored here
#   dist          build output
#   docs/         prose
#   *.example     intentionally holds placeholder values
# Synthetic values that live in real source files (tests, scripts) are handled
# by the placeholder filter below, so those files stay in scope.
exclude_paths=(
  ':(exclude)**/package-lock.json'
  ':(exclude)**/node_modules/**'
  ':(exclude)**/dist/**'
  ':(exclude)**/coverage/**'
  ':(exclude)docs/**'
  ':(exclude)**/.env.example'
  ':(exclude)**/*.example'
  ':(exclude).secret-allowlist'
)

# --- Detection patterns ----------------------------------------------------
# Three parallel arrays keep each expression intact: the regexes contain "|",
# so packing them into one delimited record would corrupt them.
#
#   pattern_names    label printed with a finding
#   pattern_detects  ERE deciding whether a line is a candidate. Group 1 is
#                    the key/label, group 2 (where present) the secret.
#   pattern_groups   which capture group holds the secret (0 = whole match)
#   pattern_modes    "strict" = the shape alone is conclusive (no placeholder
#                    filter, because a high-entropy token may legitimately
#                    contain words like "example"); "value" = a generic
#                    assignment, so the placeholder filter decides.
#
# Every pattern is passed to git grep with -e so a pattern that begins with
# "-" is never mistaken for an option.
pattern_names=(
  'aws-access-key-id'
  'private-key-header'
  'secret-assignment'
  'secret-assignment-unquoted'
  'jwt'
  'google-api-key'
  'slack-token'
  'slack-webhook'
  'github-token'
  'connection-string-credentials'
)
pattern_detects=(
  '((A3T[A-Z0-9]|AKIA|ASIA|ABIA|ACCA)[A-Z0-9]{16})'
  '(-----BEGIN (RSA |DSA |EC |OPENSSH |PGP )?PRIVATE KEY-----)'
  '(SECRET_KEY|SECRET|PASSWORD|PASSWD|API_KEY|API_SECRET|ACCESS_TOKEN|AUTH_TOKEN|PRIVATE_TOKEN|CLIENT_SECRET|WEBHOOK_SECRET|secretKey|apiKey|password)[[:space:]]*[:=][[:space:]]*["'"'"']([A-Za-z0-9/+_.=~!@#$%^&*()-]{16,})["'"'"']'
  '(SECRET_KEY|SECRET|PASSWORD|PASSWD|API_KEY|API_SECRET|ACCESS_TOKEN|AUTH_TOKEN|PRIVATE_TOKEN|CLIENT_SECRET|WEBHOOK_SECRET)[[:space:]]*[:=][[:space:]]*([A-Za-z0-9/+_-]{16,})'
  '(eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})'
  '(AIza[0-9A-Za-z_-]{35})'
  '(xox[baprs]-[A-Za-z0-9-]{10,})'
  '(https://hooks\.slack\.com/services/[A-Za-z0-9/_-]{20,})'
  '(gh[pousr]_[A-Za-z0-9]{36,})'
  '(mongodb[+]srv|mongodb|postgres[ql]|mysql|redis|amqp)://[^:/@[:space:]]+:([^@/[:space:]]{4,})@'
)
pattern_groups=(
  1
  1
  2
  2
  1
  1
  1
  1
  1
  2
)
pattern_modes=(
  strict
  strict
  value
  value
  strict
  strict
  strict
  strict
  strict
  value
)

# --- Placeholder / non-secret classification -------------------------------
# A candidate is ignored when it is a code reference, filler, a synthetic
# example, or a dictionary placeholder. Everything else is reported.
#
# Synthetic vocabulary: words that mark a value as an intentional example.
synthetic_vocabulary='synthetic|example|placeholder|changeme|change-me|redacted|dummy|fake|mock|notreal|not-real|sample|your[-_]|insert[-_]|replace[-_]|todo|xxxx|test[-_]?only|test[-_]?key|-test-|_test_'

# Dictionary vocabulary: a value that is nothing but a placeholder word (plus
# digits/separators) is an example, not a credential.
dictionary_words='password|passwd|pass|secret|admin|root|user|guest|default|dummy|test|testing|abc123|letmein|changeme|qwerty|123456|placeholder|replace|example'

is_placeholder() {
  local value="$1"

  # A dotted identifier chain (process.env.SECRET_KEY) is a code reference.
  if [[ "$value" =~ ^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)+$ ]]; then
    return 0
  fi

  # A single repeated character is filler.
  local distinct
  distinct="$(printf '%s' "$value" | fold -w1 | sort -u | tr -d '\n')"
  if [ "${#distinct}" -le 1 ]; then
    return 0
  fi

  # Documented synthetic/example vocabulary.
  if printf '%s' "$value" | grep -qiE "$synthetic_vocabulary"; then
    return 0
  fi

  # A value made only of a placeholder word (plus digits/separators).
  local reduced
  reduced="$(printf '%s' "$value" | tr -d '0-9_.-' | tr 'A-Z' 'a-z')"
  if printf '%s' "$reduced" | grep -qxE "$dictionary_words"; then
    return 0
  fi

  return 1
}

# --- Project allowlist -----------------------------------------------------
# The repository already carries a line-oriented allowlist of shapes that are
# public by construction. Reuse it instead of hard-coding a second copy.
allowlist_patterns=()
if [ -f .secret-allowlist ]; then
  while IFS= read -r line; do
    case "$line" in
      ''|'#'*) continue ;;
    esac
    # grep exits 2 on a compile error and 0/1 for a valid expression.
    grep -qE "$line" /dev/null 2>/dev/null
    status=$?
    if [ "$status" -le 1 ]; then
      allowlist_patterns+=("$line")
    else
      echo "secret-scan: skipping invalid allowlist expression" >&2
    fi
  done < .secret-allowlist
fi

is_allowlisted() {
  local text="$1" pattern
  for pattern in ${allowlist_patterns+"${allowlist_patterns[@]}"}; do
    if printf '%s' "$text" | grep -qE "$pattern" 2>/dev/null; then
      return 0
    fi
  done
  return 1
}

# --- Scan ------------------------------------------------------------------
findings=0

pattern_count="${#pattern_names[@]}"
index=0
while [ "$index" -lt "$pattern_count" ]; do
  name="${pattern_names[$index]}"
  detect="${pattern_detects[$index]}"
  group="${pattern_groups[$index]}"
  mode="${pattern_modes[$index]}"
  index=$((index + 1))

  [ -n "$detect" ] || continue

  while IFS= read -r hit; do
    [ -n "$hit" ] || continue
    path="${hit%%:*}"
    remainder="${hit#*:}"
    line_no="${remainder%%:*}"
    text="${remainder#*:}"

    is_allowlisted "$text" && continue

    # Re-match the line to recover the capture group holding the secret.
    [[ "$text" =~ $detect ]] || continue
    if [ "$group" = "0" ]; then
      value="${BASH_REMATCH[0]}"
    else
      value="${BASH_REMATCH[$group]}"
    fi
    [ -n "$value" ] || continue

    # A precise shape is conclusive on its own; only a generic assignment
    # needs the placeholder filter.
    if [ "$mode" = "value" ]; then
      is_placeholder "$value" && continue
    fi

    findings=$((findings + 1))
    # Path, line and pattern name only - never the value.
    printf '%s:%s: %s\n' "$path" "$line_no" "$name"
  done < <(git grep -nI -E -e "$detect" -- "${exclude_paths[@]}" 2>/dev/null || true)
done

scanned_files="$(git ls-files "${exclude_paths[@]}" 2>/dev/null | wc -l | tr -d ' ')"

if [ "$findings" -gt 0 ]; then
  echo "secret-scan: ${findings} potential secret(s) found in ${scanned_files} tracked files"
  exit 1
fi

echo "secret-scan: no credential-shaped strings found in ${scanned_files} tracked files"
exit 0
