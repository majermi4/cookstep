# Format validation: Family Lunch — Beef Quesadillas (20)

Reviewed on 2026-10-10 against the proposed format 0.1. This is a source-to-format design review, not a test of an implemented importer or a completed cooking package.

## Verdict

The meal can be represented as structured recipe data with bundled images. The Notion page alone is not a complete cooking recipe: it supplies ingredients and source links, but no instructions, timing, or embedded images. It cannot faithfully satisfy the required nonempty `steps` field without additional source material.

The existing format covers individual ingredients, textual quantity ranges, optional images, ordered steps, and fixed timer suggestions. Yield, meal components, multiple sources, and repeatable batch timers need explicit treatment before the format is frozen.

## Sources inspected

- [Notion shopping list](https://www.notion.so/majermi4/Family-Lunch-Beef-Quesadillas-20-3f5f4ab05d7f818887b2da12c7e2332e): read using the connected Notion tool. Includes quesadillas, Pico de Gallo, guacamole, avocado sauce, chips, and optional accompaniments. No image blocks were returned; cover metadata is null.
- [RecipeTin Eats quesadilla recipe](https://www.recipetineats.com/quesadilla/): contains instructions for the selected beef variant, timing, and links labeled as assembly and pan-cooking images. Image retrieval failed during this review, so image files, resolution, and exact step associations remain unverified.
- [RecipeTin Eats avocado sauce](https://www.recipetineats.com/avocado-sauce/comment-page-2/): contains preparation instructions for the sauce. The supplied Notion quantities describe a double batch.

The Notion page does not provide separate recipe links or instructions for Pico de Gallo and guacamole. Their methods require another source or explicit user-provided instructions; an AI preparer must not present inferred methods as extracted source instructions.

## Mapping checks

| Source feature | Format 0.1 result | Implication |
| --- | --- | --- |
| Named ingredients and measured amounts | Pass | Use stable ingredient identifiers and explicit quantities. |
| `400–450 g` corn; approximate or taste-based amounts | Pass for display | `quantity.text` preserves the source; no single numeric value should be invented. |
| `1 lemon OR 2 limes` | Pass for display | Text preserves the alternative. Structured ingredient selection would need an extension. |
| Optional cayenne and accompaniments | Pass for display | Put optionality in `notes`; a machine-readable optional flag would improve the interface. |
| 20 quesadillas | Semantic gap | Required `servings` cannot distinguish item yield from people served. Do not assume 20 people. |
| Shopping quantities rounded upward | Needs review | Purchase amounts are not necessarily the exact amounts to use in cooking. Keep this distinction visible. |
| Separate dishes with overlapping ingredients | Can be flattened, but loses structure | Ingredient identifiers can be prefixed by dish; structured components would preserve grouping and dish progress. Do not merge quantities merely because ingredient names match. |
| More than one source | Weak fit | A single `source` cannot cleanly attribute each dish or step. |
| Cooking instructions in Notion | Missing | Obtain them from the linked sources or user before producing a cooking-ready package. |
| Timed steps in linked recipe | Pass for fixed suggestions | Start each timer at the actual action; retain doneness cues. |
| Repeated pan batches | Interaction gap | Reuse timer templates with separate runtime instances. Batch size depends on the pan; do not infer it from the recipe yield. |
| Visual guidance | Manifest supports it; files unverified | Bundle actual files and associate only images that depict the relevant step. |

## Concrete field examples

These are valid fragments under the existing draft, not a complete import file:

```json
{
  "id": "quesadillas-corn",
  "name": "Corn kernels",
  "quantity": {"text": "400–450 g"},
  "notes": "Frozen or canned and drained; shopping-list range."
}
```

```json
{
  "id": "avocado-sauce-citrus",
  "name": "Lemon or limes",
  "quantity": {"text": "Juice of 1 lemon OR 2 limes"}
}
```

The quesadilla recipe card gives a three-minute timer for each pan side. That maps to separate 180-second timer templates started when each side begins cooking, reused for subsequent batches. Increasing ingredient quantity must not multiply each timer duration. The total session time depends on pan capacity and batch count. [Source](https://www.recipetineats.com/quesadilla/)

## Recommended draft revisions

1. Add `yield: {quantity, unit}` and make people-based `servings` optional. Here the known yield is `{quantity: 20, unit: "quesadillas"}`; people served is unknown.
2. Add optional `components: [{id, title}]` and `componentId` on ingredients and steps. A single recipe package can then describe the whole meal without requiring automatic multi-recipe scheduling.
3. Add `sources: [{id, title, url}]` and source references on steps, recording the Notion shopping list separately from preparation sources.
4. Specify that timer definitions are reusable templates. A session creates a new timer instance per start, with a dish/batch label, and does not overwrite another active instance.
5. Let the preparer supply an actual cooking sequence that respects dependencies, rather than merely copying the page's heading order. Identify user adaptations and inferred guidance explicitly.

These are recommendations, not fields already supported by format 0.1. Meal scheduling, serving-size scaling, and selecting ingredient alternatives remain product decisions.

## Ready-to-import checklist for this meal

- Supply a sourced method for every dish included in the cooking guide.
- Resolve whether rounded shopping amounts are intended cooking amounts.
- Record yield without guessing the number of people served.
- Keep each dish's quantities separate, including shared ingredients.
- Build a cooking sequence with preparation and filling ready before assembly.
- Configure reusable batch timer behavior.
- Retrieve and inspect any images to be bundled, or explicitly ship without images.
- Validate the final manifest and all referenced files once a complete package is prepared.
