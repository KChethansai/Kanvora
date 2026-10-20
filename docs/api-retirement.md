# Legacy API retirement

The GitHub baseline `0bea03a8bc378ffc408bac6ebaf1ff62ec5764ff` contains 72 explicit HTTP method/path definitions (71 excluding `/health`). `docs/api-baseline.json` preserves their original inventory. Explicit HEAD and OPTIONS are excluded from these counts.

The following nine definitions are intentionally no longer mounted. They return 404 for anonymous callers and callers presenting a management-role token:

| Retired definition | Supported replacement |
| --- | --- |
| GET /api/project | GET /projects-api/projects |
| POST /api/project | POST /projects-api/projects |
| PUT /api/project | PUT /projects-api/projects/:id |
| PATCH /api/project/:id | DELETE /projects-api/projects/:id for deletion; PUT …/:id/archive for archive |
| PATCH /api/project | Authorized project invitation through /notifications/invite; no generic membership injection |
| GET /api/task | Scoped list cards or workspace cards |
| POST /api/task | POST /projects-api/lists/:id/cards |
| PUT /api/task | PUT /projects-api/cards/:id |
| PATCH /api/task | DELETE /projects-api/cards/:id for deletion; validated card update for status |

No application frontend consumer of these legacy paths was found. External consumers are not known; they must migrate rather than rely on an insecure compatibility router. Historical unbound tasks are not deleted or silently assigned to another project/list.

After retirement, the Phase 0B workspace role endpoint, the Phase 0C account lifecycle endpoints and private attachment delivery there are 69 explicit definitions (68 excluding health). Run `npm run routes` from `Backend/` for the current runtime traversal; later approved features may change that count. The disabled public Apple OAuth placeholder is included in the inventory and must not issue a session.

Workspace membership changes use the authenticated `PATCH /api/workspaces/:id/members/:userId` endpoint with an exact `{ role }` body. Generic workspace updates accept only `{ name }`; they cannot rewrite the members array.

Session logout is `POST /auth/logout`; the unauthenticated state-changing `GET` variant is retired. Account lifecycle endpoints are `POST /auth/forgot-password`, `POST /auth/reset-password`, `POST /auth/verify-email` and `POST /auth/resend-verification`. Recovery and verification tokens are stored only as SHA-256 hashes, expire, and are single-use.

Card attachments are uploaded as Cloudinary authenticated assets. `GET /projects-api/attachments/:id` rechecks current card access and redirects to a five-minute signed delivery URL. Legacy attachments without a `publicId` retain their stored URL until a deliberate asset migration; their embedded URL is not returned to callers without current card access through the authorized endpoint, though a previously shared public URL remains public.

The 12 backend model source files do not prove 12 populated database collections. Standalone Attachment and Label models have no discovered active imports; current card data embeds attachments and labels. Those legacy model files and any stored data are preserved pending a data inventory.

This document records a narrow containment change, not completion of the security or release-verification phases.
