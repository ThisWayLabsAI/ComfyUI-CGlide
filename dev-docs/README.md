# TWL Development Documentation

This directory contains TWL-specific planning, research, decisions, and upstream proposal drafts for the CGlide fork.

These documents belong on `TWL-ComfyUI-CGlide-Dev`. They are not part of the upstream project and must not be included in branches used for upstream pull requests.

## Current handoff - 2026-10-22

### Activation follow-up - 2026-10-22

The user explicitly authorized installing the prototype for normal ComfyUI testing. Both installed repositories remain on `integration/twl-upstream-v1.4.6`: core `5205959` (creation seam `eca2cd5`, selected from Dev `fd8acbd`, plus current build identity), companion `79b1c30` (prototype plus unified launcher). Stable branches are not promoted. The matching Dev implementation and companion feature branch are retained.

**Create clips** beside Prompt is now the single entry, offering **Timestamped dialogue (prototype)** and **Reference segments (fixed duration)**. Both options and focus return passed isolated browser checks; the chooser had zero scoped accessibility violations. The installed code passed the existing 68 companion JS, 5 mocked Python adapter, and 9 core JS checks. ComfyUI was restarted through its Manager endpoint only after confirming the queue was empty. The restarted API exposes `TWLDialogueTranscribe` with the installed Qwen options. Qwen model directories are present; real model loading/inference remains untested.

Live ComfyUI browser verification used a detached temporary H3 node in an isolated browser: exactly one launcher appeared, both mode choices were present, the dialogue dialog opened with the matching creation API, and missing-source/graph prerequisites were shown. The workflow graph was unchanged, and the queue remained empty. The live dialog had zero scoped accessibility violations with manual contrast-review items. No ASR or GPU render was submitted, and no user project was edited. The user should hard-refresh their own ComfyUI tab (Ctrl+F5) to load the frontend, then test **Create clips -> Timestamped dialogue (prototype)** with a loaded audio recording.

The user clarified that fixed-duration ranges are inadequate as the defining music-video workflow too. Future shared planning should separate boundary strategy (reviewed dialogue/lyric/manual timestamps, later optional beats/sections), source role (locked soundtrack versus audio/video reference), and visual shot/camera design. Fixed ranges remain a fallback. The current prototype builds spoken-dialogue prompts; a general dynamic music-video/reference planner and singing-specific prompt policy are not yet implemented. See the dialogue roadmap's activation/timing clarification.

### Earlier implementation checkpoint (before activation)

The user reported successful Simon zoom rendering across all clips: generally better holding and usable output, with some green tint and darker contrast. This is user-reported output evaluation; the tint/contrast cause has not been diagnosed.

The user authorized pushing outstanding work and resuming the timestamped dialogue creator on 2026-10-22. Both installed v1.4.6 integration branches are now published: core `d11087b`, companion `57bf543`. The two dialogue planning commits through `a3f0c88` were also pushed. At that earlier checkpoint, installed repositories were still on the pre-prototype integration baselines; the activation follow-up above supersedes that state. No stable promotion or GPU job was performed.

Dialogue prototype implementation is in the separate core Dev planning worktree (`TWL-ComfyUI-CGlide-Dev`, now merged with the evaluated v1.4.6 baseline) and companion `C:\Users\steven\Documents\CGlide-Dialogue-Dev` worktree (`feature/timestamped-dialogue`). Matching implementation commits: core `fd8acbd`; companion `e9b846b` (creator implementation `99e6e9b` plus precision/tail clarification). These matching changes are now installed as described in the activation follow-up above.

Implemented: SRT/Qwen timestamp file import/paste and editable review, absolute-time transcript export, optional explicit queued Qwen transcription with genuine word alignment, idle-queue and project-render guards, safe cancellation/stale-result handling, speech-aware H3 frame-grid planning under an 8-second ceiling including overlap, locked Timeline source windows, editable per-clip prompts, project JSON export, and atomic new-project creation with one Revert backup. Shared authored prompt structure is preserved with an explicit `{{dialogue}}` insertion marker; old spoken dialogue must be removed by the user. Nonempty-project append is intentionally unsupported.

Core additions are narrow authoritative commands (`creationSnapshot`, `isRendering`, `createProject`) and saved project `timing` metadata. The snapshot covers source/project state, song, overlap and required graph wiring. New projects record 24 fps and 22/39-frame overlap; native JSON/pack export, import, settings and Revert preserve it. Creation requires the audio VAE, a direct H3 Studio `locked_audio` -> Glide Join connection, and disabled `+ look`. It retains user generation settings and does not queue rendering. A new dialogue project excludes a master song; its special Revert snapshot restores the previous song as well as clips and timing.

Verification on 2026-10-22: **68 companion JavaScript tests, 5 mocked backend Python tests, and 9 core creation/integration JavaScript tests passed**. Synthetic source-sample planning checks cover both overlap settings; these model timing metadata and do not execute the actual GPU audio path. Isolated browser fixtures checked transcript entry, multi-clip preview, edited-prompt export/create, stale-clock refusal, idle-queue waiting/cancellation, source-change warnings, UTF-8 file import/refusal, and a mocked aligned-ASR response with an explicit source offset. Scoped accessibility: zero violations, with manual contrast-review items. JavaScript syntax and whitespace checks passed. **Real Qwen inference, real ComfyUI project loading, saved-project GPU rendering, lip sync, sample placement and long-chain output quality remain unvalidated.** The final frame-grid allowance is displayed as an unheld audio tail, not guaranteed silence; H3 may generate sound there, so trim it in post against the source. Text transcript exports preserve supplied precision; SRT uses milliseconds. H3 audio latents have a 40 Hz clock; measure actual joins against the original recording. Do not describe the prototype as render-tested.

Next: evaluate the matching prototype builds with a short saved Simon test project. Compare locked Timeline audio with Song mode before treating Timeline as an established default. Check missing-model errors and one explicit Qwen transcription, source offset, word alignment, export/reload at 22 and 39 frames, and Revert. Render at least three linked clips and assess original audio, skipped/repeated words, lip sync, continuity, and tint/contrast separately. Do not interrupt ongoing rendering, change installed branches, or restart ComfyUI without the relevant user instruction.

Read this section first in a new session, then the roadmap's latest implementation checklists and symbol-based conflict inventory. Earlier dated decisions explain history; they do not override later explicit decisions or the current implementation.

### Historical baselines through 2026-10-17 (superseded above)

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

> Continue CGlide/TWL from the 2026-10-22 handoff in the separate Dev planning worktree. Read the current README, dialogue roadmap, core conflict inventory and companion feature README. The installed integration branches remain on the evaluated v1.4.6 baseline; the matching dialogue prototype is on core Dev and companion feature/timestamped-dialogue. Do not switch installed branches or restart/interrupt rendering without my instruction. My next evaluation result/request is: [describe it].

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
