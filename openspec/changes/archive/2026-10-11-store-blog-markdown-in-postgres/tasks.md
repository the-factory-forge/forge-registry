## Implementation

- [x] forge-registry: store Markdown in PostgreSQL and reserve S3 objects for images.
- [x] forge-registry: update storage checks, schema, docs and generated distribution.
- [x] forge-template: document the optional blog storage contract and consumer handoff.
- [x] osthoepathie-seebach: install shared storage and preserve host integration.
- [x] osthoepathie-seebach: add incremental schema and verified image transfer.
- [x] forge-spec: reconcile persistence requirement and architecture decision.
- [x] forge-registry: complete required checks and transfer the isolated task diff.
- [x] osthoepathie-seebach: complete browser and migration verification.
- [x] forge-spec: validate contracts and record consumer adoption/deployment status.

## Verification

- Registry: build, format/lint checks, typecheck, manifest validation and 79 unit
  tests pass; all seven PostgreSQL/MinIO storage checks pass in the original checkout.
  Generated source installs successfully through shadcn into a clean consumer.
- Clinic: `vp check` and 11 unit tests pass; all seven production-build blog browser
  tests pass. The image-transfer test verifies six articles, 18 translations and
  12 image bodies, transaction rollback, mismatched existing objects and safe retries.
- Template: three existing S3 configuration tests pass; no runtime Blogs installation.
- OpenSpec: this change passes strict validation. Repository-wide strict validation
  reports 13 unrelated items with existing long requirements or missing deltas;
  they are outside this storage change. Relative links and `git diff --check` pass.
- The isolated registry diff is transferred and source adoption is recorded.
  Production S3 configuration, migration, cutover and scheduled maintenance remain
  operator deployment steps, not completed or inferred from these local tests.
