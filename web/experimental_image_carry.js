// Experimental policy: all conditioning edits apply only to cloned API prompts.
const MAX_IMAGES = 9;
const CAPTURE_TYPE = "CSGlideImageCarryCS";
const DECODERS = new Set(["VAEDecode", "VAEDecodeTiled"]);
const copy = (value) => JSON.parse(JSON.stringify(value));
const linked = (value) => Array.isArray(value) && value.length === 2;
const outputKey = (out) => out ? JSON.stringify([out.name, out.subfolder || "", out.type || "output"]) : "";
export const captureId = (castId) => `cglide_image_carry_${castId}`;

export function prepareImageCarryState(state, frame) {
  const draft = copy(state);
  if (draft.mode !== "ref2va") throw new Error("Image Carry requires Omni REF2VA. No model or mode is switched automatically.");
  draft.cont = {};
  draft.slots ||= {};
  draft.slots.images ||= [];
  draft.slots.videos = (draft.slots.videos || []).map((slot) => slot?.carry || slot?.seam ? {} : slot);
  if (draft.slots.videos.some((slot) => slot?.file)) {
    throw new Error("Image Carry is an image-only comparison. Remove manual video references in a saved test project, or disable Image Carry. Your references have not been changed.");
  }
  if (/@video(?:audio)?[0-9]+(?![0-9])/.test(draft.prompt || "")) {
    throw new Error("Image Carry cannot preserve video-directed prompt instructions after removing video conditioning. Review those instructions in a saved test project, or disable Image Carry.");
  }
  if (!frame) return draft; // Project clip 1 uses its normal image/audio references.
  const index = Array.from({ length: MAX_IMAGES }, (_, i) => i).find((i) => !draft.slots.images[i]?.file);
  if (index === undefined) throw new Error("Image Carry needs a free image-reference slot (H3 supports nine). No occupied slot was overwritten.");
  const token = `@image${index + 1}`;
  if (new RegExp(`${token}(?![0-9])`).test(draft.prompt || "")) {
    throw new Error(`Image Carry would fill ${token}, which your prompt already mentions despite its empty slot. Review that reference or disable Image Carry.`);
  }
  if (!validFrame(frame)) throw new Error("Image Carry received an invalid capture record. Re-render the preceding clip.");
  while (draft.slots.images.length <= index) draft.slots.images.push({});
  draft.slots.images[index] = { file: `${frame.subfolder}/${frame.filename} [temp]` };
  draft.prompt = `Image Carry guidance: use ${token} only for the preceding performance's final pose, expression, orientation, and spatial placement. Original image references remain authoritative for their assigned identity, facial anatomy, environment, wardrobe, camera viewpoint, framing, and subject scale. Do not take exposure, contrast, saturation, sharpening, or skin texture from ${token}. This is pose guidance, not an exact first-frame constraint.\n\n` + (draft.prompt || "");
  // Keep the capture revision explicit in the queued conditioning identity.
  draft.imageCarryRevision = frame.version;
  return draft;
}

export function rawCaptureLink(output, castId) {
  const id = String(castId);
  if (Object.values(output).filter((node) => node.class_type === "CSGlideCastCS").length !== 1
      || output[id]?.class_type !== "CSGlideCastCS") {
    throw new Error("Image Carry currently requires exactly one H3 Studio node in the queued graph.");
  }
  const joins = Object.entries(output).filter(([, node]) => node.class_type === "CSGlideJoinCS"
    && linked(node.inputs?.source_video) && String(node.inputs.source_video[0]) === id && node.inputs.source_video[1] === 7);
  const videos = Object.entries(output).filter(([, node]) => node.class_type === "CSGlideVideoCS");
  if (videos.length !== 1 || joins.length > 1) throw new Error("Image Carry requires one unambiguous Glide Video output and at most one Glide Join.");
  const [videoId, video] = videos[0];
  let raw;
  if (joins.length) {
    const [joinId, join] = joins[0];
    if (!linked(video.inputs?.images) || String(video.inputs.images[0]) !== joinId || video.inputs.images[1] !== 0) {
      throw new Error("Image Carry requires Glide Video directly after the matching Glide Join (no post-processing capture).");
    }
    if (!linked(join.inputs?.overlap_frames) || String(join.inputs.overlap_frames[0]) !== id || join.inputs.overlap_frames[1] !== 6) {
      throw new Error("Image Carry requires Glide Join overlap_frames wired to this H3 Studio trim_frames output.");
    }
    raw = join.inputs.images;
  } else raw = video.inputs?.images;
  if (!linked(raw) || raw[1] !== 0 || !DECODERS.has(output[String(raw[0])]?.class_type)) {
    throw new Error("Image Carry must capture a stock VAEDecode/VAEDecodeTiled IMAGE output before Join. Wire the raw decoder directly into Glide Join or Glide Video.");
  }
  const visited = new Set();
  function dependsOn(nodeId) {
    nodeId = String(nodeId);
    if (nodeId === id) return true;
    if (visited.has(nodeId)) return false;
    visited.add(nodeId);
    return Object.values(output[nodeId]?.inputs || {}).some((input) => linked(input) && dependsOn(input[0]));
  }
  if (!dependsOn(raw[0])) throw new Error("Image Carry's decoder is not connected to this H3 Studio conditioning.");
  // Video and Join are validated above; no assembled or encoded frames are read.
  return { images: raw.slice(), videoId };
}

