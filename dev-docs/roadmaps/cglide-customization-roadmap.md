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
- Decide whether related prompt tokens should remain unchanged, be copied, or be remapped.

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
| TBD | Await maintainer response before implementing the extension seam | Avoid committing to an API shape the maintainer may prefer to name or structure differently |
