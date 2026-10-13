# Cookstep — product spec

Status: first-version product spec. Implemented on 2026-10-10; see README.md and IMPLEMENTATION.md for delivery and verification. Discovery requirements remain below. Actual iPad Chrome/Brave device acceptance is pending.

**Storage scope update — 2026-10-12:** The recipe library and bundled images now sync through the private Cookstep Site to the same signed-in account on computer, iPad and iPhone. This supersedes the local-only library and separate-import requirements below. Existing local recipes migrate automatically; interrupted writes remain in a durable local queue. Synced deletions and concurrent-replacement copies prevent accidental restoration or overwriting. Cooking sessions, progress, timers and theme preferences remain device-local. Household sharing and guaranteed offline loading remain deferred.


**Recipe editing update — 2026-10-12:** Recipes may now be added and updated directly through the private Cookstep ChatGPT plugin. ZIP import/export remains available for individual recipes and the full library with bundled images. Direct updates validate the same format, retain unchanged images, require the revision read before editing, and preserve active-session snapshots. This supersedes the external-correction-only requirements below.

## Product purpose

Store recipes supplied by the user and guide them through cooking with a focused, visual experience that reduces scrolling, repeated screen unlocking, and forgotten cooking times.

## Confirmed needs

- The first version is for the user personally, usable across their devices by importing packages separately on each device.
- Save recipes provided by the user for future cooking.
- Support use in a browser and on phones and tablets, with layouts adapted to each screen size.
- Browser access is sufficient for the first version; installed or native apps are not required.
- Use large touch buttons for cooking controls in the first version.
- Keep the tablet screen awake during active cooking.
- Focus on the current step with an easy way to advance.
- Help track when food goes on the stove and when it should come off.
- Show graphics, illustrations, or preferably step photos when available in the recipe source.
- Import structured recipe data and bundled images prepared by an external AI agent, keeping recipe extraction outside the app.
- Guide a whole meal in one session, with sub-sessions the user can open at will to work on other tasks in parallel.
- Support countdowns and elapsed-time tracking. Every timer is shown on its relevant step and starts only after an explicit user action.
- Display photos and illustrations supplied in the recipe package. The external AI preparer is responsible for providing illustrations when source images are missing.
- Provide a shareable instructions page that tells an AI agent how to prepare the recipe package.
- Store recipes locally on each device; a synced library and sign-in are not required.
- Internet access may be required in the first version; offline operation is not a requirement.
- Sub-sessions open tasks defined in the current meal package; adding a separately saved recipe during cooking is outside the first-version scope.
- The primary cooking device is an iPad using Chrome or Brave.
- Countdown completion requires a prominent visual alert and sound while the app is open. Background or lock-screen alerts are not required.
- Let the user change the recipe's servings or item yield and scale ingredient quantities in the app.
- Allow metric/imperial unit conversion for structured measurements.
- Correct recipes externally through the AI preparer and re-import them; a recipe editor is deferred.

## Core experience

1. Import an AI-prepared recipe package, review its ingredients and instructions, and save it.
2. Before cooking, choose yield and display units, then see the ingredients, equipment, and preparation needed.
3. Start cooking mode: show one step prominently, the ingredient quantities needed for it, and any relevant source image.
4. Start a suggested timer with an explicit action when the corresponding cooking activity begins.
5. When an activity is underway, optionally open a sub-session such as a sauce or side dish. Each sub-session remembers its own progress.
6. Switch between sub-sessions and the main guide at will while all active timers remain visible.
7. Receive a clear alert when a countdown finishes and acknowledge it after checking the food.
8. Finish cooking and leave cooking mode.

The interface should keep both the current instruction and active timers easy to read from a normal cooking distance. A recipe overview should remain accessible for orientation.

## Functional requirements

### Recipe library

- Store the personal recipe library locally in the browser on each device. Import a package separately on every device where it is needed.
- Cross-device recipe or session synchronization, accounts, and household sharing are outside the first-version scope.
- Save a recipe title, ingredients, ordered instructions, source reference, and available step images.
- Preview imported instructions, quantities, timer suggestions, and images. If they need corrections, update the package externally and import it again.
- When an import uses an existing recipe ID, offer to replace the saved recipe or save a separate copy. Do not silently overwrite it.
- Proposed default: an active cooking session keeps a snapshot of the recipe and selected yield. Replacing its saved recipe updates future sessions and leaves the active session stable.
- Yield and unit preferences, step navigation, and timer controls are session interactions rather than editing the underlying recipe.
- Preserve supplied source references and original text, when included in the package, so users can check ambiguous details.

