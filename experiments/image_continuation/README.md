# Image Carry experiment - design before implementation (2026-10-17)

Branch: experiment/h3-image-continuation, based on core Dev 8d4fe34.
Worktree: C:/Users/steven/Documents/CGlide-Experiments/h3-image-continuation.
Implementation and CPU verification used this separate directory outside custom_nodes.
On 2026-10-17 the user authorized switching the installed core checkout to the
experimental branch for testing. The separate worktree is retained at a detached
commit; installed ComfyUI will load the experiment after the user relaunches it.
No restart, GPU generation, merge, or push was performed as part of activation.

## Investigation

CSGlideCastCS receives a JSON h3_data widget. parse_h3_data whitelists slots,
continuation, and clip metadata. REF2VA allows nine images, three videos, three
audio slots. build_tag_map compresses populated slots to actual Picture/Video/Audio
presentation order; frontend @imageN identifies the slot, not the compact ordinal.

Continuous: renderAll adopts the predecessor output into input/cglide, selects
its tail, fills st.cont, and may add a seam video reference. _continuation encodes
the tail as minimax_keyframes at resolved_frame_index=0, with optional anchored
audio. Look At: unlinked clips adopt the predecessor into video slot 1 with
carry=true, choose a reference span, and use ordinary minimax_refs plus an injected
prompt instruction. These pathways differ. Both reuse generated video.

CSGlideJoinCS receives decoded images and can combine them with the source using
overlap, level matching and audio matching. Its images input is upstream of those
operations. Empty source_video bypasses Join unchanged. Both example workflows
feed a stock VAEDecode into Join. Output-history masters may already be assembled;
extracting from a saved video cannot establish raw-frame provenance.

## Minimal architecture

Source: preceding clip's raw decoder final frame.
Conditioning: an ordinary additional REF2VA image, not an exact opening frame.
Join: no source_video/overlap conditioning in this mode; existing Join passes
through. No automatic concatenation is promised. Existing modes retain their
join behavior. A future independent assembler can consume the separate outputs.

Add a small output node to capture one frame directly from a verified decoder
connection in a cloned API prompt. It writes an atomic PNG at native dimensions
in ComfyUI temp, using an immutable unique filename per render attempt.
A fresh queue nonce forces new capture and conditioning cache identity. No VAE,
codec round-trip, normalization, or frame resizing is added by capture. PNG
requires ordinary 8-bit RGB quantization of the decoded float frame.

A separate frontend policy module owns validation, draft conditioning, graph
transformation and session records. Minimal authoritative Render All changes
select that policy instead of existing video continuation. Never modify the
live state or user prompt to add the frame. Clear continuation and generated
seam/look references only in the queued draft. Refuse authored video-directed
prompt tokens (rather than silently dropping their meaning), manual video references
in this image-only comparison, FL2VA, no free image slot, ambiguous graphs, or
missing raw predecessors. Offer re-render predecessor/include it, or disable
Image Carry to run independently. Do not silently fall back to encoded video.

The capture record is session-only, tied to the clip object and lastOut identity.
Rerender invalidates that clip and downstream records. PNG files are published atomically under unique names, so a late cancelled job
cannot overwrite a newer frame. Session records replace the prior record per
clip; references do not accumulate in projects or ZIP exports. Unreferenced
PNGs remain in ComfyUI temp until its normal cleanup (no user input/output files
are deleted).
A reload/import requires re-rendering a predecessor. ComfyUI temp cleanup may
remove files; missing references fail clearly before sampling. This bounded MVP
does not promise resume across browser/server restarts.

UI: explicit Image Carry checkbox in project Render controls, default off;
disable + look and clear continues while selected. A preview link opens the
available predecessor frame. Scope/link selection stays available, but Image
Carry uses the immediate project predecessor regardless of link state. Skipped
predecessors require a fresh session capture. Direct ComfyUI Queue is unchanged;
use Project Render -> this clip for an individual Image Carry render.
Any execution started outside a Project Render run conservatively invalidates
all session captures, including ordinary Queue or another workflow, so an
unrecorded rerender cannot silently leave old capture records usable.

## Multishot research and compatibility