export function prepareImageCarryGraph(graph, castId, frame, nonce) {
  const draft = copy(graph);
  const { images } = rawCaptureLink(draft.output, castId);
  const studio = draft.output[String(castId)];
  if (typeof studio.inputs?.h3_data !== "string") throw new Error("Image Carry requires H3 Studio's normal JSON h3_data widget.");
  studio.inputs.h3_data = JSON.stringify(prepareImageCarryState(JSON.parse(studio.inputs.h3_data), frame));
  const id = captureId(castId);
  if (draft.output[id]) throw new Error("Image Carry capture node ID collision.");
  draft.output[id] = { class_type: CAPTURE_TYPE, inputs: { images, run_token: nonce } };
  return draft;
}

export function validFrame(frame) {
  return !!frame && frame.type === "temp" && frame.subfolder === "cglide-image-carry"
    && /^[a-f0-9-]{36}\.png$/.test(frame.filename) && /^[a-f0-9-]{36}$/.test(frame.version);
}

export class ImageCarryRuntime {
  constructor() { this.frames = new WeakMap(); }
  frameFor(shot) {
    const record = shot && this.frames.get(shot);
    return record && record.output === outputKey(shot.lastOut) ? record.frame : null;
  }
  invalidate(shots) { for (const shot of shots) this.frames.delete(shot); }
  record(shot, entry, castId, nonce) {
    const frames = entry?.outputs?.[captureId(castId)]?.cglide_image_carry;
    const frame = Array.isArray(frames) && frames.length === 1 ? frames[0] : null;
    if (!validFrame(frame) || frame.version !== nonce || frame.filename !== `${nonce}.png`) {
      throw new Error("Image Carry did not produce the expected raw final frame. The completed video is kept; re-render this clip before continuing.");
    }
    this.frames.set(shot, { frame: copy(frame), output: outputKey(shot.lastOut) });
  }
}


export function validateImageCarryQueue(shots, queue, runtime, shotLabel) {
  const queued = new Set(queue);
  for (const i of queue) {
    const frame = i > 0 ? runtime.frameFor(shots[i - 1]) : null;
    if (i > 0 && !queued.has(i - 1) && !frame) {
      throw new Error(`${shotLabel(shots[i], i)} needs a raw Image Carry frame from ${shotLabel(shots[i - 1], i - 1)}. Include/re-render that predecessor in Image Carry mode, or disable Image Carry to render independently. Raw captures are session-only; encoded videos are not substituted.`);
    }
    // Use a valid placeholder only to validate future clips' capacity and prompt.
    prepareImageCarryState(shots[i].state, i > 0 ? (frame || {
      filename: "00000000-0000-0000-0000-000000000000.png", subfolder: "cglide-image-carry",
      type: "temp", version: "00000000-0000-0000-0000-000000000000",
    }) : null);
  }
}

export function createImageCarryControls({ element, enabled, running, previousFrame, currentFrame,
    videoOptions, viewURL, onChange }) {
  const label = element("label", "gcast-chk");
  const checkbox = element("input"); checkbox.type = "checkbox";
  checkbox.checked = enabled; checkbox.disabled = running;
  label.append(checkbox, element("span", null, "Image Carry (experimental)"));
  label.onpointerdown = (event) => event.stopPropagation();
  label.title = "Previous raw final frame as REF2VA pose guidance. Uses one free image slot. No previous-video conditioning or joining; links are preserved but not used for conditioning. Use Project Render, including this clip scope. Raw captures last only in this browser session.";
  const preview = element("a", "gcast-btn", "Inspect carry frame");
  preview.target = "_blank"; preview.rel = "noopener";
  const sync = () => {
    for (const option of videoOptions) option.disabled = running || checkbox.checked;
    const frame = previousFrame || currentFrame;
    preview.hidden = !checkbox.checked || !frame;
    // Native .gcast-btn uses all:unset, which can override the hidden attribute.
    preview.style.display = preview.hidden ? "none" : "";
    if (frame) {
      const query = new URLSearchParams({ filename: frame.filename, subfolder: frame.subfolder, type: "temp" });
      preview.href = viewURL(query);
      preview.title = previousFrame ? "Raw frame used from the preceding clip" : "This clip's raw final frame, ready to carry forward";
    }
  };
  checkbox.onchange = () => { sync(); onChange(checkbox.checked); };
  sync();
  return { label, checkbox, preview };
}
