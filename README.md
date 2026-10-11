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
- Fullscreen toggle and an optional continuous view of every cooking step, selected in Cooking options.
- Four switchable themes: Editorial Cookbook, Kitchen Appliance, Cozy Illustrated and Recipe Studio. Open Theme in the main navigation or Cooking options; the preference stays on this device.
- Large per-step ingredient checkboxes with preparation progress saved across views, task switches and reloads.
- User-started countdowns, elapsed tracking, named repeated batches, manual timers and links to originating steps.
- Visual expiry alerts, foreground sound activation, stopped-timer acknowledgement and overdue/elapsed display.
- Responsive phone/tablet/desktop layouts, Screen Wake Lock when available, and interrupted-session recovery from saved timestamps.
- Readable standalone AI guide, contract, downloadable example and copyable prompt. The guide deploys separately from the private app.

## Package constraints

25 MB compressed, 80 MB expanded, 500 ZIP entries, 2 MB manifest, 10 MB per image. Root `recipe.json` is required. Image assets must be actual JPEG, PNG or WebP bytes beneath `images/`. Unsafe paths, duplicates and unresolved references are rejected. Component ID `main` and prototype property names are reserved. See RECIPE_FORMAT.md for format details and the deployed guide for fixed factors and rounding.

## Scope and verification limits

No cross-device sync, recipe extraction, in-app recipe editing, offline-loading guarantee or background/lock-screen notifications. Import separately on each device. Changing yield is locked during cooking. Source instruction prose remains unchanged; scalable quantities and convertible temperatures use structured fields.

Actual iPad Chrome and Brave screen-awake, foreground sound and storage recovery require device acceptance. Desktop Chromium and responsive viewport tests do not establish iPad browser behavior. The app explicitly reports when screen wake or sound is unavailable. Browser storage can be cleared or evicted; retain original recipe packages for re-import.

## Themes

`src/themes.js` is the theme registry: semantic color roles, typography, radii, shadows, spacing, color scheme and a layout variant. `src/theme-scales.js` holds the shared scales and food illustration tokens. All interface styling consumes CSS custom properties. Fixed hit-target sizes, responsive breakpoints and illustration geometry are deliberately layout constraints.

Add a `defineTheme(...)` entry to `THEMES`, override only the groups that differ, and run the build. The picker is generated from the registry. Reuse a layout (`editorial`, `appliance`, `illustrated`, `studio`) or add presentation rules in `src/theme-layouts.css` under a new `[data-layout]` selector. Cooking markup and event handlers stay shared.

The build generates `dist/themes.css` and a small early `dist/theme-boot.js` from that same registry, so the saved theme is restored before the first paint. Runtime switches update attributes and browser chrome without re-rendering the app or saving a cooking session. `cookstep.theme` in localStorage is separate from IndexedDB recipe/session data. Unknown preferences fall back to Editorial Cookbook; blocked storage permits a temporary switch and shows that saving failed. The reference typefaces (Playfair Display, Fraunces, Inter and Caveat) are served locally with their OFL licenses under `public/fonts/`, with system fallbacks. Theme switching needs no external font service.

The four compositions are documented in [DESIGN.md](DESIGN.md). Editorial pairs instructions with a large source image; Appliance emphasizes distant readability and copper timer dials; Cozy pairs photos with hand-painted artwork and sage timers; Studio uses a photographic canvas and a thumbnail step rail. Source cooking-sequence images remain fully visible. A fixed navigation dock and a timer strip keep controls reachable on smaller screens.

## Structure

`src/model.js` contains manifest validation, quantities and timestamp timer logic. `src/importer.js` validates and reads ZIP/JSON packages. `src/storage.js` holds IndexedDB transactions. `src/app.js` contains the interface and cooking interaction. `scripts/build.mjs` builds static app output and documentation-only `guide-site/dist/`.
