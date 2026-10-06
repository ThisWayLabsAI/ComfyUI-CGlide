# TWL CGlide Customization Roadmap

## Purpose

This document records the planned TWL customizations, the extension surfaces they require, and the upstream files most likely to conflict with a long-lived fork.

It is an internal development document, not part of the proposed upstream issue. The initial upstream request should remain small and reviewable.

## Repository Strategy

The intended branch roles are:

- `main`: an exact mirror of `upstream/main`
- `TWL-ComfyUI-CGlide`: stable TWL customizations based on upstream
- `TWL-ComfyUI-CGlide-Dev`: development, experiments, and internal documentation
- `pr/<topic>`: clean upstream contributions created directly from `upstream/main`

Any upstream pull-request branch should be created from `upstream/main`, never by merging either TWL branch. Selected source commits may be recreated or cherry-picked when they contain no TWL-only files or development documentation.

The preferred final architecture is two installed custom-node packages:

```text
custom_nodes/
├── ComfyUI-CGlide/          # Upstream project, unchanged
└── ComfyUI-CGlide-TWL/      # Optional TWL frontend/backend extensions
```

## Initial Upstream Request

The first request proposes only a lightweight frontend extension seam:

- A versioned `cglide:ui-ready` event
- A corresponding `cglide:ui-destroy` event
- The CGlide component identifier
- The associated ComfyUI node
- The UI root element
- Optional stable `data-cglide-slot` insertion points

The issue-ready proposal is in `CGLIDE_EXTENSION_HOOK_ISSUE.md`.

The first request should not attempt to define a complete plugin framework, project-state API, render automation API, or new Python node contract.

## Use Cases and Required Capabilities

### 1. Prompt chips

Examples:

- Camera angle chips
- Camera movement chips
- Shot vocabulary
- MiniMax prompt fragments
- Frequently used subject, lighting, sound, or dialogue structures

The initial lifecycle event and a semantic UI slot make it possible to place the controls. Reliable prompt editing additionally requires a small public API:

```js
api.getPrompt();
api.setPrompt(text);
api.insertPrompt(text);
```

These methods must update all of the following together:

- Stored clip state
- Visible textarea
- Prompt validation
- Token/tag highlighting
- Project serialization
- Dirty state

An extension should not mutate `ui.state.prompt` or the textarea independently.

### 2. Reference handling during project load

Desired import policies may include:

- `replace`: incoming project references replace existing references
- `preserve`: existing populated references win
- `fill-empty`: incoming references fill only empty slots
- `prompt`: show a choice before completing the import

Reference categories must be explicit:

- First and last keyframes
- Image references
- Video references
- Standalone audio references
- Video soundtrack flags and trim ranges
- `CONTINUE FROM`
- Automation metadata such as look-carry or seam-reference flags

This can remain a frontend extension, but it requires supported access to both the incoming project and current project before replacement occurs. The initial ready/destroy event does not provide that.

A possible future capability is:

```js
api.importProject(projectData, {
  referencePolicy: "preserve",
});
```

An alternative is a dedicated, possibly asynchronous, import-transform registration API. A plain DOM event is not sufficient if CGlide must wait for a user choice before applying the imported project.

### 3. Copy references between clips

Desired operations may include:

- Copy all references from one clip to another
- Copy only selected reference types
- Copy into empty slots only
- Replace the destination references
- Copy to several selected clips

This is frontend/project-state behavior and should not require Python changes. It does require a supported state API so an extension does not manipulate `node.properties.gcast_project` directly.

A possible future capability is:

```js
api.copyReferences(sourceClipId, targetClipId, {
  firstLast: true,
  images: true,
  videos: true,
  audio: true,
  continuation: false,
  policy: "fill-empty",
});
```

Important rules to decide before implementation:

- Use stable clip IDs inside one project.
- Do not assume IDs correspond between separately loaded projects.
- Confirm how clips from different projects are matched: position, name, or manual mapping.
- Do not silently copy `carry`, `seam`, `pick`, or analysis metadata unless requested.
- Warn when source and target use different H3 modes.
- Remap both media tokens such as `@image4` and subject identifiers such as `<Subject 4>` when destination identifiers differ.

MiniMax reference meaning currently lives primarily in the prompt's `subject_definitions` block. A reference package should therefore support section-aware copying instead of treating nearby free-form text as an unstructured prompt fragment.

The copy UI should first select media, then present every detected prompt section with one of these behaviors:

- `related`: copy only entries connected to the selected references
- `whole`: copy the complete section
- `skip`: do not copy the section

Recommended defaults for the current MiniMax prompt structure:

- `subject_definitions`: related entries selected
- `retention_analysis`: related entries selected when present
- `summary`: skipped
- `detailed_description`: skipped
- `overall_soundscape`: skipped
- `non_diegetic_music`: skipped
- Unknown detected sections: shown under advanced options and skipped

Definition-oriented sections may be extracted entry by entry. Scene-oriented sections such as `summary` and `detailed_description` should default to whole-section or skip behavior because partial extraction can change the source scene's meaning.

Dependencies must be closed before applying a copy. For example, a relationship statement mentioning both `@image1` and `@image2` cannot accompany only `@image1` unless the user also copies `@image2` or explicitly omits that statement. Likewise, a `retention_analysis` entry must remain paired with its corresponding `<Subject N>` definition.

The preview must show:

- Source-to-destination media token mapping
- Source-to-destination `<Subject N>` mapping
- Included and omitted definition entries
- Related references required by cross-reference statements
- Destination entries that will be appended or replaced
- Any unresolved or dangling tokens

Section merge policies should include append new entries, replace matching subjects, replace the entire section, and skip. The operation must be atomic: media, prompt sections, identifier remapping, and validation all succeed together or the destination clip remains unchanged.

Parsing and remapping should be deterministic and versioned for the current MiniMax prompt structure. It should preserve original text and section order rather than asking an LLM to rewrite definitions during a copy operation.

