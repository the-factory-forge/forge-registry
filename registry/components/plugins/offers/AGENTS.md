# Offers

Read the [integration guide](../../../../docs/offers.md) and the [Offers requirement](../../../../openspec/specs/plugins/spec.md#requirement-offers-plugin).

The model owns minor-unit pricing, issued snapshots and directory projections. The creation editor and detail inline draft share line parsing, ordering and table presentation. The detail captures the starting version when staff first change the draft. The editor and detail share address blocks. The host supplies the sender address and the PDF renderer takes the host’s print logo. Issued addresses and stored PDF bytes remain tied to that issuance. The detail and directory share status presentation. The PostgreSQL companion locks the offer before mutation, authorizes against its stored owner and replaces the issued PDF atomically. Keep the PDF bytes off directory queries. Draft changes preserve the issued state until reissue. Delivery verifies the issue token, uses the stored bytes and records acceptance after transport success.

The optional Products and Mailing connectors depend on Offers. Keep their imports out of the base plugin. The showroom uses the Customers preview provider, the Products preview catalog and simulated delivery.

Verify `tests/offers.test.mjs`, `tests/offers.browser.mjs` and `tests/persistence/offers.integration.mjs`. Changes to recipient details also affect the Customers profile section.
