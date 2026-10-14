# Cookstep recipe package — proposed format 0.2

Status: implemented format 0.2 contract. The importer validates this format without coercing source data; implementation limits and reserved identifiers are documented in the deployed guide and README.md.

Version 0.2 supersedes 0.1 with item yield, components for parallel sub-sessions, multiple sources, and elapsed timers. The [Family Lunch review](RECIPE_VALIDATION_FAMILY_LUNCH.md) preserves the original findings. A shopping list alone cannot supply the required cooking steps.

## Package

One recipe or meal per ZIP, with this layout:

```text
my-recipe.zip
  recipe.json
  images/
    finished-dish.jpg
    step-02.jpg
```

`recipe.json` must be at the ZIP root. Image names are arbitrary; their paths must match the manifest. A standalone `recipe.json` is also acceptable when the recipe has no images. Images are optional for every step.

Use UTF-8 JSON. Image files must be local to the package; proposed supported formats are JPEG, PNG, and WebP. Use relative paths such as `images/step-02.jpg`, without absolute paths or `..` segments. Source URLs are attribution, not files the app needs to fetch while cooking.

## Recipe data

Required recipe fields:

| Field | Meaning |
| --- | --- |
| `formatVersion` | Exactly `"0.2"` for this draft. |
| `id` | Stable, nonempty recipe identifier chosen by the preparer. |
| `title` | Display name. |
| `yield` | Object with positive numeric `quantity` and nonempty `unit`, e.g. `{ "quantity": 20, "unit": "quesadillas" }`. Use `"servings"` as the unit for known people-based yield. |
| `ingredients` | Array of ingredients, each with a unique `id` and `name`. |
| `steps` | Nonempty array. Array order defines step order within the main guide and each component. |

Optional recipe fields: `description`, `language` (e.g. `en` or `cs`), `servings` (positive number of people served, only when known), `sources`, `components`, `equipment` (array of strings), `images` (array), `coverImageId`, and `notes` (array of strings).

Each entry in `sources` requires unique `id` and `title`, with optional `url`, `author`, and `originalText`. Optional `sourceIds` arrays on steps and ingredients reference those entries. Attribute shopping quantities separately from cooking methods; do not fabricate metadata.

### Components and sub-sessions

Each component requires unique `id` and `title`, with optional `description`. Ingredients and steps reference a component using optional `componentId`.

- Steps without `componentId` form the main guide.
- Steps with the same `componentId` form that sub-session, in their order in the `steps` array.
- Every declared component must have at least one step. A simple recipe can omit components. A meal can have main-guide steps plus sub-sessions, or only sub-sessions and the meal overview.
- A step can include `suggestedComponentIds` to offer useful tasks during a wait. These references never automatically open tasks or start timers.
- The user chooses when to open and switch tasks; the app stores progress separately for each main guide and sub-session.
- Preserve practical prerequisites in the instructions. Automatic scheduling and dependency enforcement are outside this contract.

### Ingredients and amounts

An ingredient has `id`, `name`, optional `quantity`, optional `notes` (string), optional `componentId`, optional `sourceIds`, and optional `optional` (boolean, default false). Quantity is an object with a required display `text` and optional numeric `value` plus `unit`:

```json
{"text": "200 g", "value": 200, "unit": "g"}
```

For an imprecise quantity, use `{"text": "to taste"}`. Include numeric values only when the source supports them. For a numeric range, use `{"text": "400–450 g", "range": {"min": 400, "max": 450}, "unit": "g"}`. `value` and `range` are mutually exclusive; structured numeric amounts require a nonempty `unit`. Values must be positive, and ranges must have positive `min` no greater than `max`.

The app scales `value` or both range endpoints by target yield divided by original yield. It scales ingredient totals and structured step quantities from their imported base amounts. Original `text` is used at the base yield and for qualitative amounts. At other yields, structured amounts determine the displayed scaled quantity; text-only amounts remain unchanged and are identified as unscaled. Do not invent numeric precision for approximate source quantities; retain approximation in ingredient notes.