#### Camera-direction boundary

Reference identity and reference semantics belong in `subject_definitions`, with corresponding preservation rules in `retention_analysis`. Camera direction is scene and shot intent, not reference metadata:

- Shot-specific angle, framing, lens, movement, and camera behavior belong inside the relevant `[Shot N]` block in `detailed_description`.
- Camera language that intentionally applies to every shot may live in the introductory prose of `detailed_description` before `[Shot 1]`.
- Camera instructions must not be copied with a reference package by default.
- Copying `detailed_description` remains an explicit whole-section opt-in because extracting isolated camera phrases can change shot meaning.
- Future camera chips should insert at the active shot or cursor location. They should not append camera text to `subject_definitions`.

### 4. External prompt-enhancer nodes

H3 Studio currently stores the active clip prompt inside `h3_data` and produces conditioning internally. It has no prompt `STRING` input or output.

Dynamic sockets for every project clip are not recommended. Adding, deleting, or reordering clips would change the graph interface and could invalidate saved links.

A minimal future core change could add one optional active-prompt override:

```python
"prompt_override": ("STRING", {"forceInput": True, "default": ""})
```

This permits:

```text
External prompt generator or enhancer -> H3 Studio prompt_override
```

It does not permit this cycle:

```text
H3 Studio prompt output -> enhancer -> H3 Studio prompt input
```

The cleaner long-term architecture would separate the project/director UI from conditioning construction:

```text
H3 Project/Director -> raw prompt -> enhancer ----+
       |                                        |
       +------------ clip specification -------+-> H3 Conditioning Builder
```

That is a substantial architectural proposal and should be discussed separately from the initial frontend hooks.

### 5. Render All seed hunt / multiple takes

The existing `CSGlideSeed` supports the normal ComfyUI seed modes, but H3 Studio's Render All loop traverses the project only once.

The first useful definition should be whole-project takes:

```text
Take 1: Clip 1 -> Clip 2 -> Clip 3
Take 2: Clip 1 -> Clip 2 -> Clip 3
Take 3: Clip 1 -> Clip 2 -> Clip 3
```

Questions to resolve:

- Fixed, incremented, or randomized seeds per take
- Whether every clip in a take shares a seed policy or changes independently
- Output naming and take subfolders
- Whether separate and chained modes both support takes
- Whether look carry is reset at the start of every take
- How cancellation and resume behave
- Whether completed takes are retained when a later take fails

Render All mutates continuation and carried-reference state while it runs. Every new take must start from the same project snapshot rather than inheriting the mutated state from the preceding take.

This feature needs either a native CGlide implementation or a supported render automation API. The initial lifecycle events cannot call the current `renderAll()` function because it is private to `buildUI()`.

### 6. Script breakdown and coverage planning

The desired workflow accepts a screenplay PDF, organizes it into scenes, locations, characters, props, action, dialogue, and story beats, then proposes editorially distinct coverage for each scene.

Coverage may include:

- Establishing and master shots
- Medium and two-shots
- Over-the-shoulder and reverse over-the-shoulder shots
- Character close-ups and reaction shots
- Inserts, cutaways, transitions, and special-purpose shots

This differs from seed hunting. Coverage planning creates different shot intentions, framing, subjects, and editorial purposes. Seed hunting may later create several visual takes of each planned shot.

The preferred design is a composable TWL pipeline rather than one large node:

```text
TWL Load Screenplay
  -> TWL Break Down Screenplay
  -> TWL Plan Coverage
  -> TWL Build Video Prompts
  -> TWL Export to CGlide
```

The loader should support text-based PDFs first and identify scanned PDFs that require an optional OCR step. The breakdown should produce a neutral, versioned structure with stable scene, location, character, and shot IDs. It must not use CGlide's private project format as its primary data model.

The coverage planner should support presets such as minimal, dialogue, cinematic, action, montage, and custom. Each proposed shot should record its editorial purpose as well as its visual prompt inputs. A human review step should allow users to lock continuity facts, correct parsing, remove redundant coverage, add shots, and regenerate only selected material.

An initial MVP can stop at reviewable shot-plan JSON and prompt output. Direct creation of H3 Studio clips should follow only after a supported project/import API exists, or through one isolated compatibility adapter that can be updated when CGlide's private schema changes.

### 7. Focused prompt editing and display preferences

The prompt-writing experience should gain a set of incremental UI improvements:

- A persistent prompt font-size preference
- A persistent prompt-font preference shared by the native editor and Prompt Workspace, defaulting to H3's own font
- A compact/collapsed settings row so the prompt begins closer to clip navigation and receives more vertical room
- A future full-window Prompt Workspace with a blurred backdrop
- A clip rail for navigating, selecting, and adding clips within that workspace
- Compact access to reference images, video, and audio while writing
- Add, replace, and clear the full native reference-slot capacity from a collapsible, vertically resizable bottom drawer
- A header copy control for sending the active prompt to the clipboard without selecting the editor contents
- Prompt chips and reference-copy actions in the same focused workspace

Font size and layout density are browser/user preferences, not project state. The Canvas card shares its row with Length and Reference Refinement, so the useful compact behavior collapses the entire row rather than hiding only one card.

The Prompt Workspace requires supported prompt and project APIs for listing, switching, adding, and updating clips. It should not simulate clicks against CGlide's private DOM. It should also provide normal modal behavior: focus containment, keyboard navigation, Escape to close, and focus restoration.

## Wishlist Priority

Priority is based on dependencies, usefulness, implementation risk, and expected upstream-conflict cost. It is not a judgment that later items are less valuable.

### Priority 0: Compatibility foundation - complete

- Keep upstream CGlide and private TWL customizations in separate repositories.
- Provide the versioned ready/destroy lifecycle through the TWL compatibility adapter.
- Prefer a native upstream lifecycle seam if the maintainer accepts the proposal.