### Serving and yield scaling

- Allow a target serving count or item yield to be chosen before cooking. Scale from the original imported quantities so repeated changes do not compound rounding errors.
- Use the same factor for ingredient totals and quantities used within individual steps.
- Keep quantities separate for each meal component, preserving source-supplied proportions across the meal. Do not infer people served from an item yield.
- Proposed first-version behavior: choose the target before cooking; prevent quantity changes during an active session to avoid changing instructions after ingredients have already been used.
- The AI preparer supplies numeric amounts and units, or numeric ranges where supported by the source, for quantities that can be scaled.
- Preserve qualitative quantities such as “to taste,” and clearly identify quantities that lack enough structured data to scale.
- Do not silently round countable ingredients or pretend that ambiguous alternatives have exact scalable amounts. Display fractions or decimals where appropriate.
- Do not multiply heat settings, temperatures, or timer durations when yield changes. Preserve batch and doneness guidance; greater yield may mean more batches.
- Keep scalable step quantities in structured fields. Step prose should refer to those displayed quantities rather than repeating amounts that would become stale after scaling.

### Unit conversion

- Provide original, metric, and imperial display choices. Apply the selection consistently to ingredient totals and quantities shown in steps.
- Convert structured cooking temperatures when supplied in the package. Preserve qualitative heat settings such as “medium-low.”
- Keep conversions within the same measurement dimension: mass to mass, volume to volume, and temperature to temperature.
- Do not infer grams from cups without ingredient-specific conversion data. This is outside the first-version automatic conversion scope.
- Require an unambiguous source unit for conversion. Cups, fluid ounces, tablespoons, and teaspoons must identify their measurement convention when variants exist.
- Preserve imported values and visibly identify quantities that cannot be converted reliably. Countable ingredients, text-only quantities, and ambiguous alternatives retain their meaning.
- Derive conversions and scaling from original structured values, rounding only for display so repeated toggles do not accumulate errors.
- The import guide must tell the AI preparer how to supply unambiguous units and structured temperatures.

### Recipe import

- The primary entry method is structured recipe data prepared outside the app, including by an AI agent.
- Proposed first-version format: a ZIP containing `recipe.json` and optional local image files. Also accept a standalone JSON file for recipes without images.
- Use one versioned format initially. JSON is proposed; YAML and XML are not required unless a concrete need emerges.
- Define ingredient, step, image, and timer references explicitly so the app can render the data without interpreting prose.
- Validate the package and show a preview before saving. Errors should identify the affected field or missing file.
- Keep extraction from websites, OCR, and AI recipe generation outside the first-version app.
- The proposed package contract is documented in [RECIPE_FORMAT.md](RECIPE_FORMAT.md).

### AI preparation instructions page

- Add a page with clear instructions for an external AI agent to turn the user's sources into an importable recipe or meal package.
- Include a prominent Copy link button so the user can paste the page URL into an AI conversation alongside their sources.
- The guide must be readable without signing in, including by an AI agent's browsing tools. Publish only the guide and examples at this URL.
- Include the current format version, required fields, package layout, image rules, sub-session grouping, timer rules, examples, and a validation checklist.
- Include a copyable preparation prompt and access to the example JSON. The guide and importer must agree on the supported format version.
- Explain how to handle missing methods, ambiguous amounts, and image gaps without misrepresenting source material.
- Draft page content lives in [AI_RECIPE_GUIDE.md](AI_RECIPE_GUIDE.md). The eventual public URL remains to be assigned when the app is built and hosted.

### Screens and layout

- Library: saved recipe/meal cards, import action, and link to the AI preparation guide.
- Import preview: yield, components, ingredients, steps, images, timer suggestions, and actionable validation errors; save or cancel.
- Pre-cooking overview: target yield, display units, ingredient list, equipment, and component overview.
- Cooking: current step and image occupy the main area; required quantities and explicit timer starts are in the step. Large previous/next controls stay easy to reach.
- A persistent timer area shows all active countdowns and elapsed timers. A task switcher shows the main guide and available sub-sessions, including each one's progress.
- On tablet, use available space for step content and the task/timer overview together. On phone, use compact persistent controls that reveal details without losing the current step.
- AI guide: readable instructions, copyable link and prompt, format documentation, and downloadable examples.

