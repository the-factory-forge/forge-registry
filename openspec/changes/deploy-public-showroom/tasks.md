## 1. Implementation

- [x] 1.1 Compare the template deployment and existing showroom auth boundaries.
- [x] 1.2 Add the Docker image, ignore rules and app-only Compose configuration.
- [x] 1.3 Document Dokploy setup and add a production HTTP smoke check.

## 2. Verification

- [x] 2.1 Run formatting, lint fixes, registry JSON checks, tests and type checks.
- [x] 2.2 Build and run the image without credentials; check production endpoints.
- [x] 2.3 Exercise browser journeys against the production image.
- [x] 2.4 Review the diff and report deployment inputs and unverified checks.

## Verification results

- Docker Compose validation, image build, unprivileged startup and HTTP health
  check passed. The image ran locally without credentials on port 3100.
- The production smoke check passed for SSR, client assets, all 56 generated
  items and the unavailable auth API. A clean shadcn installation of
  `@forge/section-heading` from the container also installed both dependencies.
- All 37 unit tests passed after correcting three pre-existing dependency
  assertions to include `@forge/table-styles`.
- The full browser run passed 49 of 50 checks. The remaining Drive check passed
  on a focused rerun after updating its old hidden-button assertion to check
  the current disabled-button behavior. No application behavior changed.
- Formatting, lint fixes, registry JSON validation, TypeScript, `pnpm check`
  and strict OpenSpec validation passed. Nine existing accessibility lint
  warnings remain in unrelated components.
- The production hostname, DNS, HTTPS and VPS rollout still need configuration
  in Dokploy. Local Docker verification used Linux ARM64; the VPS was not accessed.