### Priority 1: Display preference quick wins - complete and user accepted

- Add a persistent prompt font-size control.
- Add a persistent Show/Hide settings control for the Canvas, Length, and Reference Refinement row.
- Keep the preferences out of workflow and project serialization.

These are isolated companion-extension changes with immediate value and no project-state mutation.

### Priority 2: Section-aware reference workflows

Implement in this order:

1. Parse MiniMax prompt sections without rewriting them.
2. Copy selected media plus related `subject_definitions` and optional `retention_analysis` entries.
3. Preview and remap media tokens and `<Subject N>` identifiers atomically.
4. Add project-load policies: replace, preserve, fill-empty, and prompt.

Reference copying is the next requested feature. Its narrow bridge should perform authoritative project-state changes inside CGlide while the selection and preview UI remains in the companion extension.

### Priority 2 follow-up: Clean continuation inputs before rerendering - implemented on Dev

An opt-in **Clear continues** control is available in the project panel's Render row. When enabled, Render clears existing continuation inputs for the clips it is about to queue before the first render starts.

The cleanup belongs in `web/csglide_cast.js`, immediately inside the authoritative `renderAll()` setup, rather than in the companion extension. Render scope, skipped clips, links, `lastOut`, the live clip state, `CONTINUE FROM`, and the automation-owned seam reference are all private to `buildUI()`.

Required behavior:

- Apply to the clips actually queued by the selected Render scope; do not mutate clips outside that queue.
- Clear each queued clip's `state.cont` data.
- Clear video references only when a `seam` or `carry` marker proves a project render created them; preserve every manually selected video reference.
- Preserve clip links. A link describes intended continuity and is not stale generated media.
- Clear `lastOut` on queued clips so the UI and subsequent operations cannot reuse an old result. Preserve a predecessor outside the queue when it is required to begin a mid-chain run.
- Run orphan/preflight validation as though stale `CONTINUE FROM` data is unavailable when cleanup is enabled. A linked mid-chain clip must have its predecessor in the queue or a usable predecessor `lastOut`.
- Take the normal project Revert snapshot before clearing anything.
- If preflight fails or the user declines a warning, change nothing.
- Keep the option off by default initially and explain in its tooltip that linked clips will be repopulated during the run.

This is intentionally narrower than seed hunting. It establishes a clean, repeatable starting state for one Render invocation; multi-take seed policies can build on the same reset boundary later.

### Priority 3: Prompt editing API and prompt chips

- Establish narrow `getPrompt`, `setPrompt`, and `insertPrompt` capabilities. Implemented on the Dev branch as the version 1 `promptEditing` capability.
- Add camera angle and movement chips first. The initial palette includes framing, angle, static, dolly/tracking, pan, crane, and handheld phrases.
- Keep vocabulary deterministic and editable as data in the companion extension; do not make a model call for a chip insertion.
- Insert only at the current cursor or selection. In structured prompts, require that range to be inside `detailed_description`; report whether it is in the introduction or a specific `[Shot N]` block.
- Refuse to guess a target when the cursor is in `subject_definitions`, `summary`, sound, music, or an unknown section. Older unstructured prompts remain cursor-editable.
- Use this small feature to validate that edits update visible UI, stored state, serialization, validation, selection, and dirty state together.

The version 1 boundary is deliberately command-oriented:

```js
const snapshot = api.getPrompt();
api.insertPrompt({
  version: 1,
  expectedRevision: snapshot.revision,
  text: "The camera slowly pushes in.",
  start: snapshot.selectionStart,
  end: snapshot.selectionEnd,
});
```

`getPrompt()` returns an immutable text/selection snapshot and opaque revision. `setPrompt()` and `insertPrompt()` reject stale revisions and route the edit through CGlide's authoritative textarea/state/render/commit path. The capability does not expose mutable clip or project state.

This is the smallest high-value feature and the best proof that the extension architecture is sound.

### Priority 4: Focused Prompt Workspace

- Open prompt editing in a full-window modal with a blurred backdrop. Implemented in the private companion extension.
- Provide clip navigation, inherited Add Clip, and Blank Clip in a side rail through a narrow version 1 `projectNavigation` capability.
- Keep reference images, video, and audio accessible as compact active-clip thumbnails.
- Reuse the supported prompt capability for live edits and camera chips; do not mutate the original textarea or project state from companion code.
- Provide deterministic MiniMax prompt scaffolding for `subject_definitions`, `summary`, `retention_analysis`, `detailed_description`, `overall_soundscape`, and `non_diegetic_music`.
- Include an editable `[Shot 1] at 00:00.000:` starter, and insert only missing sections in canonical order without rewriting existing authored text.
- Advance the shot chip to one higher than the greatest shot number detected in `detailed_description`, while leaving `00:00.000` as an explicit user-edited timestamp placeholder.
- Provide cursor-scoped custom-dialogue and audio-reference-dialogue starters in `detailed_description`. Both use a stable speaker ID and `<d>` block; the audio variant references `@audio1` for voice timbre and delivery without inheriting the reference recording's words.
- Share the persistent 10px-20px prompt font preference with the workspace editor.
- Support checkbox multi-selection (including Shift ranges), batch removal, and block-preserving drag-and-drop reordering.
- Expose rename, enable/disable, link/unlink, resolution, and duration through authoritative project commands rather than direct companion mutations.
- Apply the active clip's resolution and duration to the active clip, selected clips, or all clips.

The workspace now covers focused editing, navigation, clip creation, compact references, camera assistance, and prompt structure reminders. Opening it does not implicitly create a project; the current editor becomes Clip 1 only when Add Clip is used, matching CGlide's existing behavior. Reference copying reuses the existing atomic dialog instead of duplicating its planning and validation inside the workspace.

