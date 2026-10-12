# @vunvault/contracts

Zod schemas, inferred types, the permission map and typed fixtures — the single
contract between `apps/api`, `apps/web` and the three workers.

## Schemas

```ts
import { ScanJob, GateDecisionBody, ROLE_LABELS } from '@vunvault/contracts';

type ScanJob = z.infer<typeof ScanJob>; // every schema exports a matching type
const row = ScanJob.parse(response.data); // validate at the boundary
```

## Fixtures

```ts
import { scanJobs, staffMembers } from '@vunvault/contracts/fixtures/scans';
import { staffMembers, clientProfile } from '@vunvault/contracts/fixtures';
```

Fixtures are typed against the schemas and parsed in `src/contracts-a.test.ts`, so
they cannot drift. Enums come from `@vunvault/db/enum-values` (a pure module): this
package never imports `drizzle-orm`, so it is safe to bundle into the browser.
`src/routes-a.ts` documents every endpoint for the OpenAPI generator; it holds no
handlers.
