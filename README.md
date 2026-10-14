# Cookstep

A personal browser recipe library and cooking guide built from PRODUCT_SPEC.md. Recipes and their bundled images sync through ChatGPT Sites D1 and R2 storage, scoped to the signed-in account. IndexedDB keeps local recipe copies and a durable queue for interrupted uploads. Active-session snapshots, cooking progress, timer timestamps and theme preferences stay on each device.

## Run locally

Requires Node 22+.

```sh
npm ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_harsh_big_bertha.sql
node scripts/run-framework.mjs dev --port 4173
```

Open http://127.0.0.1:4173. Sign in using the local sign-in link to test cloud storage. Local D1/R2 data is separate from production. Run the build after changing the vanilla browser code; Vinext serves its generated assets from `public/`.

## Verify

```sh
npm run build
npm test
npm run test:browser
```

The browser tests use an isolated temporary Chrome profile; the default executable is the macOS Google Chrome installation. To use a different installed browser, set `COOKSTEP_BROWSER_PATH` to its executable. The local server must be running for browser tests.

## What is included

- ChatGPT recipe tools: find, read, add and update recipes directly in the synced library; image upload, retained images and revision conflict protection.
- JSON and ZIP package import, version 0.2 validation, full preview and explicit save.
- Individual recipe ZIP export and whole-library ZIP export/import, including bundled images and explicit replacement/copy choices.
- Duplicate-ID replacement or independent copy; existing cooking sessions retain a recipe snapshot.
- Synced recipe library and images, local caching, durable upload retries, conflict copies, synced deletions, grouped ingredients, equipment, source attribution and original text.
- Target yield selection, numeric and range scaling, metric-only storage/display and Celsius temperatures. Recognized legacy measurements convert on ingestion; ambiguous new amounts require clarification.
- Recipe shopping lists with people/yield scaling, size notes, whole-item purchase hints, optional items, remaining-item filtering, copyable lists and device-local saved purchase checks. Open **Shopping list** in a recipe; resume it from the library. Changing amounts or recipe ingredients clears checks.
- Main guide and component tasks with independent progress and optional task suggestions.
- Previous/Next buttons and left/right keyboard arrows browse steps without completing them; completion stays explicit.
- The timer panel collapses when idle and opens automatically when a timer starts.
- Compact cooking header with recipe overview, library, sound, screen status and finish controls in an options menu.
- Fullscreen toggle and an optional continuous view of every cooking step, selected in Cooking options.
- Four switchable themes: Editorial Cookbook, Kitchen Appliance, Cozy Illustrated and Recipe Studio. Open the gear icon → Theme; the preference stays on this device.
- Large per-step ingredient checkboxes with preparation progress saved across views, task switches and reloads.
- User-started countdowns, elapsed tracking, named repeated batches, manual timers and links to originating steps.
- Visual expiry alerts, foreground sound activation, stopped-timer acknowledgement and overdue/elapsed display.
- Responsive phone/tablet/desktop layouts, Screen Wake Lock when available, and interrupted-session recovery from saved timestamps.
- Readable standalone AI guide, contract, downloadable example and copyable prompt. The guide deploys separately from the private app.

## Package constraints

25 MB compressed, 80 MB expanded, 500 ZIP entries, 2 MB manifest, 10 MB per image. Root `recipe.json` is required. Image assets must be actual JPEG, PNG or WebP bytes beneath `images/`. Unsafe paths, duplicates and unresolved references are rejected. Component ID `main` and prototype property names are reserved. See RECIPE_FORMAT.md for format details and the deployed guide for fixed factors and rounding.

## Scope and verification limits

Import once, wait for “Recipes synced across devices”, and open the same private Site while signed into the same account on other devices. Existing recipes on this origin migrate automatically; open the gear icon and use Sync now or Retry sync to refresh. Library syncing runs on launch, reconnection, return to the tab and every minute while visible. Simultaneous replacements preserve a separate copy instead of overwriting another device’s edits.

No recipe extraction, in-app recipe editing, offline-loading guarantee or background/lock-screen notifications. Shopping lists, cooking sessions and timers remain device-local. Changing yield is locked during cooking. Recipe quantities, instruction measurements and temperatures are metric. Scalable quantities and Celsius temperatures use structured fields.

Actual iPad Chrome and Brave screen-awake, foreground sound and storage recovery require device acceptance. Desktop Chromium and responsive viewport tests do not establish iPad browser behavior. The app explicitly reports when screen wake or sound is unavailable. Browser storage can be cleared or evicted; retain original recipe packages for re-import.

## Languages

