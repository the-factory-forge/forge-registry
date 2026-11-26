# Products

Read the [integration guide](../../../../docs/products.md) and [Products requirement](../../../../openspec/specs/plugins/spec.md#requirement-products-plugin).

- `model.ts` owns product input, ordered pairs, price conversion and host contracts. `lists.tsx` renders host-supplied catalog pages, product details and staff lists and owns the directory deletion dialog through `useRecordDeletion`. `product-form.tsx` keeps the original version with the draft until a save succeeds.
- `product-media.tsx` owns the image fields and public gallery. Images are shared across languages. Store durable references; hosts own uploaded bytes and delivery URLs.
- Product categories belong to Products. `product-categories.tsx` renders the staff manager and selection tree. `model.ts` owns the two-level hierarchy and assignment rules.
- The server companion checks fresh staff authorization. Updates compare and increment the version in one write. Deletion checks the version in the same statement that removes the row. Public list and detail queries select published records and project only catalog fields. `@forge/public-identifier` resolves the nullable slug and UUID in one public route segment.
- Keep host routing, transport, currency, cache invalidation and customer fields in adapters. The showroom’s private mock and public catalog share a provider. The browser entrypoint must stay independent of server imports.

Run `tests/products.test.mjs`, `tests/products.browser.mjs` and `tests/persistence/products.integration.mjs`. The integration test uses the Drive PostgreSQL fixture with its own temporary schema.
