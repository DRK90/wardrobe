# Wardrobe

[![License: CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-blue.svg)](LICENSE)

Wardrobe is a local-first progressive web app for clothing inventory, weather
checks, and deterministic outfit planning.

It runs entirely in the browser today. Items, settings, wear data, images, and
weather cache records are stored on the device in IndexedDB. There are no cloud
sync, hosted backend, AI, or account integrations in the current public app.

## What It Does

- Tracks clothing items with category, brand, size, color, material, condition,
  cost, weather traits, laundry state, and local photos.
- Plans outfits from the items stored on the device.
- Saves and edits plans by calendar date, and backfills worn outfits on earlier
  dates without overwriting newer last-worn history.
- Scores outfit pieces against weather, formality, style, color, layering, and
  recent wear history.
- Organizes wardrobe coverage by formality, garment type, and length with
  configurable canonical taxonomy options.
- Compares actual colors with per-formality target palettes and recommends
  useful colors for wardrobe gaps.
- Fetches weather by ZIP code when a user saves a location.
- Installs as a PWA and can start offline after the app shell has been cached.
- Exports and imports wardrobe data as JSON from Settings.
- Ships with sample wardrobe items so the app is useful on first launch. These
  can be removed at once from Settings.

## Run It Locally

Requires Node 26.4.0 or newer. The repo includes `.nvmrc`.

```bash
nvm use
npm install
npm run dev
```

Then open the local URL printed by Vite, usually:

```text
http://localhost:5175/
```

Run the release check:

```bash
npm run verify
```

Build a production bundle:

```bash
npm run build
```

Preview the production bundle:

```bash
npm run preview
```

Build and run the static container locally:

```bash
docker build -t wardrobe:local .
docker run --rm -p 8080:80 wardrobe:local
```

Then open:

```text
http://localhost:8080/
```

## Local Data

Wardrobe uses browser storage, not a server database:

- `items`: wardrobe inventory records.
- `settings`: local app, weather, taxonomy, target palette, and starter-item
  preferences.
- `wearLogs`: local wear history, including the date worn and the time the
  record was entered.
- `outfitDays`: saved Today outfits and editable outfit plans by calendar date.
- `weatherCache`: cached ZIP forecast responses.

Deleting browser data for the site deletes the local wardrobe copy. Use Settings
to export JSON before clearing site data or moving to another device.

## Current Integration Status

Current:

- Local browser persistence.
- Local PWA install/offline shell.
- ZIP-based weather lookup.
- JSON export/import.

Not implemented yet:

- User accounts.
- Cloud sync or backup.
- Hosted media storage.
- AI classification or enrichment.
- Payment or subscription features.

Future integrations should remain optional and disabled by default. Do not add
provider-specific infrastructure, account identifiers, hostnames, credentials,
private network details, or deployment files to this repository.

## Documentation

- [PRODUCT.md](PRODUCT.md)
- [DESIGN.md](DESIGN.md)
- [docs/index.md](docs/index.md)
- [docs/architecture-decision-guide.md](docs/architecture-decision-guide.md)
- [docs/logical-data-model.md](docs/logical-data-model.md)

## License

Wardrobe is licensed under **Creative Commons Attribution-NonCommercial 4.0
International (CC BY-NC 4.0)**.

You may use, share, and adapt it for non-commercial purposes with attribution.
Commercial use requires permission from the copyright holder.

See [LICENSE](LICENSE) for the full terms.
