# Proposal: Lightweight Frontend Extension Hooks for CGlide UI Customization

Hi — I just forked this project. Most of the changes I expect to make are related to UI/UX, and I realize that some of them may not be priorities for the main project or may be specific to how I work.

I would like to stay in sync with upstream and avoid creating major conflicts with your code. At the same time, it may be useful to provide an easier way for others to create optional UI/UX customizations without affecting CGlide's core behavior. Ideally, I could keep my customizations in a separate ComfyUI extension instead of maintaining a long-lived fork of CGlide's frontend files.

Would you be open to adding a small, generic extension seam for third-party frontend customizations?

The proposal below is only an initial suggestion. It came out of brainstorming with Codex and is also informed by a similar extension approach I experimented with for LTX Director. I eventually stopped working on that integration after moving to MiniMax, but the separation between the core project and optional UI customizations seemed useful.

## Motivation

CGlide already registers its frontend through ComfyUI's extension system. A downstream extension can apply CSS or wrap node lifecycle methods, but deeper customization currently requires depending on CGlide's internal DOM structure or modifying files such as `csglide_cast.js` directly.

A small lifecycle-event API would let downstream extensions enhance the UI without changing CGlide itself. This could reduce fork maintenance while remaining useful to any third-party extension—not only mine.

The intended properties are:

- No downstream- or vendor-specific behavior in CGlide
- No new dependency
- No behavior change when no extension is installed
- No requirement for CGlide to discover or load downstream extensions
- A small, versioned contract instead of reliance on private closures or DOM position
- Freedom for CGlide's internal implementation to continue evolving

## Proposed Initial Scope

For an initial implementation, I suggest keeping the surface deliberately small:

1. Emit an event after an H3 Studio UI has been initialized.
2. Emit a corresponding event immediately before that UI is destroyed.
3. Provide the node instance and UI root in a versioned event payload.
4. Optionally mark agreed-upon UI insertion points with stable `data-cglide-slot` attributes.

Starting with H3 Studio (`CSGlideCastCS`) would allow the contract to be tested before considering the other CGlide nodes.

## Proposed Events

### UI ready

After the node's custom UI has been constructed and initialized:

```js
window.dispatchEvent(new CustomEvent("cglide:ui-ready", {
  detail: Object.freeze({
    apiVersion: 1,
    component: "cast",
    node,
    root: ui.root,
  }),
}));
```

### UI destroy

Immediately before the custom UI is destroyed:

```js
window.dispatchEvent(new CustomEvent("cglide:ui-destroy", {
  detail: Object.freeze({
    apiVersion: 1,
    component: "cast",
    node,
    root: ui.root,
  }),
}));
```

The event names and payload are only a concrete starting point; I am happy to follow the project's preferred naming.

## Example Consumer

A separate ComfyUI custom-node package could listen for the lifecycle without importing or modifying CGlide files:

```js
const cleanupByRoot = new WeakMap();

window.addEventListener("cglide:ui-ready", (event) => {
  const { apiVersion, component, node, root } = event.detail ?? {};

  if (apiVersion !== 1 || component !== "cast" || !root) return;

  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Custom action";

  const onClick = () => {
    // Perform an optional downstream action using the node or public UI state.
    console.debug("CGlide extension action", node);
  };

  button.addEventListener("click", onClick);

  const slot = root.querySelector('[data-cglide-slot="toolbar-actions"]');
  if (slot) slot.append(button);

  cleanupByRoot.set(root, () => {
    button.removeEventListener("click", onClick);
    button.remove();
  });
});

window.addEventListener("cglide:ui-destroy", (event) => {
  const { root } = event.detail ?? {};
  cleanupByRoot.get(root)?.();
  cleanupByRoot.delete(root);
});
```

This listener is illustrative. A consumer could also use the event only to add behavior, apply accessibility enhancements, or coordinate its own UI.

## Optional Semantic Slots

Where an extension may safely add controls, a stable semantic marker would avoid coupling to child order or internal class names:

```html
<div data-cglide-slot="toolbar-actions"></div>
```

Slots would not need to define styling or plugin behavior. They would only identify supported insertion locations. I suggest adding slots only where there is an immediate, agreed-upon use case rather than attempting to design every possible extension point in advance.

If semantic slots are considered premature, the lifecycle events and `root` reference would still be useful on their own.

## API Boundary

For the first version, I suggest treating only these fields as public:

- `apiVersion`: version of the extension-event contract
- `component`: identifies the CGlide UI, initially `"cast"`
- `node`: the associated ComfyUI node instance
- `root`: the root DOM element for that UI instance

This proposal intentionally does not expose the complete internal UI object as a stable API. Additional capabilities could be added later as explicit, documented methods if real extension use cases require them.

Extensions should also avoid mutating CGlide's internal state directly. The initial seam is intended for UI composition and lifecycle coordination, not replacement of CGlide's state management.

## Compatibility

The proposed events would be advisory and have no return value. CGlide would not depend on a listener being present, and extensions could not cancel normal initialization or destruction.

Using an `apiVersion` field gives consumers a clear compatibility check if the event contract ever needs to evolve.

## Offer to Contribute

If this direction is acceptable, I would be happy to prepare a focused PR that:

- Adds the two lifecycle events for H3 Studio
- Adds any semantic slot agreed upon here
- Documents the event payload and a minimal listener example
- Leaves existing behavior unchanged when no listener is installed

Before preparing the PR, I would appreciate guidance on:

1. Whether lifecycle events are an acceptable extension mechanism for this project
2. Preferred event names and component identifiers
3. Whether the first PR should include a semantic slot, or events only
