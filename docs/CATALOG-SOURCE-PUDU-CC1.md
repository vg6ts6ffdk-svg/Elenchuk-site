# PUDU CC1 catalogue source

The owner supplied an authenticated internal parts source for PUDU CC1. The source URL and credentials are intentionally **not committed** to this repository.

## Integration rule

- Treat the authenticated source as the primary candidate source for CC1 spare-part records.
- Never publish a row only because it exists in the source: SKU/article, part name and PUDU CC1 compatibility must be checked first.
- Imported records enter the catalogue as `draft` until verified.
- Credentials must remain in an authorized browser/session or secret store, never in source code, git history, screenshots, logs or public build artifacts.
- Unknown prices or stock remain `null/unknown`; they are never converted to zero or "in stock".
- Product media is published only when the source provides a usable asset and publication rights are clear.

## Current storefront behaviour

The shop now contains a direct PUDU CC1 equipment filter and explicitly identifies CC1 as the first catalogue being connected. No synthetic CC1 products are created while source extraction is pending.

## Next import step

Inspect the authenticated source structure, map its real fields to the ROSEEN catalogue schema, run the existing dry-run validator, review rejected/ambiguous rows, then commit only verified catalogue records.
