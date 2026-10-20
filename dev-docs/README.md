# TWL Development Documentation

This directory contains TWL-specific planning, research, decisions, and upstream proposal drafts for the CGlide fork.

These documents belong on `TWL-ComfyUI-CGlide-Dev`. They are not part of the upstream project and must not be included in branches used for upstream pull requests.

## Current handoff — 2026-10-12

2026-10-20 deferred feature: the user requested a [timestamped dialogue clip creator](roadmaps/timestamped-dialogue-clip-creator.md), linked from the main roadmap. It will accept an audio recording plus Qwen/SRT dialogue timing and shared visual instructions, create dialogue-aware clips with exact spoken-text prompts, and enforce an initial 8-second generated-duration ceiling including continuation overlap. Requirements, audio-strategy decisions, preview/apply safeguards, and acceptance checks are documented. **Do not start implementation until the user's current rendering tests are finished and they resume this item.** This is planned work, not an implemented or validated feature.

Planning documentation is being maintained in the separate `C:\Users\steven\Documents\CGlide-Dev-Planning` worktree on `TWL-ComfyUI-CGlide-Dev`. The installed repositories remain on their local `integration/twl-upstream-v1.4.6` branches during user rendering evaluation; do not switch their branches or interrupt renders to resume planning.

Read this section first in a new session, then the roadmap's latest implementation checklists and symbol-based conflict inventory. Earlier dated decisions explain history; they do not override later explicit decisions or the current implementation.

### Repositories and pushed code baselines

- Core fork: `C:\ComfyUI-Easy-Install\ComfyUI\custom_nodes\ComfyUI-CGlide`, branch `TWL-ComfyUI-CGlide-Dev`; latest pushed baseline `da15f03`, including workspace timed-media editing. Confirmed on origin on 2026-10-11.
- Companion: sibling `ComfyUI-CGlide-TWL`, branch `main`; latest pushed baseline `a1148a3`, including prompt-helper collapse and timed-media preview/editing. Confirmed on origin on 2026-10-11. This is the separate companion repository's main, not the core fork's upstream-mirror main.
- User real-render testing of the batch creator succeeded. Neither core `main` nor the stable `TWL-ComfyUI-CGlide` branch was promoted. Do not promote without an explicit request.
- On 2026-10-12 the user authorized committing and pushing the pending core Dev and companion main batch: render/workspace duration statistics, atomic prompt updates, bulk section editing, global find/replace with find statistics and highlighted previews, Apply & close / Apply & continue, and informative render-handoff errors. Resolve the new commit IDs from Git; the hashes above are the preceding baselines. Recheck both worktrees and remote tips at the start of future work.

### Implemented and ready for user evaluation

- Focused Prompt Workspace with clip management, shared font controls, reference drawers, native autocomplete, prompt highlighting/status, reference copying, camera helpers, and undo-preserving insertion.
- Compact visual/audio reference templates and mode-specific starters. Existing authored prompt formats and opening instructions are preserved rather than silently converted.
- Project New choices: keep the visible clip, start completely clean, or cancel. Clean clears prompt/reference slots/continuation but keeps settings and graph wiring; native Revert backs up even an unlisted clip. Disk media is not deleted.
- Native audio/video Start, End, and Duration fields in decimal seconds. Continuation tails remain locked; effective video-reference frame counts still follow H3 rules.
- Companion **Batch clips** beside the Prompt heading: use a loaded audio/video reference in Omni mode, fixed source subranges, default 8-second segments, shared images/settings, keep/discard tail, and editable music-video/person-replacement/reinterpretation/custom templates. Preview, append with Revert, or export standalone `.h3proj.json`; no automatic render or file splitting.
- Both native and workspace clip menus provide select-all/deselect-all and bulk enable/disable/link/unlink actions.
- Local evaluation batch: independently collapse the Prompt structure/Dialogue/Reference templates/Camera direction helper region with an edge chevron; preview audio/video references in native media controls; edit Start, End, Duration, and video soundtrack use through a narrow authoritative core command.
- Local evaluation batch: show queued clip count and summed seconds beside native Render for the selected scope; show enabled/total clip count and enabled summed seconds beside Clips in Prompt Workspace.
- Local evaluation batch: select one or more workspace clips, choose **Edit sections**, then preview and atomically replace or append Summary, Soundscape, or Music. Other sections remain byte-for-byte outside normalized section boundaries; stale previews refuse the whole apply and successful applies create one project Revert snapshot.
- Local evaluation batch: **Find/replace** searches prompt text across selected, enabled, or all clips, with literal matching by default, optional case/whole-word/regex modes, per-clip preview inclusion, excerpts and counts, atomic stale refusal, and one Revert snapshot. It does not touch clip names or media paths.
- Find previews show total matches and the number of matching clips, with red removal / green insertion highlights. **Apply & continue** keeps the dialog open and requires another preview; **Apply & close** returns to the workspace. **Edit sections** selects the active clip when no clip checkboxes are selected.
- Render handoff failures now identify the missing predecessor output and explain the relevant recovery: re-render/include the predecessor, restore its file, unlink the current clip, or disable `+ look` when that was the handoff being attempted. The raw `adopt_output 404` remains available as structured console metadata rather than being the user-facing message.

### Verification and next work