### Cooking mode

- Give the current step most of the screen space.
- Provide obvious next and previous controls and progress through the recipe.
- Use large touch buttons to advance, go back, and start timers. Voice control is outside the first-version scope.
- Show quantities needed in the step so the user does not need to scroll back to an ingredient list.
- Keep the screen awake while cooking mode is active; exact behavior depends on the chosen platform.
- Preserve step progress and active timer state if the app is interrupted or reopened.

### Parallel cooking and sub-sessions

- A cooking session belongs to one recipe or meal package and can contain several named sub-sessions, such as beef filling, guacamole, and avocado sauce.
- The recipe package defines available components and their steps. The user opens them when convenient; the app does not force one global sequence.
- Open sub-sessions only for components in the active meal package. Do not add separately saved recipes to an active session in the first version.
- Remember the current step and completion state separately for the main guide and each opened sub-session.
- Starting, leaving, returning to, or finishing a sub-session does not implicitly start or stop any timer.
- Keep a persistent overview of the main guide, sub-session progress, and all active timers. A timer identifies its task and originating step.
- From a timer, allow the user to return directly to its originating step.
- Preserve source prerequisites and completion cues in the instructions. Automatic scheduling and enforcing dependencies remain outside the agreed scope.
- Support repeated cooking batches through separate timer instances without losing another active batch's timer.

### Devices and access

- Browser, phone, and tablet support is required for the first version.
- Adapt recipe browsing and cooking mode to phone, tablet, and desktop browser screen sizes.
- Make cooking controls large enough for touch while also supporting normal browser interaction.
- Verify screen-awake behavior, timer alerts, and interruption recovery on each supported platform.
- Deliver the first version through the browser on desktop, phone, and tablet.
- Internet access may be required. Full offline loading, caching, and operation are outside the first-version requirements.
- Primary cooking acceptance targets are Chrome and Brave on iPad. Verify screen-awake behavior, local storage, sound alerts, and session recovery on those actual browsers.
- Support layouts for other browsers on desktop and phone; the broader tested browser matrix will be chosen during implementation.

### Timing

- Support more than one active timer, each labeled by the food or activity it tracks.
- Read timer suggestions supplied in the structured recipe; the app does not infer durations from instruction text.
- Start timers when the user indicates that cooking has actually started, rather than assuming that opening a step starts the activity.
- Show the timer control directly in the step where its cooking activity is expected.
- Support a countdown with elapsed time since the user's start action, and elapsed-only tracking for activities without a known duration.
- Keep a timer running when the user advances to another step or switches sub-sessions.
- Offer a manual timer for activities without a specified duration.
- Treat a timer alert as a reminder to check the food. Completing the timer does not automatically complete the cooking step.
- Show a prominent visual alert and play a sound for expired countdowns while the app is open. Background and lock-screen notifications are outside the first-version requirements.
- Sound activation and screen-awake behavior require verification on the target iPad browsers during implementation.
- Proposed display after countdown expiry: show time overdue and total elapsed time until the user stops the timer.

### Visual guidance

- Prefer images supplied by the recipe source when they actually correspond to the current step.
- Distinguish step photos from a photo of the finished dish.
- When source photos are missing, the external AI preparer supplies useful illustrations as local files in the package. The app displays these and does not generate images itself.
- An unillustrated step remains usable with text; do not reject an otherwise valid recipe for missing images.
- Do not present an invented image as evidence of what the source recipe looks like.

## Decisions and implementation checks

### Confirmed discovery decisions

1. Audience: the user personally, across their devices.
2. Access: browser on desktop, phone, and tablet; installation is not required.
3. Cooking controls: large touch buttons; voice is not needed for the first version.
4. Recipe entry: structured data with optional bundled images, prepared outside the app. JSON plus ZIP packaging is the current proposal.
5. Meal guidance: one session with sub-sessions opened at will for parallel cooking.
6. Timing: countdown and elapsed-time tracking; controls appear in the relevant step and always require a user start action.
7. Visuals: display supplied photos and illustrations; filling image gaps is the external AI agent's responsibility.
8. AI preparation: a public instructions page with a copyable link and clear import requirements.
9. Storage: local browser library on each device, populated by separate package imports; no sign-in or cross-device synchronization.
10. Connectivity: internet may be required; offline operation is not required initially.
11. Sub-session scope: tasks within the active meal package only.
12. Primary cooking browsers: Chrome and Brave on iPad.
13. Alerts: visual and sound while the app is open; background or lock-screen alerts are not required.
14. Scaling: change servings or item yield in the app and scale ingredient quantities.
15. Units: support metric/imperial display conversion.
16. Editing: external package corrections and re-import; an in-app recipe editor is deferred.