The first navigation follow-up enriches each rail entry with its first available reference thumbnail and a short prompt summary, adds `Ctrl+PageUp` / `Ctrl+PageDown` switching, and hands **Copy references** to the existing preview-and-apply dialog with the active clip preselected as the destination. Closing that dialog returns to a freshly synchronized workspace rather than forcing the user back through the canvas.

### Priority 5: Script breakdown and coverage-planning MVP

- Load text-based screenplay PDFs.
- Produce a neutral, versioned screenplay breakdown.
- Generate editable coverage plans and model-specific prompts.
- Export reviewable JSON without directly mutating H3 Studio.

This track can begin independently of the CGlide project API. Keeping the MVP neutral makes it testable and reusable while direct integration remains unsettled.

### Priority 6: CGlide shot-plan import

- Convert approved coverage plans into CGlide projects or clips.
- Preserve stable scene, character, location, and shot identities.
- Require an official import/project API or isolate all compatibility code in the adapter.

### Priority 7: Render All seed hunt / multiple takes

- Add whole-project takes with fixed, incremented, or randomized seed policies.
- Snapshot and restore project state so takes cannot contaminate each other.
- Define naming, cancellation, resume, chaining, and output-retention behavior.

This is valuable but touches the private Render All lifecycle and carries greater state-corruption risk than the earlier UI and planning features.

### Priority 8: External prompt-node interoperability

- Explore a stable active-prompt override first.
- Treat bidirectional prompt-node workflows and director/conditioning separation as a distinct architectural proposal.
- Avoid dynamic per-clip graph sockets that change when clips are reordered.

This comes last because it changes the graph contract and likely requires upstream Python/backend cooperation, whereas the earlier work can remain primarily in the companion extension.

## Delivery Checklist

### Foundation

- [x] Keep upstream CGlide and TWL customization code in separate repositories.
- [x] Create and privately back up `ComfyUI-CGlide-TWL`.
- [x] Emit versioned UI ready/destroy lifecycle events from the compatibility adapter.
- [x] Keep CGlide selectors and compatibility anchors isolated in the adapter.
- [ ] Replace the fallback lifecycle with native upstream hooks if the maintainer accepts the proposal.

### Milestone 1: Display preference quick wins

- [x] Document prompt font sizing, compact settings, and the Prompt Workspace direction.
- [x] Add prompt font controls with a bounded 10px-20px range.
- [x] Keep the textarea and highlighted prompt presentation at the same font size.
- [x] Add a Show/Hide settings control for the full Canvas/Length/Reference Refinement row.
- [x] Apply changes to all live H3 Studio nodes.
- [x] Persist both preferences in browser local storage, not project data.
- [x] Complete automated live-browser interaction, cross-node, lifecycle, persistence, and accessibility validation.
- [x] Complete user visual evaluation in normal ComfyUI workflows; current implementation accepted.

### Milestone 2: Section-aware reference workflows

- [x] Parse the current MiniMax prompt into ordered, lossless sections.
- [x] Detect `subject_definitions`, `retention_analysis`, scene sections, and unknown sections.
- [x] Define a reference package containing selected media, definitions, source tokens, and subject identifiers.
- [x] Default to related `subject_definitions` and `retention_analysis`; leave scene-specific sections unchecked.
- [x] Resolve cross-reference dependencies and refuse application when destination media tokens remain unresolved.
- [x] Remap `@imageN`, video/audio tokens, and `<Subject N>` identifiers collision-safely.
- [x] Preview token mappings, dependency-added references, copied sections, subject mappings, unresolved tokens, and the resulting prompt.
- [x] Show compact image/video thumbnails and an audio marker beside selectable source references.
- [x] Apply the entire copy atomically through a narrow authoritative CGlide capability with stale-preview protection and a Revert snapshot.
- [x] Validate dependency closure and camera-section exclusion with deterministic model tests.
- [x] Validate preview, apply, stale-preview rejection, active-state persistence, Revert backup, modal focus restoration, lifecycle cleanup, and zero scoped accessibility violations in live ComfyUI.
- [ ] Add replace-matching-subject merge behavior; the first implementation supports append or whole-section replacement.
- [ ] Add multi-destination copying after single-destination semantics receive user evaluation.
- [ ] Add project-load policies only after copy and merge semantics are proven.

### Milestone 2A: Clean continuation reruns - ready for user evaluation

- [x] Add an opt-in Clear continues control beside the Render controls, off by default.
- [x] Make preflight ignore existing continuation media when cleanup is enabled.
- [x] Reuse one authoritative paired cleanup for `cont` and seam-marked video references.
- [x] Clear queued clips' `cont`, automation-marked seam/look references, and stale `lastOut`; preserve links, manual references, clips outside the queue, and skipped clips.
- [x] Take one Revert snapshot before cleanup and make no changes when preflight is abandoned.
- [x] Validate whole-project, chain, and single-clip scopes in an isolated live browser fixture.
- [ ] Validate the from-here scope in a normal project.
- [x] Validate linked and unlinked clips, a rejected mid-chain start, and skipped clips.
- [ ] Validate stop/resume and a render that fails after cleanup; Revert remains the documented recovery path.
- [x] Confirm project data contains rebuilt continuation and seam state after a successful linked run.
- [x] Audit the Render controls with zero scoped accessibility violations; transformed-canvas overlap leaves contrast checks incomplete.

### Milestone 3: Safe prompt assistance

- [x] Define a version 1 `getPrompt`, `setPrompt`, and `insertPrompt` capability with stale-edit protection.
- [x] Add the first camera framing, angle, and movement chip palette in the companion extension.
- [x] Keep structured camera insertion inside `detailed_description` and identify the active `[Shot N]` from the cursor.
- [x] Cover section boundaries, shot targeting, unstructured prompts, and insertion whitespace with deterministic model tests.
- [x] Verify in live ComfyUI that updates keep state, textarea, highlighting, validation, serialization, selection, and dirty state synchronized.
- [x] Verify stale-revision rejection, refusal outside `detailed_description`, Shot 2 targeting, and zero scoped Camera-palette accessibility violations in an isolated browser fixture.
- [ ] Expand model-oriented vocabulary after the first camera-chip set receives user evaluation.

