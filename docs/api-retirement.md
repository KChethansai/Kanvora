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

After retirement there are 63 explicit definitions (62 excluding health). Run `npm run routes` from `Backend/` for the current runtime traversal; later approved features may change that count. The disabled public Apple OAuth placeholder is included in the inventory and must not issue a session.

The 12 backend model source files do not prove 12 populated database collections. Standalone Attachment and Label models have no discovered active imports; current card data embeds attachments and labels. Those legacy model files and any stored data are preserved pending a data inventory.

This document records a narrow containment change, not completion of the security or release-verification phases.
