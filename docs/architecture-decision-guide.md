# Wardrobe Architecture Decision Guide

Date: 2026-07-01

This document describes the public app architecture. It is intentionally
provider-neutral and must not contain cloud account ids, hostnames, credential
locations, private network details, or deployment-specific files.

## Current Architecture

Wardrobe is currently a browser-only PWA:

- React + Vite app shell.
- IndexedDB persistence through a small local storage wrapper.
- Service worker for app-shell caching.
- Browser file APIs for local image capture/import.
- ZIP-based weather lookup initiated by the user.
- Deterministic outfit generation in client-side JavaScript.
- JSON export/import for backup or moving data between browsers.

There is no current backend API, user account system, cloud sync, hosted media
storage, payment integration, or AI provider integration.

## Decisions

### D1: Local First Is The Default

Decision: Inventory, settings, daily outfit plans, wear logs, weather cache, and
images are stored on the user's device first.

Rationale:

- Wardrobe capture often happens near a closet, laundry area, or while shopping.
- The core app should stay useful without an account or network connection.
- Clothing photos, locations, and wear history are sensitive personal data.

Implementation notes:

- Use IndexedDB for current local records.
- Keep local export/import available before adding any sync feature.
- Treat browser site-data deletion as deletion of the local wardrobe copy.

### D2: Outfit Generation Is Deterministic

Decision: Outfit recommendations are generated from stored item metadata,
weather, plan type, formality, color harmony, layer compatibility, laundry
state, and wear history.

Rationale:

- The user should be able to understand why an outfit was recommended.
- The app should not depend on image generation or opaque model output.
- Outfit previews should compose known wardrobe items, not synthesize try-on
images.

### D3: Weather Is User-Initiated

Decision: Weather data is fetched only after the user provides a ZIP code and
saves or requests a forecast.

Rationale:

- Location data is sensitive.
- The app can still run with manual/default planning values.
- Cached weather keeps the app responsive between refreshes.

### D4: Starter Data Is Removable

Decision: The app may ship sample wardrobe items for first-run usefulness, but a
user can remove the entire starter wardrobe from Settings.

Rationale:

- Public users need a working demo immediately.
- Real wardrobe data should not be mixed with sample items unless the user wants
that.

### D5: Future Integrations Stay Optional

Decision: Future sync, hosted media backup, accounts, or AI enrichment must be
optional and disabled by default.

Rationale:

- The public app is useful without external services.
- Provider-neutral app code avoids leaking private infrastructure details.
- Optional integrations can evolve without changing the local-first contract.

Future integration work should use generic interfaces and public configuration
templates only. This repository must not contain provider provisioning, runtime
credentials, private hostnames, deployment mutation logs, or environment-specific
resource names.

## Data Boundaries

Current local stores:

- `items`: clothing inventory.
- `settings`: local app and weather preferences.
- `wearLogs`: local wear history.
- `outfitDays`: saved Today outfits and future outfit plans by calendar date.
- `weatherCache`: cached forecast payloads.

Future sync models may mirror these concepts, but the current public app has no
server-side persistence.

## Verification

Before publishing changes:

```bash
npm run verify
```

For UI changes, also run the local UI detector used by the project workflow.