Preserve alternatives as text when they cannot be represented faithfully as one amount. The app must not imply that ambiguous, text-only alternatives were scaled. Timer durations, temperatures, and heat settings do not scale.

### Unit conversion data

Cookstep stores and displays metric measurements only. Use mass codes `g` and `kg`, volume codes `ml` and `l`, length codes `mm`, `cm` and `m`, and structured temperatures in `C`. Convert every source measurement before preparation, including ingredient totals, ingredientUses, equipment sizes, instruction prose, notes and all EN/ES/CZ translations. Prefer the publisher's original metric values, especially for dry ingredients. There is no measurement preference or system selector.

Use `piece` or an appropriate count label for countable ingredients. Preserve qualitative amounts such as “to taste.” Counts scale without conversion. Resolve source conventions from reliable source information; if a measurement cannot be converted reliably, obtain a clarified metric amount before saving. Do not guess ingredient density.

Legacy packages with explicit known source conventions are converted once during import. Ambiguous measurements are rejected before saving. Conversions preserve dimension and full calculation precision; values round only for display. Stored records, exports, active snapshots and shopping lists contain metric amounts.

### Steps

Each step requires a unique `id`, a short `title`, and an `instruction`. Optional fields:

| Field | Meaning |
| --- | --- |
| `componentId` | Component sub-session containing the step; omitted means main guide. |
| `ingredientUses` | Array of `{ingredientId, quantity?}` references. Include the amount actually used in this step, especially when an ingredient is divided across steps. If omitted, the app must not assume the whole ingredient is used here. |
| `imageIds` | Array of image identifiers relevant to this step. |
| `timers` | Array of explicit timer suggestions, defined below. |
| `completionCue` | Legacy optional field, accepted for compatibility but not displayed. Put an essential doneness cue in `instruction` instead. |
| `temperature` | Optional `{value, unit}` cooking temperature, with numeric `value` and unit `C`, displayed alongside the instruction. |
| `suggestedComponentIds` | Valid component IDs offered as useful tasks during this step. |
| `sourceIds` | Valid source IDs supporting this step. |
| `notes` | Legacy optional step field, accepted but not displayed. Omit it in new packages; put essential prerequisites in `instruction` and unresolved source gaps in recipe-level notes. |

Instructions must be clear and to the point: use one to three short, direct sentences with only essential actions, prerequisites, heat settings, timing and doneness cues. Do not write essays, repeat the ingredient list, explain yield scaling or add commentary. Arrange them in executable cooking order, respecting prerequisites even if source headings appear in a different order. Identify inferred guidance and adaptations explicitly.

Put scalable amounts in `ingredientUses.quantity` and refer to the displayed ingredients in the instruction, instead of repeating literal amounts in prose. The app does not rewrite numbers inside prose. This prevents the instruction from contradicting its scaled ingredient list.

Use Celsius in `temperature` and refer to the displayed setting in prose. Qualitative stove settings remain in prose. Convert any literal temperatures in prose to Celsius as well.

### Timers

Each timer requires an `id` unique across the recipe, a `label`, a `mode`, and a `startLabel` describing the action that starts it. `mode` is `countdown` or `elapsed`. Countdown requires positive integer `durationSeconds`; elapsed mode omits duration.

```json
{
  "id": "simmer-sauce",
  "label": "Sauce simmering",
  "mode": "countdown",
  "durationSeconds": 600,
  "startLabel": "Sauce is simmering"
}
```

Elapsed-only example: `{"id": "meat-cooking", "label": "Meat cooking", "mode": "elapsed", "startLabel": "Meat is in the pan"}`.

The user explicitly starts the timer using its containing step's control. Viewing a step, switching tasks, or advancing does not start it. Timers continue across steps and sub-sessions, and an alert does not mark food or a step complete. Countdowns also expose elapsed time since the user's start action.

