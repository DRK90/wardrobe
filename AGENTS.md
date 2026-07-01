# Wardrobe Agent Notes

This repo is planned as a public application repo. Treat it as public at all
times.

## Hard Boundaries

- Do not commit cloud account ids, database targets, server addresses, storage
  names, credentials, LAN IPs, or environment-specific deployment details.
- Do not add real `.env` files. Use `.env.example` only when implementation
  starts, and keep values empty or obviously fake.
- Do not design mandatory AI dependencies. Future AI providers must be
  configurable, optional, and disabled by default.
- Do not put cloud provisioning, provider policy, infrastructure-as-code, or
  provider registration files in this repo.
- Keep infrastructure contracts, credential bundle names, provider boundaries,
  and mutation ledgers outside this public repo.

## App Direction

- Build as a local-first PWA.
- Store user wardrobe data and images locally first. Future backup/sync work
  must stay optional and disabled by default.
- Treat AI classifications and product enrichment as draft metadata requiring
  user confirmation.
- Keep outfit previews deterministic: compose existing item images in a polished
  layout rather than trying to synthesize clothing on a person.
- Preserve privacy: wardrobe photos, measurements, locations, and wear history
  are sensitive user data.

## Design Context

- Follow [PRODUCT.md](PRODUCT.md) and [DESIGN.md](DESIGN.md) before making UI
  changes.
- Default register is product UI: dense, table-first, inspector-driven, and
  operational.
- Visible UI copy must be customer-facing. Do not show implementation notes,
  storage mechanisms, framework names, sync mechanics, repo boundaries, internal
  host/provider details, or explanatory text that would not appear in a real
  customer app.
- Avoid marketing-page layouts, cream-card dashboards, decorative card grids,
  virtual try-on imagery, and hidden cloud/AI boundaries.

## Expected Verification Once Code Exists

- `npm run verify`.
- Impeccable detector for changed UI files.
- Unit tests for outfit scoring and weather normalization when those areas
  change.
- Browser/PWA tests for offline startup and local inventory edits when those
  workflows change.
- Future sync, AI, and migration work must add focused tests with the feature.
