# Cookstep

A personal browser recipe library and cooking guide built from PRODUCT_SPEC.md. Recipes, bundled image Blobs, active-session snapshots, task progress and timer timestamps are stored in IndexedDB on each device. No recipe data is uploaded to a server.

## Run locally

Requires Node 22+.

```sh
npm ci
npm run build
npm run dev
```

Open http://127.0.0.1:4173. Rebuild after changing source files. The app is served from `dist/`.

## Verify

```sh
npm run build
npm test
npm run test:browser
```

The browser tests use an isolated temporary Chrome profile; the default executable is the macOS Google Chrome installation. To use a different installed browser, set `COOKSTEP_BROWSER_PATH` to its executable. The local server must be running for browser tests.

## What is included

- JSON and ZIP package import, version 0.2 validation, full preview and explicit save.
- Duplicate-ID replacement or independent copy; existing cooking sessions retain a recipe snapshot.
- Local library and local image persistence, grouped ingredients, equipment, source attribution and original text.
- Target yield selection, numeric and range scaling, original/metric/imperial display and Celsius/Fahrenheit conversion. Ambiguous units and qualitative amounts are identified rather than guessed.
- Main guide and component tasks with independent progress and optional task suggestions.
- Previous/Next buttons and left/right keyboard arrows browse steps without completing them; completion stays explicit.
- The timer panel collapses when idle and opens automatically when a timer starts.
- Compact cooking header with recipe overview, library, sound, screen status and finish controls in an options menu.
- User-started countdowns, elapsed tracking, named repeated batches, manual timers and links to originating steps.
- Visual expiry alerts, foreground sound activation, stopped-timer acknowledgement and overdue/elapsed display.
- Responsive phone/tablet/desktop layouts, Screen Wake Lock when available, and interrupted-session recovery from saved timestamps.
- Readable standalone AI guide, contract, downloadable example and copyable prompt. The guide deploys separately from the private app.

## Package constraints

25 MB compressed, 80 MB expanded, 500 ZIP entries, 2 MB manifest, 10 MB per image. Root `recipe.json` is required. Image assets must be actual JPEG, PNG or WebP bytes beneath `images/`. Unsafe paths, duplicates and unresolved references are rejected. Component ID `main` and prototype property names are reserved. See RECIPE_FORMAT.md for format details and the deployed guide for fixed factors and rounding.

## Scope and verification limits

No cross-device sync, recipe extraction, in-app recipe editing, offline-loading guarantee or background/lock-screen notifications. Import separately on each device. Changing yield is locked during cooking. Source instruction prose remains unchanged; scalable quantities and convertible temperatures use structured fields.

Actual iPad Chrome and Brave screen-awake, foreground sound and storage recovery require device acceptance. Desktop Chromium and responsive viewport tests do not establish iPad browser behavior. The app explicitly reports when screen wake or sound is unavailable. Browser storage can be cleared or evicted; retain original recipe packages for re-import.

## Structure

`src/model.js` contains manifest validation, quantities and timestamp timer logic. `src/importer.js` validates and reads ZIP/JSON packages. `src/storage.js` holds IndexedDB transactions. `src/app.js` contains the interface and cooking interaction. `scripts/build.mjs` builds static app output and documentation-only `guide-site/dist/`.