### Implementation checks

- Verify screen-awake support and audio activation on the actual iPad Chrome/Brave versions before treating the tablet experience as complete. This is unverified browser behavior, not a promised capability already demonstrated.
- Verify local persistence and recovery with recipe images and timer timestamps.
- Specify supported conversion units and display rounding, and verify dimensional accuracy and ambiguous-unit handling.
- Formalize the format's validation schema, package limits, and update behavior during implementation.
- Host the AI guide, contract, and example at readable public URLs and verify that an external AI agent can access them.

### Findings from a real source

The supplied Family Lunch Notion page was reviewed against format 0.1. It is a meal shopping list rather than a complete cooking recipe. The case calls for item yield separate from people served, dish components, multiple source references, and reusable batch timers. Format draft 0.2 incorporates those refinements plus elapsed timers and main-guide links to sub-sessions. The historical review is preserved in [the validation report](RECIPE_VALIDATION_FAMILY_LUNCH.md).

## First-version scope

A local recipe library, structured recipe-package import with validation and preview, replacement by re-import, a shareable AI preparation guide, yield scaling, unit conversion, focused cooking mode with optional parallel sub-sessions, screen-awake behavior, user-started countdown and elapsed timers, supplied photos and illustrations, and recovery after an interruption.

The first version is a personal browser app with layouts for desktop, phone, and tablet, large touch controls, and a local library populated separately on each device. Its primary cooking targets are Chrome and Brave on iPad. It can require internet, limits sub-sessions to the current meal package, scales quantities to a selected yield, converts supported units, and uses visual and sound alerts while open.

Deferred: native apps, sign-in and synchronization, household sharing, voice controls, guaranteed offline operation, background/lock-screen notifications, app-side recipe extraction or image generation, adding unrelated saved recipes mid-session, automatic meal scheduling, and a recipe editor.

## Acceptance scenarios

- A saved recipe can be reopened and used for a complete cooking session.
- Importing a package saves it in that device's local library without requiring sign-in or synchronization.
- An externally prepared recipe package imports with the correct step order, ingredient quantities, images, and timer suggestions.
- An invalid recipe package reports an actionable error and does not save a partial recipe.
- During cooking, the user can read a step and its required quantities without returning to the ingredient list.
- Advancing to another step does not stop a running timer.
- Two overlapping timers retain separate labels and alerts.
- While a main-session timer runs, the user can open a sauce sub-session, complete a step, and return to the main guide at the same position.
- All active timers remain visible across sub-sessions, and a timer can take the user back to its originating step.
- Viewing a step, advancing, or switching sub-sessions never starts a timer.
- An elapsed-only timer tracks time from an explicit user start action without requiring a fabricated duration.
- Reusing a timer for a new batch creates a separate instance without resetting another running instance.
- An external AI agent can read the shared guide URL and prepare data that conforms to the documented format.
- After an interruption, the current step and running timers recover correctly.
- A recipe without step photos remains fully usable.
- The screen stays awake during an active cooking session on the chosen supported device.
- On the target iPad browsers, an expired countdown produces the agreed visual and sound alert while the cooking app is open.
- Changing a recipe's yield from its original amount to twice that amount scales both ingredient totals and per-step quantities, preserving qualitative amounts and leaving timer durations unchanged.
- Changing yield repeatedly always derives quantities from the imported base recipe.
- Metric/imperial switching updates ingredient totals and per-step quantities consistently and does not alter the imported recipe or accumulate rounding errors.
- Structured temperatures convert between Celsius and Fahrenheit, while qualitative heat settings remain unchanged.
- Ambiguous units and mass/volume conversions without ingredient-specific data preserve the source amount instead of displaying an invented conversion.
- A corrected package with an existing ID can replace the saved recipe through import without a recipe editor; an active session retains its original snapshot.

## Success criteria to validate

The user can cook a familiar recipe without repeatedly unlocking the screen or scrolling between instructions and ingredients, and can reliably track overlapping timed activities.