Timer definitions are reusable templates. Each user start creates a separate runtime instance with its originating step/component and, where useful, a batch label. Reusing a template must not reset another active instance. Increasing ingredient quantities must not automatically multiply durations.

Only supply an exact duration when supported by the recipe. Preserve ranges and condition-based timing in the instruction; use elapsed mode when no fixed duration is available rather than inventing one. Manual countdown and elapsed timers are also available. Richer range alerts and repeated reminders remain open product decisions.

Cooking-session timestamps and timer state are stored by the app separately from the imported recipe.

### Images

Each image requires `id`, `path`, `alt`, `kind`, and `origin`:

```json
{
  "id": "softened-onion",
  "path": "images/step-02.jpg",
  "alt": "Translucent chopped onion in a frying pan",
  "kind": "photo",
  "origin": "recipe_source",
  "sourceUrl": "https://example.com/recipe"
}
```

- `kind`: `photo` or `illustration`.
- `origin`: `recipe_source`, `user_supplied`, or `ai_generated`.
- `sourceUrl` is optional. Legacy `caption` is accepted but not displayed; omit it in new packages.
- Record generated images with `origin: "ai_generated"` and descriptive `alt` text. Cookstep shows no caption overlays; keep attribution and provenance in metadata. The external AI preparer generates a dedicated illustration for every step without a relevant source image, uploads/bundles its actual bytes and sets `kind: "illustration"` and `origin: "ai_generated"`. If image generation is unavailable or fails, disclose the uncovered steps. The app displays supplied assets and does not itself generate images.
- Missing images do not invalidate a recipe. Referenced files must exist; never substitute nonexistent files or unlabeled placeholders.
- Associate a photo with a step only when it clearly depicts that step. Use `coverImageId` for a finished-dish photo.

## Import behavior

1. Select a JSON file or recipe ZIP.
2. Validate the version, required fields, types, positive yield, unique identifiers, all ingredient/component/source/image references, component step coverage, timer modes and durations, and referenced image files. Standalone JSON must contain no file-backed image entries.
3. Show a recipe preview with steps, images, and timer suggestions.
4. Save only after the user accepts the preview. Report errors without creating a partial recipe.

An existing recipe with the same `id` requires a choice to update it or save a copy; importing must not silently overwrite it. Unsupported versions should explain which format is accepted. Resource limits will be specified during implementation.

Correct source recipe data externally and re-import with the same stable ID. There is no first-version recipe editor. An active cooking session keeps its original recipe snapshot; replacement changes future sessions.

Draft 0.1 files require explicit migration or re-preparation; do not silently reinterpret their `servings` as item yield.

## Instructions for an AI preparer

- Produce a package following this document, keeping the recipe's meaning and quantities faithful to the supplied source.
- Use stable ingredient and step identifiers and valid cross-references.
- Group useful parallel activities as components, with main-guide suggestions where appropriate. Do not force unrelated dishes into one global sequence.
- Put quantities used by each step in `ingredientUses` when known.
- Attach countdown or elapsed timer templates to the steps where activities start, with explicit user start actions; do not invent cooking durations or silently replace ranges with one number.
- Bundle available, relevant source images and generate a dedicated illustration for each uncovered step. Record generated assets as `kind: "illustration"`, `origin: "ai_generated"`. Do not substitute a finished-dish image for a missing step image; disclose any failed or unavailable generation.
- Record unresolved source ambiguity briefly in recipe-level `notes` rather than making an unsupported correction. Omit step notes and image captions.
- Do not include app session state, executable content, or embedded credentials.

See [AI_RECIPE_GUIDE.md](AI_RECIPE_GUIDE.md) for the shareable agent workflow and copyable preparation prompt.

## Minimal example

See [examples/recipe.json](examples/recipe.json) for a complete illustrative recipe with main-guide steps, parallel components, a countdown, and elapsed tracking, without images. To add images, include an `images` array, reference its identifiers from `imageIds` or `coverImageId`, and package the referenced files with the JSON in a ZIP.

