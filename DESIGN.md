# Cookstep theme compositions

Implemented against the four visual references supplied on 2026-10-11.

The purpose is to help someone cook from a tablet: the current action, required quantities, useful images and running timers must stay easy to understand. Parallel meal tasks share cooking state across themes. Theme changes update presentation without replacing the cooking DOM or writing session data.

- Editorial Cookbook: Playfair Display, parchment texture, terracotta controls, a large photograph beside the instructions, tactile ingredient rows and a timer over the photograph when appropriate.
- Kitchen Appliance: Fraunces and Inter, matte black, soft cream, copper timer dials, large instructions and green navigation. Photos are supporting guidance beneath the current action.
- Cozy Illustrated: Fraunces, Inter and Caveat, cream/orange/sage, hand-painted kitchen artwork, botanical details and handwritten notes. The cooking layout pairs its source image, instruction and sage timer.
- Recipe Studio: Fraunces and Inter, white and herb green, a photographic canvas, thumbnail step rail and a photo banner drawn from a saved recipe's cover.

The current timer dial is a view of the existing timestamp-based timer. Suggested timers show Ready to start until the user explicitly starts them. Overdue and stopped states remain distinct. Other-task and other-batch timers remain in the persistent timer panel or timer drawer. The focused navigation dock stays reachable on long steps. The existing scroll-all-steps mode retains per-step completion controls.

Images are supplied by recipe packages, including provenance captions. Missing step images use a text-focused composition. Cooking-sequence photos use contain sizing to preserve every panel; no decorative stock photo is substituted for missing guidance.

## Assets

Reference fonts are bundled in public/fonts/ with their original OFL licenses. The procedural paper texture and botanical SVG are native presentation assets under public/art/. The decorative kitchen illustration is public/art/cozy-kitchen.png. It was created with the built-in image generation tool, inspected, and copied into the project with its transparency preserved.

Final image-generation prompt:

Use case: illustration-story. Asset type: decorative illustration for Cookstep's Cozy Illustrated theme. Create a charming hand-painted watercolor and pencil children's cookbook illustration of a mother and young child cooking together, stirring an orange soup pot on a wooden counter, with a small potted basil plant, onion and wooden spoon. Warm, homemade, welcoming style, soft organic outlines, cream highlights, muted sage green, warm orange and muted blue aprons, clay tones. Compact landscape composition, isolated on a genuinely transparent background, no surrounding kitchen rectangle, no text, letters, UI, logos or watermark. The characters and pot should be clear at 250 pixels wide.

## Validation

13 model/import/theme unit tests and 22 browser tests pass. Browser tests cover imports, scaling, fullscreen, keyboard and step navigation, ingredient checks, parallel tasks, timer expiry and recovery, stable DOM/session state across theme changes, and prominent dial behavior from pending through running, overdue and stopped.

The real quesadilla package was reviewed at 390x844, 768x1024, 1024x768 and 1440x1000, including photo decoding, overflow, controls inside the viewport and source-photo provenance. Library and overview were reviewed on tablet layouts. Local screenshots are under artifacts/themes-review/. Run node scripts/review-themes.mjs /absolute/path/to/recipe.zip for a visual review using an image-bearing meal with the expected main cooking steps.

Physical iPad Chrome/Brave acceptance remains pending; these checks use desktop Chrome at responsive viewport sizes.