### Milestone 4: Focused Prompt Workspace

- [x] Build the modal shell, blurred backdrop, focus containment, Escape behavior, and focus restoration.
- [x] Add the clip rail, authoritative clip switching, inherited Add Clip, and Blank Clip.
- [x] Add compact image/video/audio reference access for the active clip.
- [x] Expose all nine image, three video, and three audio slots (or First/Last), including empty add targets, in a collapsible and vertically resizable bottom drawer.
- [x] Keep image, video, and audio add targets directly reachable through reference-type selectors with filled/capacity counts.
- [x] Make the clip rail a true side drawer with a centered divider chevron and horizontal resize grip.
- [x] Reserve reference-drawer height in the workspace grid so its initial controls and token labels cannot overflow below the modal.
- [x] Replace the reference header's Show/Hide button with a centered top-edge chevron that remains available while fully collapsed.
- [x] Route reference add/replace/clear commands through a narrow core capability that reuses CGlide's native upload, media probe, render, commit, and stash behavior.
- [x] Add a standard header copy icon that copies the active prompt without altering it.
- [x] Default the workspace to H3 Studio's native prompt font and provide one browser-local font selection shared by both editors.
- [x] Reuse H3 Studio's native `@` autocomplete controller in the workspace, including reference thumbnails, filtering, keyboard selection, and next-shot insertion.
- [x] Integrate camera prompt chips.
- [x] Add individual MiniMax section starters, a complete missing-section starter, and an initial `[Shot 1] at 00:00.000:` example.
- [x] Preserve existing authored sections and deterministically place missing sections in canonical order.
- [x] Make individual section controls jump to existing content and make the shot control advance from the highest detected `[Shot N]`.
- [x] Add custom and audio-reference dialogue starters that use H3 speaker IDs, language-tagged `<d>` content, and cursor-scoped insertion in `detailed_description`.
- [x] Add a compact reference-template preview menu for identity/wardrobe, subject motion, camera motion, and environments/props, using populated reference slots and an explicit target shot.
- [x] Share corrected truck-versus-tracking camera vocabulary and a compact extended movement menu across both editors.
- [x] Consolidate cursor-helper insertion paths and include visible select controls in the workspace keyboard focus loop.
- [x] Extend the menu with audio source definitions, exact dialogue/language fields, speaker binding, voiceover, ambience/effects, music-style reference, and explicit complete-versus-layer signal reuse.
- [x] Include standalone audio and enabled reference-video soundtracks without guessing raw `<Audio N>` ordinals.
- [x] Tailor starter sections and frame alignment to Omni versus First/Last mode and the active clip's filled frame slots; preserve authored formats and preambles.
- [x] Support camera, dialogue, and shot insertion in both timeline formats, including inline section headers.
- [x] Validate all five starter profiles, audio form previews, selected-shot/source/speaker binding, prompt persistence, native undo, and base-mode camera insertion in an isolated browser; pass all 37 model tests and JavaScript syntax checks.
- [ ] Extend mode detection to graph-connected first/last images through an appropriate read-only capability; current profiles use populated active-clip slots only.
- [ ] Consider an explicit previewed conversion/replacement action for old alignment instructions and timeline formats; current starters deliberately preserve authored content.
- [x] Validate no-project opening, live prompt serialization, camera insertion, inherited/blank clip creation, clip switching, Escape, focus restoration, and zero scoped accessibility violations in isolated live ComfyUI.
- [x] Add direct reference-package copy access with the active clip preselected and return to the workspace after close/apply.
- [x] Enrich the clip rail with compact reference thumbnails, prompt summaries, and keyboard previous/next navigation.
- [x] Carry the persistent prompt font-size controls into the workspace.
- [x] Add arbitrary and Shift-range clip selection with batch removal and drag-and-drop reordering.
- [x] Add clip rename, enable/disable, and predecessor-link controls.
- [x] Add per-clip resolution and duration with apply-to-selected and apply-to-all actions.
- [x] Present duration editing in decimal seconds, convert to CGlide's aligned frame count internally, and baseline-align the resolution, duration, and action controls.
- [x] Share CGlide's authoritative ratio, resolution, and duration preset catalog with the workspace instead of maintaining duplicate option tables.
- [x] Distinguish enabled clips with a green inclusion dot while retaining the existing disabled treatment.
- [x] Normalize reference-section append boundaries so copied definitions do not gain an extra blank line.
- [x] Mirror base-editor reference/shot coloring and expose CGlide's authoritative Prompt Check remarks in the workspace.
- [x] Reclaim editor height by moving clip naming/font controls into the header and clip settings beside the bottom reference strip.
- [x] Replace move buttons with drag-and-drop reordering for one clip or the current multi-selection.
- [x] Add a collapsible left clip drawer and a prompt-only expanded workspace mode.
- [x] Preserve native textarea undo for camera and prompt-structure insertions.
- [x] Verify that native New intentionally clears the project list while retaining the current on-screen clip and its references.
- [ ] Live-validate the reference-copy handoff, enriched rail, and keyboard navigation after the user's active renders finish.

### Milestone 5: Script breakdown and coverage planning

- [ ] Load text-based screenplay PDFs and identify documents needing OCR.
- [ ] Produce a neutral, versioned scene/character/location/shot model.
- [ ] Generate editable coverage plans and model-specific prompts.
- [ ] Export reviewable shot-plan JSON.
- [ ] Import approved plans after a supported CGlide project API exists.

### Later rendering and graph work