Primary sources reviewed on 2026-10-17:
- https://github.com/jlucasmcrell/ComfyUI-H3-Multishot
- https://github.com/jlucasmcrell/ComfyUI-H3-Multishot/blob/master/h3_chain_normalize.py
- https://github.com/jlucasmcrell/ComfyUI-H3-Multishot/blob/master/h3_keyframes.py
- https://github.com/jlucasmcrell/ComfyUI-H3-Multishot/blob/master/SETTINGS.md

Multishot distinguishes first-frame relay, latent/context pinning and boundary
plates. Context pinning uses a different sampler/integration, with version and
extension dependencies. These nodes are not drop-in CGlide replacements. Its
documentation warns about recursively compounded texture and recommends a fixed
baseline for appearance correction. Those are research leads, not evidence that
Image Carry fixes drift in this workflow.

H3ChainNormalize operates on decoded output: histogram matching to an early
reference plus smoothed structure-band correction. That is post-generation
correction, distinct from normalizing a carried conditioning image.
H3 keyframe helpers create positional anchors; our local native H3 implementation
also supports AddGuide/keyframes. REF2VA image references are not positional
constraints. An exact first-frame variant needs checkpoint-specific validation;
no FL2VA switch or custom positional patch is part of this MVP.

Fixed image anchoring is already possible through ordinary persistent image
references and is a useful nonrecursive control. Normalization, latent carry,
texture correction and exact-first-frame carry stay unimplemented to avoid
confounding this initial experiment. No Multishot dependency is added.

## Validation plan

Automated checks cover graph provenance, immutable drafts, sparse slot numbering,
image limits, prompt preservation, manual video rejection, nonce/cache identity,
record invalidation, failures/resume, and exact final-frame PNG dimensions/pixels
with CPU synthetic tensors. Check existing mode branches and Join bypass.
Browser checks must use an isolated named session, never the user's render tab.
GPU validation remains pending. Do not claim drift reduction from CPU checks.

Start with two identical saved test clips using the same three references and
segmented dialogue. Compare independent, Look At, Continuous, and Image Carry
with matched per-clip seeds/settings. Keep checkpoint, LoRA, sampler, scheduler,
resolution and refinement choices fixed. Inspect raw outputs separately from
joins. Score identity, contrast, under-eye shadows, skin texture, background,
framing, boundary motion, lip-sync, time and peak VRAM. Inspect the carried PNG.
Then repeat three clips, then seven; only consider 16 after reviewing those.


## Implemented files and node surface

- `web/experimental_image_carry.js`: cloned-draft policy, graph/preflight validation, experimental controls,
  capture history validation, runtime records and dependency invalidation.
- `web/csglide_cast.js`: queue transform seam, authoritative Render All policy
  selection, capture bookkeeping, external-render invalidation,
  and mounting of the separate controls. Existing continuation branches remain intact.
- `csglide_image_carry.py`: new `CSGlideImageCarryCS` output-only capture node.
- `__init__.py`: register that output node; no existing socket indexes change.
- `csglide_cast.py`: resolve dedicated annotated temp PNGs inside the carry temp
  folder; existing input assets keep their prior resolver path.
- `experiments/image_continuation/`: this design, CPU/policy/render-loop tests,
  and `example-two-clips.h3proj.json` with placeholder media and dialogue.

No companion changes, workflow rewiring, scheduler/LoRA/checkpoint changes,
normalization, or changes to Glide Join are required by this MVP.

## Verification completed (2026-10-17)

- 19 Node policy and actual Render All function tests passed. Queue/history
  responses were mocked; tests never submitted jobs to a ComfyUI server.
- 5 Python CPU-only tests passed using synthetic tensors. They verify final-frame
  pixels and dimensions, source immutability, malformed inputs, safe temp path
  resolution, sparse reference tag ordering/audio trims, and Join's passthrough.
- Isolated browser control fixture passed default-off, mode exclusion,
  option preservation and preview visibility checks, with zero scoped axe
  accessibility violations. This is not a full canvas contrast audit.
- A separate ComfyUI 0.39.1 process ran with `--cpu`, a temporary base/user/temp
  directory, and only this experimental custom-node package. Capture-node
  registration, a synthetic EmptyImage -> capture execution, returned history
  metadata, PNG dimensions (64 x 32), and the preview HEAD request all passed.
  That graph loaded no model and performed no video generation.
