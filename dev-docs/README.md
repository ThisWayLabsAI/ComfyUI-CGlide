# TWL Development Documentation

This directory contains TWL-specific planning, research, decisions, and upstream proposal drafts for the CGlide fork.

These documents belong on `TWL-ComfyUI-CGlide-Dev`. They are not part of the upstream project and must not be included in branches used for upstream pull requests.

## Current handoff — 2026-10-09

Read this section first in a new session, then the roadmap's latest implementation checklists and symbol-based conflict inventory. Earlier dated decisions explain history; they do not override later explicit decisions or the current implementation.

### Repositories and pushed code baselines

- Core fork: `C:\ComfyUI-Easy-Install\ComfyUI\custom_nodes\ComfyUI-CGlide`, branch `TWL-ComfyUI-CGlide-Dev`; latest source/planning baseline `4ddc8d4`, with timing/batch core commands in `34c0594`. Confirmed on origin on 2026-10-09.
- Companion: sibling `ComfyUI-CGlide-TWL`, branch `main`; latest baseline `b6d83a6`. Confirmed on origin on 2026-10-09. This is the separate companion repository's main, not the core fork's upstream-mirror main.
- The implementation was pushed on 2026-10-07. Neither core `main` nor the stable `TWL-ComfyUI-CGlide` branch was promoted by that push. Do not promote the latest additions until user render evaluation.
- These handoff documentation updates are local until explicitly pushed. Recheck both worktrees and remote tips at the start of future work; this snapshot is not a permanent assertion about Git state.

### Implemented and ready for user evaluation

- Focused Prompt Workspace with clip management, shared font controls, reference drawers, native autocomplete, prompt highlighting/status, reference copying, camera helpers, and undo-preserving insertion.
- Compact visual/audio reference templates and mode-specific starters. Existing authored prompt formats and opening instructions are preserved rather than silently converted.
- Project New choices: keep the visible clip, start completely clean, or cancel. Clean clears prompt/reference slots/continuation but keeps settings and graph wiring; native Revert backs up even an unlisted clip. Disk media is not deleted.
- Native audio/video Start, End, and Duration fields in decimal seconds. Continuation tails remain locked; effective video-reference frame counts still follow H3 rules.
- Companion **Batch clips** beside the Prompt heading: use a loaded audio/video reference in Omni mode, fixed source subranges, default 8-second segments, shared images/settings, keep/discard tail, and editable music-video/person-replacement/reinterpretation/custom templates. Preview, append with Revert, or export standalone `.h3proj.json`; no automatic render or file splitting.

### Verification and next work

`npm test` in the companion passed all **41 tests again on 2026-10-09**. Earlier isolated browser checks covered typed trim entry, template/token binding, audio/video batches, non-mutating export, invalid/stale append rejection, Revert, visible footer controls, and zero scoped accessibility violations. They used synthetic media references, not model renders. Syntax/whitespace checks passed during implementation. No ComfyUI restart, real generation, or browser retest was performed for this documentation-only handoff.

Immediate priority is user evaluation, not additional speculative features:

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