- [ ] Define safe project snapshots and whole-project seed-take behavior.
- [ ] Add multi-take Render All only after cancellation, chaining, naming, and state restoration are specified.
- [ ] Explore an active-prompt override for external prompt nodes.
- [ ] Treat bidirectional prompt-node integration as a separate architectural proposal.

## Desired Frontend API, Introduced Incrementally

The following is a capability inventory, not a request to implement everything at once.

### Stage 1: Lifecycle and placement

```js
{
  apiVersion: 1,
  component: "cast",
  node,
  root,
}
```

### Stage 2: Active prompt editing

```js
api.getPrompt();
api.setPrompt(text);
api.insertPrompt(text);
```

### Stage 3: Project and clip state

```js
api.getProjectSnapshot();
api.getActiveClip();
api.getClip(clipId);
api.updateClip(clipId, update);
api.copyReferences(sourceClipId, targetClipId, options);
```

State returned to extensions should be cloned or read-only. Mutations should go through API methods so CGlide can validate, serialize, repaint, and preserve undo/revert behavior.

### Stage 4: Import and rendering

```js
await api.importProject(projectData, options);
await api.renderProject(options);
```

These operations are asynchronous and should have defined cancellation and error behavior.

## Upstream Conflict Hotspots

Line numbers are intentionally omitted because they drift. Locate these areas by symbol or comment heading.

### `web/csglide_cast.js`

Highest-risk file. It contains UI, state, project management, import/export, and Render All in one large module.

Important regions:

- `blankState()`
  - Defines the in-browser state shape for one clip.
- `parseInitial()`
  - Whitelists persisted clip fields. New fields vanish unless added here.
- `buildUI(node)`
  - Owns almost all private UI functions and state closures.
- `attachPromptAutocomplete()` and `nextShotMarker()`
  - Own the shared native `@` suggestion controller used by both the main prompt and companion workspaces.
- The version 1 `promptAutocomplete` capability
  - Attaches that controller to an external textarea without exposing mutable project state or duplicating CGlide's suggestion rules.
- The version 1 `projectNavigation.clipSettings` catalog
  - Exposes immutable ratio ladders and aligned duration presets used by compact companion editors.
- The object returned at the end of `buildUI()`
  - Current externally reachable surface: `root`, `destroy`, `load`, `pasteFile`, `save`, and `state`.
- `stateFromFile()`, `doLoad()`, and project load/import functions
  - Project/clip file ingestion and media restoration.
- `proj()`, `stash()`, `switchTo()`, and project mutation helpers
  - Authoritative browser project state and active-clip transitions.
- `renderAll()`, `queueOnce()`, and `waitForPrompt()`
  - Sequential project rendering and chaining.
- The `app.registerExtension()` block
  - Node creation, `this.h3ui`, widget setup, load/configure, resize, and destruction.

Any fork-only changes inside this file should be limited to a small generic seam. Feature implementations should live in separate TWL files whenever possible.

### `csglide_cast.py`

Important regions:

- `parse_h3_data()`
  - Backend whitelist for state received from the browser.
- `CSGlideCast.INPUT_TYPES()`
  - Any new graph inputs, such as `prompt_override`.
- `RETURN_TYPES` and `RETURN_NAMES`
  - New outputs must be appended to preserve existing workflow link indexes.
- `CSGlideCast.build()`
  - Selects the prompt, tokenizes it, and constructs conditioning.
- `IS_CHANGED()`
  - Cache invalidation currently follows `h3_data`.

Prompt-node interoperability would touch this file. Prompt chips, reference copying, and import policies should not need to.

### `csglide_seed.py`

The seed node itself is small. Multi-take Render All will more likely conflict in `web/csglide_cast.js`, but changes should be checked against the seed node's `control_after_generate` behavior.

### `__init__.py`

Only relevant when adding new Python nodes or modules. Avoid modifying it for frontend-only TWL features when a separate companion custom-node package can register its own web directory.

### `pyproject.toml`

Upstream uses version changes to trigger inherited publishing and release workflows. TWL should not alter upstream publisher metadata on the mirror branch. The fork's Publish and Release workflows have been disabled in GitHub's repository settings.

## Fallback if Upstream Does Not Add Hooks

If the author declines or does not respond, preserve the same architecture locally:

1. Add the smallest possible generic seam to the TWL branch.
2. Keep that seam in its own commit.
3. Do not implement TWL features directly inside the seam commit.
4. Put TWL UI and feature code in a separate companion package or separate source files.
5. Rebase or merge upstream regularly so conflicts remain small.

The fork-only seam should ideally be limited to:

- Dispatching lifecycle events
- Constructing a narrow public capability object
- Marking semantic insertion slots
- Forwarding calls to existing private functions

This concentrates future conflicts in a few predictable locations instead of scattering TWL edits throughout `csglide_cast.js`.

## Conflict Audit After Every Upstream Update

After fetching upstream:

```powershell
git fetch upstream origin
git diff --stat upstream/main...TWL-ComfyUI-CGlide
git diff --name-status upstream/main...TWL-ComfyUI-CGlide
git log --oneline --no-merges upstream/main..TWL-ComfyUI-CGlide
```

Pay special attention when upstream changes any hotspot listed above, even if Git reports no textual conflict. Semantic conflicts can occur when both sides change the state model or lifecycle ordering on different lines.

Enable remembered conflict resolutions locally:

```powershell
git config rerere.enabled true
git config merge.conflictStyle zdiff3
```

## Verification Checklist

After an upstream merge or rebase, verify at least:

- Existing workflows load without shifted input/output links.
- A single clip loads, edits, saves, and reloads.
- A project switches clips without losing the clip being left.
- Project Revert still preserves the expected previous state.
- Reference media and trim ranges survive save/load.
- Render All works in separate mode.
- Render All works in continuation mode.
- Look carry and seam references still behave correctly.
- Stopping Render All restores the UI.
- Companion UI is cleaned up when a node is removed.
- Loading an older project drops no supported fields unexpectedly.
- No TWL documentation or session artifacts appear in an upstream PR diff.

