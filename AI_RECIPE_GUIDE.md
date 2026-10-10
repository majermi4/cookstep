# Prepare a recipe for Cookstep

The app's shareable instructions page includes **Copy link** and **Copy preparation prompt** controls, the format documentation, and an illustrative example. Public deployment status is recorded in IMPLEMENTATION.md.

## Deliverable

Prepare one cooking-ready recipe or meal from the user's sources. Deliver a ZIP containing UTF-8 `recipe.json` at its root and actual referenced images in `images/`. Without images, a standalone JSON file is acceptable.

Use **Cookstep format 0.2**. Read the [full format contract](RECIPE_FORMAT.md) and [complete example](examples/recipe.json), which will be published alongside this page.

## Workflow

1. Read the user's sources, including linked recipes. Separate shopping lists from cooking methods. If access fails or a method is missing, ask for that material instead of pretending to have extracted it.
2. Preserve quantities, selected variants, and adaptations. Separate item yield from people served and shopping amounts from cooking quantities. Supply source-supported numeric amounts or ranges for in-app yield scaling; record ambiguity in notes.
3. Organize the meal into a main guide and useful component sub-sessions, such as filling, guacamole, and sauce. The user can open them at will while other tasks run.
4. Write focused steps with relevant ingredient quantities, heat settings, and observable completion cues. Respect prerequisites without forcing unrelated dishes into a global sequence.
5. Attach timers to the steps where activities start. Give each an action label such as “Meat is in the pan.” Use a source-supported countdown or elapsed mode when duration is uncertain. The user starts every timer.
6. Prefer genuine source step photos. Where these are missing and a visual helps, supply clearly labeled illustrations and bundle the files. If image preparation is unavailable, disclose the gap and leave the step image-free; never invent file references.
7. Validate the package and return it with any unresolved questions or missing assets.

## Essential data rules

- Required recipe fields: `formatVersion: "0.2"`, `id`, `title`, `yield: {quantity, unit}`, `ingredients`, and nonempty `steps`.
- Optional `servings` describes people served only when known. Twenty quesadillas does not establish twenty servings.
- `sources` entries require `id` and `title`; include available attribution. Use `sourceIds` to identify supporting sources.
- `components` entries require `id` and `title`. Assign steps and ingredients using `componentId`; unassigned steps form the main guide.
- Steps require `id`, `title`, and `instruction`. Add `ingredientUses`, `imageIds`, `timers`, and `completionCue` where useful. Use `suggestedComponentIds` to offer tasks during waits.
- Quantities require display `text`; include numeric `value` and `unit` when known, or numeric `range: {min, max}` plus `unit`. Never include both `value` and `range`. Preserve approximation in notes, optionality, and alternatives. Text-only amounts cannot be scaled automatically.
- Put scalable step amounts in `ingredientUses.quantity`. Avoid repeating those amounts as literal numbers inside instructions, which the app does not rewrite when yield changes.
- Supply unambiguous unit codes from the full contract for metric/imperial conversion. Resolve cup/spoon/fluid-ounce conventions from reliable source information; otherwise preserve the ambiguity and leave the quantity unconverted. Do not infer ingredient density.
- Put convertible cooking temperatures in the step's `temperature: {value, unit}` field, with `C` or `F`, and refer to the displayed setting in prose. Preserve qualitative heat settings.
- Timer templates require `id`, `label`, `mode`, and `startLabel`. Countdown requires positive integer `durationSeconds`; elapsed mode omits it. Separate runtime instances support repeated batches.
- Images require `id`, relative `path`, `alt`, `kind`, and `origin`. Use `ai_generated` for generated visuals; every referenced file must exist.
- Identifiers must be unique within their corresponding recipe-wide namespaces. Every reference must resolve.

## Validation checklist

- JSON parses and follows the full contract.
- Every guided dish has a supplied or sourced method.
- Step quantities correctly account for divided ingredients and do not repeatedly consume the shopping total.
- Scalable amounts are structured numerically; qualitative or ambiguous amounts are not falsely represented as scalable.
- Convertible measurements use unambiguous units, and cooking temperatures use structured fields rather than conflicting literals in prose.
- Every declared component has steps in executable order.
- Timer controls belong to their actual start steps and preserve completion cues.
- Increased yield has not automatically multiplied cooking durations.
- Image associations are correct, files exist, and generated guidance is distinguished from source photos.
- Missing methods and unresolved quantities are disclosed.
- No session progress, running timers, executable content, or credentials appear in the package.

## Copyable preparation prompt

> Prepare my supplied recipe sources as a Cookstep format 0.2 package using this page, its linked contract, and example. Preserve my quantities and adaptations, using structured amounts for yield scaling and unambiguous units for metric/imperial conversion. Organize useful parallel tasks as component sub-sessions and include user-started countdown or elapsed timers on the relevant steps. Prefer source step photos and supply clearly labeled illustrations for missing visuals where useful. Deliver recipe.json and actual referenced images in a ZIP. Validate references and files, and identify missing methods or ambiguities rather than fabricating source details. When correcting an existing recipe, keep its ID stable so I can replace it by re-importing.