Open the gear icon → Language on any app page, including while cooking. The language stays on this device; switching while cooking preserves timers, progress, amounts and step position. Recipes store complete English (`en`), Spanish (`es`) and Czech (`cs`) text overlays under the same stable ID. Numeric quantities, unit codes, references, source quotations and images remain shared. ZIP exports and cloud sync retain all three locales. Older imported recipes without translations remain readable in their original language; use ChatGPT to translate them.

The preparation guide, copied add/edit prompts and recipe tools require all locales on every push. Supplied overlays are checked for complete coverage and reject changes to structural/numeric data.

## Themes

`src/themes.js` is the theme registry: semantic color roles, typography, radii, shadows, spacing, color scheme and a layout variant. `src/theme-scales.js` holds the shared scales and food illustration tokens. All interface styling consumes CSS custom properties. Fixed hit-target sizes, responsive breakpoints and illustration geometry are deliberately layout constraints.

Add a `defineTheme(...)` entry to `THEMES`, override only the groups that differ, and run the build. The picker is generated from the registry. Reuse a layout (`editorial`, `appliance`, `illustrated`, `studio`) or add presentation rules in `src/theme-layouts.css` under a new `[data-layout]` selector. Cooking markup and event handlers stay shared.

The build generates `dist/themes.css` and a small early `dist/theme-boot.js` from that same registry, so the saved theme is restored before the first paint. Runtime switches update attributes and browser chrome without re-rendering the app or saving a cooking session. `cookstep.theme` in localStorage is separate from IndexedDB recipe/session data. Unknown preferences fall back to Editorial Cookbook; blocked storage permits a temporary switch and shows that saving failed. The reference typefaces (Playfair Display, Fraunces, Inter and Caveat) are served locally with their OFL licenses under `public/fonts/`, with system fallbacks. Theme switching needs no external font service.

The four compositions are documented in [DESIGN.md](DESIGN.md). Editorial pairs instructions with a large source image; Appliance emphasizes distant readability and copper timer dials; Cozy pairs photos with hand-painted artwork and sage timers; Studio uses a photographic canvas and a thumbnail step rail. Source cooking-sequence images remain fully visible. A fixed navigation dock and a timer strip keep controls reachable on smaller screens.

## Structure

`src/model.js` contains manifest validation, quantities and timestamp timer logic. `src/importer.js` validates and reads ZIP/JSON packages. `src/storage.js` holds IndexedDB transactions. `src/app.js` contains the interface and cooking interaction. `scripts/build.mjs` builds static app output and documentation-only `guide-site/dist/`.

## Edit through ChatGPT

The private Cookstep Site exposes `/mcp` through its Sites-provisioned plugin. Install or connect **Cookstep** from Plugins → Created by you, then select it in ChatGPT. Ask, for example, “Use Cookstep to change the cheese in my quesadilla recipe and save it,” or supply a recipe source and ask to add it. Return to Cookstep and open the gear icon → **Sync now**, or wait for the normal refresh.

Tools: `get_recipe_format`, `list_recipes` (paginated search), `get_recipe`, `import_recipe_image` (direct public HTTPS JPEG/PNG/WebP URL), `upload_recipe_image` (base64 JPEG/PNG/WebP), and `save_recipe`. The format response includes the full preparation guide, not just the schema. The app's add/edit prompts and the public guide reuse the guide's canonical preparation text; direct and ZIP delivery retain the same cooking requirements.

URL import downloads actual image bytes server-side, checks MIME/signature and the 10 MB limit while streaming, allows at most four validated HTTPS redirects and times out after 20 seconds. It uses the Worker's public global fetch without cookies, authorization or private bindings; IP literals, local hostnames, credentials and custom ports are rejected. Returned asset keys are scoped to the signed-in owner and content-addressed, with a matching suggested manifest path. Blocked or unsupported source images produce an actionable error.

Existing edits require the revision returned by `get_recipe`; new recipes use null. Retries keep the same UUID mutation ID. The server validates manifests and checks that each image belongs to the authenticated user. Unchanged image IDs and paths retain their stored assets when omitted. New or changed images must be imported or uploaded first. User identity comes from trusted Sites forwarding, and reads/writes use the same account scope as browser sync. No API key or local server is needed in production.

**Export recipe ZIP** is in the recipe overview; **Export library ZIP** is beside Your recipes. Library archives contain a `library.json` index and numbered recipe folders, each with its original `recipe.json` and `images/`. Import validates the whole archive before preview; accepting it commits recipes and their upload queue together on the device. Export limits match import limits (25 MB compressed, 80 MB expanded, 500 files); export recipes individually when the library exceeds them. ZIPs contain recipe data and images, not cooking progress, timers or account credentials.
