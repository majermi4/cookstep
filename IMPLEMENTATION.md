# Implementation and acceptance

Implemented 2026-10-10 from PRODUCT_SPEC.md, RECIPE_FORMAT.md and AI_RECIPE_GUIDE.md.

## Verified locally

Build succeeds. Eleven core tests and seven isolated Chromium browser tests pass.

- Field-level schema/type validation; version rejection; duplicate IDs; ingredient, component, source and image references; component step coverage; countdown/elapsed contracts.
- ZIP root manifest, actual image types, missing assets, traversal paths and compressed/expanded resource limits. Invalid imports never write a partial recipe.
- Yield scaling from original values, fractional counts, numeric ranges, qualitative unscaled amounts, exact dimension-specific conversion factors and Celsius/Fahrenheit.
- Library persistence, explicit duplicate-ID replacement and copy, active snapshot isolation.
- Independent main/component ordering and progress; component-only meals; navigation never starts a timer.
- Multiple batch timers and elapsed timers, manual timers, foreground expiry alerts, explicit acknowledgement and originating-step links. Countdown expiry never completes a step.
- IndexedDB recovery after reload with images, task positions and timer timestamps.
- Responsive widths 390, 768, 1024 and 1440 pixels without horizontal overflow. Phone timer drawer remains accessible while reading steps.
- Guide and contract served as readable HTML; copyable preparation prompt; downloadable valid example.

## Remaining device acceptance

Physical iPad Chrome and Brave have not been available for testing. Check screen wake during cooking and after tab visibility changes, device sound with a short countdown, and library/session/image recovery after closing and reopening each browser. Foreground desktop Chromium reports successful Wake Lock and audio activation; this does not confirm their actual behavior on iPad.

## Deliberate behavior

Recipe libraries and images are local to each browser, with no sync or server upload. The active session keeps a snapshot so replacements affect future sessions. Yield and units are chosen before cooking and remain fixed within that session. Times and temperatures do not scale. Missing per-step quantities are never replaced by whole-ingredient totals. Source images and generated illustrations display their provenance.

The app is hosted privately; the public guide is a separate documentation-only Site containing instructions, contract and illustrative example. Private hosting may require the owner's hosting sign-in, while the guide is intended for access without sign-in. The local app itself has no account system.

## ChatGPT recipe editing and ZIP backups — 2026-10-12

Added a stateless Site-hosted MCP endpoint with recipe-format, paginated search, recipe read, image upload and direct save tools. The caller identity supplied by Sites selects the same D1/R2 library as browser sync. Saves share the browser mutation implementation, validate manifests/assets and require an expected revision. Unchanged images survive text edits and active sessions retain their snapshots. Manifest storage keys include the recipe ID to avoid cross-recipe collisions if a caller reuses a mutation UUID.

Added recipe and whole-library ZIP downloads, validated library restore previews, and an atomic local recipe/upload-queue transaction with replacement/copy choices. Added a ChatGPT connection dialog and recipe-specific copyable edit prompts. Unit checks cover ZIP round trips with actual image bytes and corrupt-library rejection; browser checks cover direct saves, retry acknowledgement, image retention, stale-edit rejection, foreign-asset rejection, active-session isolation, ZIP downloads, library copy restore and responsive controls. Physical iPad acceptance remains pending.

## Source photos and shared preparation context — 2026-10-12

Added `import_recipe_image` to fetch discovered public HTTPS JPEG/PNG/WebP URLs directly into the signed-in user's R2 image storage, alongside the existing base64 uploader. Imports validate each redirect, actual image MIME/signature, a streamed 10 MB limit and a 20-second deadline. Private addresses, local names, credentials and custom ports are rejected. Both image tools return a suggested manifest path and share content-addressed storage.

`get_recipe_format` now embeds the complete AI preparation guide with the format and example. Discovery descriptions and the compatibility handshake direct agents to this guide and source-image importing. The guide's canonical preparation paragraph generates both add/edit prompts in the app and direct/ZIP prompts in the public guide, preserving quantity scaling, conversion, parallel components, user-started timers, concise instructions, photos and useful illustrations.

Verified: 22 unit checks, TypeScript, and three affected browser checks pass. A local MCP smoke test imported the original paprikash JPEG (66,833 bytes). Browser checks assert that the returned guide matches the complete source, copied add/edit prompts retain its canonical text, and existing images and active sessions survive recipe edits. Tablet/phone dialog layouts were inspected; actual ChatGPT model adherence still depends on the consuming chat reading the supplied guidance.

## Illustrations for missing step visuals — 2026-10-12

The preparation guide, canonical copyable prompt, format guidance and MCP descriptions now explicitly direct recipe preparers to generate and upload a dedicated illustration for every cooking step without a relevant source image before saving. Generated assets require `kind: "illustration"` and `origin: "ai_generated"`; unavailable or failed generation must be disclosed with the uncovered steps. Existing source photos and the source cover remain intact. This is preparation guidance; the image-optional import contract remains compatible with older recipes.