## Direct ChatGPT saves and library ZIPs

The Cookstep connection uses the same recipe manifest validation. `get_recipe_format` returns the complete preparation guide as well as this contract and an example. `save_recipe` requires the complete recipe, `expectedRevision` from a prior read (null for creation), and a UUID `mutationId` retained across retries. Referenced images must already exist in the user’s Cookstep storage. Use `import_recipe_image` with a discovered direct public HTTPS image URL to download and store original JPEG/PNG/WebP bytes server-side, or `upload_recipe_image` with actual base64 bytes for supplied/generated files. Both return an asset `key` and `suggestedPath`; use the path in the manifest and the key under the corresponding image ID in `save_recipe.assets`. Source URLs remain attribution; cooking uses the stored assets. Unchanged image IDs and paths may reuse existing assets. Source corrections apply to future sessions.

A whole-library ZIP has a root `library.json`: `{"format":"cookstep-library","version":1,"recipes":["recipes/0/recipe.json","recipes/1/recipe.json"]}`. Each numbered directory contains a normal recipe package with paths relative to that directory. Every manifest and image is validated before any recipe is saved. Recipe IDs and index paths must be unique. Existing IDs require an explicit replacement or copy choice. The same archive size and file-count limits apply.


## Multilingual text overlays

New recipes and edits through ChatGPT must include complete `translations.en`, `translations.es` and `translations.cs` (English, Spanish and Czech; the language selector labels Czech CZ). Legacy manifests without translations remain importable and show their source language with a missing-translation notice. When `translations` is supplied, validation requires all three complete overlays and rejects structural or numeric overrides.

Each overlay mirrors only the display fields of the canonical recipe. Recipe root: `title`, optional `description`, `yield: {unit}`, `equipment`, `notes`. Keep complete arrays for `components`, `ingredients`, `steps`, `sources` and `images` when present. Their entries retain `id` and supply their display strings: component `title`/`description`; ingredient `name`/`notes`/`quantity: {text}`; step `title`/`instruction`/`completionCue`/`notes`, `ingredientUses` and `timers`; source `title`; image `alt`/`caption`. Ingredient uses retain `ingredientId` and an optional `quantity: {text}`; timers retain `id` and translate `label` and `startLabel`. Equipment and note arrays keep the same ordering and length. Include every text field that exists in the base recipe.

The recipe ID is shared and omitted from the overlay root. IDs inside arrays identify the canonical entries and must remain unchanged. Array order follows the canonical manifest; display matches entries by ID so view generation does not alter progress. Keep `language` as the canonical prose language. Do not put numeric amounts/ranges, machine unit codes, temperature values, timer modes/durations, paths, URLs, authors, source quotations or references in overlays. A translated quantity such as `30 ml` shares the canonical `value: 30` and `unit: "ml"` for scaling.

```json
{"translations": {
  "en": {"title":"Tomato sauce", "yield":{"unit":"servings"}, "ingredients":[{"id":"salt","name":"Salt","quantity":{"text":"to taste"}}], "steps":[{"id":"mix","title":"Mix","instruction":"Stir in the salt."}]},
  "es": {"title":"Salsa de tomate", "yield":{"unit":"porciones"}, "ingredients":[{"id":"salt","name":"Sal","quantity":{"text":"al gusto"}}], "steps":[{"id":"mix","title":"Mezclar","instruction":"Incorpora la sal."}]},
  "cs": {"title":"Rajčatová omáčka", "yield":{"unit":"porce"}, "ingredients":[{"id":"salt","name":"Sůl","quantity":{"text":"podle chuti"}}], "steps":[{"id":"mix","title":"Promíchej","instruction":"Vmíchej sůl."}]}
}}
```

This excerpt illustrates overlays; the downloadable example is a complete valid manifest. Push all locales together whenever creating or updating a recipe. Original source text is retained verbatim for attribution.