- In the actual isolated H3 Studio UI, programmatic control-handler checks
  confirmed mode exclusion and a missing-predecessor alert before any queue
  submission. A queue spy confirmed zero generation submissions. The separate
  control fixture supplied the layout/accessibility check; native canvas hit
  testing and the full production companion workflow are not claimed verified.
- Isolated browsers and helper servers were stopped after verification. The
  user's running ComfyUI was not attached to, interrupted, or restarted.

Reproduce the automated tests from this worktree:

```powershell
node --test experiments/image_continuation/test_policy.mjs experiments/image_continuation/test_render_loop.mjs
& 'C:\ComfyUI-Easy-Install\python_embeded\python.exe' -m unittest discover -s experiments/image_continuation -p test_capture.py -v
node --check web/csglide_cast.js
node --check web/experimental_image_carry.js
python -m py_compile csglide_cast.py csglide_image_carry.py __init__.py
git diff --check
```

GPU generation, drift reduction, real lip-sync, render timing/VRAM, real project
packaging round trips, long-chain results and production companion integration
remain unvalidated. The PNG is 8-bit RGB, not a lossless float-tensor serialization.
Only one Studio/Glide Video path and a direct stock VAEDecode/VAEDecodeTiled
connection before Join are accepted. Ambiguous or post-processed graphs stop
before submission. If an upstream upscale/refinement path is enabled, this MVP
captures the decoder actually feeding Join; it does not bypass or alter that
path. For the requested initial comparison, keep refinement bypassed as usual.

## Activation and two-clip GPU procedure (not executed)

The user authorized activation in the installed core checkout on 2026-10-17.
Relaunch ComfyUI when current renders have finished, then refresh the browser.
The companion remains installed and unchanged. Do not add a duplicate CGlide
package: node IDs and routes would collide. To return to the normal build, switch
the installed core back to TWL-ComfyUI-CGlide-Dev and relaunch ComfyUI.

1. Start from the existing Studio example workflow with the established REF2VA
   checkpoint, Turbo LoRA, 8 steps, Euler/normal, 1344 x 768 and refinement bypass.
   Keep the stock raw decoder -> Glide Join -> Glide Video path. Connect Studio
   source_video/overlap_frames to Join as in the supplied workflow.
2. Open `example-two-clips.h3proj.json` in a saved test workflow. Replace all three
   REPLACE image paths, both REPLACE audio paths, and bracketed dialogue/audio
   instructions with actual test assets. The example contains no media. Use the
   current approved project instead if it already provides the correct segments.
3. Save a fresh copy per comparison. Independent: both clips unlinked, + look
   off, continuation empty. Look At: unlinked, + look on. Continuous: link clip 2
   to clip 1. Image Carry: enable its explicit checkbox; + look and clear
   continues are disabled while selected. Original link choices are retained.
4. Match the per-clip seeds across conditions (record actual queued seeds),
   prompts, source ranges, references and graph settings. Use Project Render
   for both clips. Check clip 1 has normal references; clip 2 receives an extra
   image in its first free slot and has no previous-video or CONTINUE FROM in
   the queued prompt. Confirm authored prompts/slots remain unchanged afterward.
5. Select clip 2 and use Inspect carry frame. Compare the PNG to clip 1's raw
   final frame, not a level-matched assembled result. Examine identity, face
   contrast, shadows, texture, background, framing, boundary motion and audio.
   Record actual render duration and peak VRAM without changing the recipe.
6. Re-render clip 1; clip 2 must use a fresh capture. Exercise a missing predecessor
   with this clip scope, then recovery by including it. Test stop/failure and
   same-session resume. Reload/import requires rebuilding predecessor captures.
   Turning Image Carry off returns to the existing video/link behavior; no
   runtime image references or guidance need to be removed from the project.
7. Review the two-clip comparison first. Only then expand to three and seven
   clips; do not run the 16-clip sequence automatically.

Recommendation: keep this experimental. There is no evidence yet that it solves
contrast drift; do not merge or promote before controlled GPU comparisons and
real-project compatibility checks. If recursive image carry still drifts, compare
a fixed approved image anchor before considering normalization as a separate
experiment. Post-generation leveling must be evaluated separately from the raw
conditioning change.