`npm test` in the companion passed all **52 tests on 2026-10-12**, including section editing and literal/regex find-replace behavior, whole-word and case modes, exact before/after highlight ranges, empty removal, stale-guarded multi-clip planning, and invalid/zero-width refusal. Earlier targeted isolated browser checks covered video preview, timing edits synchronized back into native H3 Studio, and zero scoped accessibility violations. The user accepted the corrected prompt-helper chevron and timed-media changes, which are now pushed. Interactive verification of the new duration statistics, bulk section editor, and find/replace modal remains pending; the latest isolated browser launch failed locally before page load, and no canvas, queue, project, or render interaction occurred. Syntax and whitespace checks passed. The user separately reported successful real-render batch testing.

Immediate priority is user evaluation, not additional speculative features:

The user reported that find/replace works and confirmed on 2026-10-17 that Apply & continue works. The Edit sections activation fix still needs user confirmation; do not describe it as browser-verified.

2026-10-17 follow-up: Prompt Workspace audio/video reference previews now include waveform trim handles, synchronized numeric fields, keyboard adjustment, and preview seeking. The user authorized commit/push on 2026-10-17. Companion implementation commit `9465a93` is pushed to companion `main`; the core change is documentation only. All 52 companion tests, JavaScript syntax checks, and whitespace checks pass. Isolated browser fixtures using synthetic audio/video verified waveform decoding, real pointer dragging, keyboard bounds, numeric-field synchronization, preview seeking, the existing Apply timing request payload, selected-range playback, and cleanup; the trim component had zero scoped accessibility violations. These checks did not load a real ComfyUI project, run GPU jobs, or validate generated output. No stable promotion is authorized.

1. Render a real audio-source batch with a shared identity/style image. Check reference windows, audio reuse, clip naming, and no unintended extra references or continuation.
2. Render a real video-source batch with a replacement identity image. Check range/frame behavior and retained source soundtrack selection; generation is not guaranteed precise compositing.
3. Inspect the final shorter segment and post-production timing. Fixed source-clock ranges do not imply exact rendered duration or automatic music synchronization. H3 render/frame spans and effective reference frames differ; trim/pad and use the original audio as master in post.
4. Check import of exported JSON and media accessibility; `dur` is full-source duration, `start`/`end` are numeric seconds. Export does not bundle media. Clips default to unlinked with no prior output history.
5. Exercise New/clean/Revert and typed trims in a saved test project. Save important work first. Extremely short final batch remainders are refused under Keep; discard them or adjust the range.

Future roadmap items remain unimplemented unless explicitly checked: project-load preserve/replace reference policies; graph-connected First/Last mode detection; saved custom-template management; optional grid-fit/beat/scene segmentation; seed hunting; prompt input/output node integration; screenplay PDF breakdown and coverage planning. A new session should triage reported failures first and not assume these features already exist.

### Safe continuation

- Read root `AGENTS.md`, this README, [roadmap](roadmaps/cglide-customization-roadmap.md), and the companion README. Keep private feature UI in companion files; add only necessary generic authoritative commands in core.
- Inspect both Git worktrees before edits. Do not overwrite unrelated changes, restart active renders, promote stable branches, push, or prepare upstream PRs without the relevant user request.
- Recheck the roadmap's core symbol inventory before upstream integration. Recent hotspots include `newProject`, its cancelable choice event, `trim`, `projectNavigation.appendClips`, and `clipSettings.framesForSegment`.
- Maintain historical decisions alongside a dated current checkpoint; correct obsolete descriptions instead of allowing two conflicting active specifications.
- For browser validation use the agent-browser skill and a named isolated session. Do not attach to the user's active render session or queue real GPU jobs without authorization.

Suggested opening prompt for the next chat:

> Continue CGlide/TWL from the 2026-10-09 handoff in `dev-docs/README.md`. Read `AGENTS.md`, the roadmap's current checkpoint/checklists and conflict inventory, and the sibling companion README. Inspect both repositories before changing anything. The latest batch creator is pushed but still needs real-render evaluation. My next test result/request is: [describe it]. Diagnose reported failures first; do not promote stable branches, push, or interrupt renders without my request.

## Layout

- `upstream-proposals/`: issue and pull-request drafts intended for discussion with the upstream maintainer
- `roadmaps/`: TWL architecture and customization planning
- `decisions/`: future decision records explaining important implementation choices
- `research/`: future technical investigation notes
- `templates/`: reusable local development files that should not be committed at the repository root

## Branch rules

- Keep `main` identical to `upstream/main`.
- Commit these documents only to `TWL-ComfyUI-CGlide-Dev`.
- Create every upstream `pr/*` branch directly from `upstream/main`.
- Never merge a TWL branch into an upstream pull-request branch.

Before opening an upstream pull request, verify its complete diff:

```powershell
git fetch upstream
git diff --name-status upstream/main...HEAD
git log --oneline --no-merges upstream/main..HEAD
```

No path under `dev-docs/` should appear in that diff.

## Public visibility

Branches pushed to a public fork are public. Do not store credentials, private conversations, confidential material, or sensitive session transcripts here. Put confidential development material in a separate private repository.

## Local-only files

The root `AGENTS.md`, raw agent sessions, and scratch output are intentionally local-only. They are excluded through `.git/info/exclude`, which does not alter the upstream repository's committed `.gitignore`.

Use `templates/AGENTS.md` to recreate the root `AGENTS.md` in another clone or worktree.