## Upstream PR Hygiene

Before opening an upstream PR:

```powershell
git fetch upstream
git diff --name-status upstream/main...HEAD
git log --oneline --no-merges upstream/main..HEAD
```

The branch should contain only the focused upstream contribution. In particular, it should not include:

- This roadmap
- Codex/session documentation
- TWL branding or features
- Companion-extension code unrelated to the proposed upstream change
- Merge commits from either TWL branch

## Decision Log

Record decisions here as the author responds or implementation proceeds.

| Date | Decision | Reason |
|---|---|---|
| 2026-10-05 | Expose ratio, resolution, and duration choices as an immutable `projectNavigation.clipSettings` catalog | Focused editors can use CGlide's exact native ladders and frame-aligned durations without copying preset tables or mutating settings outside authoritative commands |
| 2026-10-05 | Merge upstream v1.3.0 into Dev immediately after a clean merge simulation | The release changes the shared `web/csglide_cast.js` hotspot; integrating while the merge is clean limits future conflict accumulation and preserves the public `main` mirror |
| 2026-10-05 | Extract CGlide's native prompt autocomplete into one attachable controller and expose it through a versioned capability | The workspace should receive the same reference tokens, thumbnails, next-shot suggestion, filtering, caret placement, and keyboard behavior without maintaining a second autocomplete implementation |
| 2026-10-05 | Consolidate workspace chrome around the header, clip drawer, and bottom reference/settings band | The prompt is the primary work surface; project controls should remain available without consuming a permanent row above it |
| 2026-10-05 | Put the complete native reference rack in a collapsible, vertically resizable bottom drawer | Empty add targets make the workspace a complete editing surface, while collapse and resize keep prompt height under the user's control |
| 2026-10-05 | Use explicit image, video, and audio selectors in the reference drawer | Nine image slots otherwise push video and audio off-screen, making supported add operations appear to be missing |
| 2026-10-05 | Put the clip drawer toggle directly on its divider and leave it on the modal edge while collapsed | The control stays beside the thing it affects and remains reachable without consuming distant header space |
| 2026-10-05 | Make the workspace grid own the reference drawer's default and resized height | An independently sized child could overflow the final grid track and be clipped by the modal until a manual resize forced recalculation |
| 2026-10-05 | Use the same edge-chevron interaction for both workspace drawers | Drawer controls stay spatially attached to the surfaces they affect and no longer consume header space |
| 2026-10-05 | Edit workspace duration in decimal seconds while preserving CGlide's frame alignment internally | Seconds match the user's planning language; the authoritative project command still normalizes the value to a valid `17k+5` frame length |
| 2026-10-05 | Color the enabled clip dot green and leave disabled clips subdued | The active render state becomes readable at a glance without changing CGlide's enable/disable semantics |
| 2026-10-05 | Share one prompt-font preference across H3 Studio and the Prompt Workspace, defaulting to H3's native sans-serif stack | The focused editor should not change typography unexpectedly, while users who prefer mono, serif, or humanist text can keep both surfaces consistent |
| 2026-10-05 | Expose reference mutation as slot-level commands that reuse CGlide's authoritative media path | The companion may choose and display slots but must not duplicate uploads, duration probing, project persistence, or mutate private state |
| 2026-10-05 | Copy the active prompt from a header icon without rewriting or selecting its text | Clipboard export is a frequent editing action and should not disturb prompt content, selection, or undo history |
| 2026-10-05 | Use native textarea editing history for workspace-generated insertions | Camera chips and structure helpers should behave like typing, including Ctrl+Z, instead of resetting the browser's undo stack through direct value assignment |
| 2026-10-05 | Reuse CGlide's Prompt Check results and mirror its reference/shot coloring in the workspace | Validation rules stay authoritative in CGlide, while a passive synchronized backdrop preserves normal textarea editing, selection, undo, and accessibility |
| 2026-10-05 | Keep CGlide's native New behavior unchanged: it clears the project list but retains the current on-screen clip and references | The upstream code explicitly treats the visible clip as the likely first clip of the next project; a different reset policy should be an explicit future choice, not a silent companion override |
| 2026-10-05 | Extend `projectNavigation` with command-oriented rename, selection batch, link, enabled, and clip-setting operations | The workspace needs project management parity, while CGlide must remain responsible for stash/load, link healing, rendering, persistence, and Revert behavior |
| 2026-10-05 | Clear queued `lastOut` plus automation-marked seam/look slots when Clear continues is selected | Rerendering should not retain any output-derived state for queued clips; an outside predecessor remains available only when needed to start a mid-chain render |
| 2026-10-05 | Make prompt-structure buttons add missing content or navigate to existing content | The same compact controls can serve as a section outline for long prompts, reducing scrolling without adding another navigation surface |
| 2026-10-05 | Keep the clip rail visible and enrich it with a reference thumbnail, prompt summary, and Ctrl+PageUp/PageDown navigation | Identifying and changing clips should not require moving between the project list and a distant prompt area |
| 2026-10-05 | Reuse the existing atomic Copy refs dialog from the workspace and return to the workspace afterward | This removes canvas navigation without duplicating reference-copy planning, preview, validation, or apply semantics |
| 2026-10-05 | Add deterministic MiniMax section starters and an editable `[Shot 1]` example to the Prompt Workspace | Prompt structure is easy to forget; explicit scaffolding provides a reliable starting point without asking a model to rewrite or infer the user's authored prompt |
| 2026-10-06 | Add separate H3 custom-dialogue and audio-reference-dialogue starters inside `detailed_description` | Both forms need stable speaker IDs and exact `<d>` content, while an audio reference should guide voice timbre and delivery without silently copying its spoken words |
| 2026-10-06 | Put reference packages in one compact preview menu with populated media selectors and an explicit target shot | Definitions, retention notes, and shot instructions need to stay consistent without crowding the prompt toolbar; preview is required before insertion and existing text is preserved |
| 2026-10-06 | Default reference templates to the next unused subject ID and allow explicitly extending an existing subject | Avoids silently redefining Subject 1 in every template and makes reference roles an intentional user choice |
| 2026-10-06 | Correct truck-versus-tracking language, share extended camera vocabulary, and remove dialogue from the soundscape starter | H3 distinguishes sideways camera translation from subject tracking, and puts spoken dialogue in the shot timeline |
| 2026-10-06 | Keep this review focused on companion prompt helpers and keyboard behavior | No additional core seam is needed; audio-package expansion, mode-specific scaffolding, and broader workspace decomposition remain follow-ups rather than merge-sensitive changes |
| 2026-10-06 | Add full audio packages to the existing compact menu and make Audio-ref dialogue a shortcut to that form | Hard-coding `@audio1` cannot cover different slots, video soundtracks, exact dialogue, language, or stable speaker bindings; preview shows the linked definitions, retention notes, and timeline/audio instructions |
| 2026-10-06 | Preserve exact spoken words and keep speaker IDs out of audio retention notes | H3 uses speaker IDs in definitions and actual vocal events; retention describes the audio relationship rather than assigning a voice |
| 2026-10-06 | Choose three base-mode sections or six reference-mode sections from the active mode, with frame-slot-specific opening instructions | First/Last mode covers text-only, first-only, last-only, and first-plus-last cases; audio and visual reference packages remain confined to Omni mode |
| 2026-10-06 | Preserve existing opening instructions and whichever timeline field is already authored | Adding missing scaffolding should not silently rewrite an older prompt; notify the user to review frame anchors and timing instead of guessing a conversion |
| 2026-10-06 | Share section parsing across starter and camera helpers, supporting both timeline field names and inline headers | Prevents mode drift where the starter creates a valid base-mode prompt but camera/dialogue tools refuse to edit it |
| 2026-10-06 | Make the workspace shot chip advance from the highest detected shot and insert `[Shot N] at 00:00.000:` | Number-aware insertion avoids duplicate shot labels, and a visible zero timestamp is a deliberate editable placeholder, including for Shot 1 |
| 2026-10-05 | Insert only missing prompt sections and preserve existing section text | Starter actions must be safe on partially authored prompts and must not overwrite carefully written identity, sound, or scene direction |
| 2026-10-05 | Expose clip listing, switching, and creation through a versioned `projectNavigation` command capability | The workspace needs project navigation, but companion code must not reach into `gcast_project` or reproduce CGlide's stash/inheritance behavior |
| 2026-10-05 | Expose prompt editing as versioned snapshot/set/insert commands with an opaque revision, while keeping camera vocabulary and UI in the private companion | The seam synchronizes all of CGlide's authoritative prompt representations without exposing mutable state, and the frequently changing UX remains outside the high-conflict upstream file |
| 2026-10-05 | Make camera chips cursor-scoped and refuse structured insertion outside `detailed_description` | Camera direction is shot/scene intent; silently relocating it from `subject_definitions` or another section would change authored meaning and encourage prompt drift |
| 2026-10-05 | Ship Clear continues as an opt-in Render setting, off by default on new nodes and remembered after the user selects it | Cleanup changes generation inputs; keeping the choice explicit avoids surprising projects that intentionally reuse a manually prepared continuation |
| 2026-10-04 | Implement opt-in continuation cleanup as the next feature, inside CGlide's Render All setup | CGlide owns render scope and the paired `cont`/seam state; cleaning at this boundary removes repetitive manual work without exposing mutable project internals to the companion |
| 2026-10-04 | Preserve links and `lastOut` while clearing continuation media | Links express user intent and `lastOut` lets Render rebuild mid-chain continuity; only stale generated inputs need removal |
| 2026-10-04 | Keep camera movement and framing in `detailed_description`, normally inside the applicable `[Shot N]` block | Camera direction is shot intent rather than reusable reference identity; reference copying must therefore leave it behind unless the user explicitly copies the whole scene section |
| 2026-10-04 | Put reference-copy parsing and UI in the private companion and expose only cloned snapshots plus an atomic validated apply capability from CGlide | This confines the upstream conflict surface to one small seam and prevents companion code from mutating `gcast_project` or calling private closures |
| 2026-10-04 | Move section-aware reference copying ahead of the general prompt API | It is the next requested workflow and can be implemented atomically through one narrow CGlide capability |
| 2026-10-04 | Treat `subject_definitions` as the default MiniMax reference metadata block and include related `retention_analysis` when present | These blocks carry reusable identity, environment, prop, and retention meaning while scene sections normally should not transfer |
| 2026-10-04 | Parse and remap copied prompt sections deterministically | Copying must preserve authored text and must not introduce LLM rewriting or unresolved reference dependencies |
| 2026-10-04 | Prioritize font sizing and compact settings as the first TWL UI milestone | They provide immediate value without mutating project state or requiring new upstream APIs |
| 2026-10-04 | Treat the future expanded editor as a focused Prompt Workspace | Clip navigation, compact references, and prompt tools belong in one coherent editing experience |
| 2026-10-04 | Copy references as structured packages with optional prompt definitions | Blind media or full-prompt copying cannot safely remap tokens or preserve destination text |
| 2026-10-04 | Add script breakdown and coverage planning to the TWL wishlist | Coverage variants provide editorial alternatives that seed variation alone cannot create |
| 2026-10-04 | Use a neutral, versioned shot-plan model before direct CGlide import | Keeps the planning system testable and avoids coupling it to CGlide's private project schema |
| 2026-10-04 | Implement a private compatibility adapter while awaiting a native upstream seam | Allows TWL development to proceed while keeping the upstream fork unchanged and the compatibility boundary isolated |
