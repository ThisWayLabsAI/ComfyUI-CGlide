# Timestamped dialogue clip creator

Requested: 2026-10-20. Status: **planned; deferred until the user's current rendering tests are finished**. Documentation only; implementation and GPU evaluation have not started.

## Objective

Create a Simon-style talking-head project from one audio recording, a timestamped transcript, and shared visual instructions. Automatically prepare editable clips, their dialogue prompts, and audio windows. Choose natural speech boundaries while enforcing a hard maximum generated duration per clip, initially 8 seconds.

This extends the existing fixed-range reference batch creator. It is not the upstream Song mode's equal-duration layout: timestamps and speech boundaries determine this plan.

## Confirmed requirements

### Inputs and transcript validation

- Accept an accessible audio recording and either an SRT transcript or Qwen ASR's displayed `start-end: dialogue` lines. Times refer to the same source audio.
- Accept shared visual prompt content and image references for identity, setting, wardrobe, composition, camera, and performance style. Preserve the user's generation settings and selected reference slots.
- Accept a maximum generated duration, default 8 seconds. It is a ceiling, not a target that every clip must fill. Shorter valid clips are expected.
- Provide a dialogue-language setting, initially English for Simon, for the `<d>[English]...</d>` package.
- Validate finite ordered timestamps, positive cue lengths, source-duration bounds, empty cues, and unsupported overlapping speech. Preserve the transcript's words; no silent transcription correction or paraphrasing.
- Detect absent timestamps or plain-text fallback. A failed Qwen alignment must not be treated as valid timed input.
- Make the transcript's source offset explicit when ASR processed an excerpt. Never assume excerpt-relative times are full-recording times. Preview the resulting absolute audio windows.

### Speech-aware segmentation and duration

- Group adjacent short subtitle cues into useful clips, favoring sentence endings, punctuation, and pauses. Do not create a separate clip for every subtitle line by default.
- Preserve real gaps between cues instead of concatenating speech and losing silence. Review or represent long gaps explicitly.
- Every generated clip must satisfy `frame_count / fps <= maximum_seconds` on H3's actual supported frame grid. For the initial 8-second limit at 24 fps, no clip may exceed 192 generated frames.
- Count continuation overlap inside that maximum. A later linked clip's new material has less time available than its complete generated span. Do not budget 8 seconds of new dialogue and then add overlap above the limit.
- Use the authoritative core frame catalog/planner; distinguish full generated duration, first-to-last-frame span, source-audio coverage, overlap, and net new project duration.
- Split a passage that exceeds capacity at a supported word boundary when word timestamps are available. If only grouped cue times are available and no safe cut can be established, flag the passage for user review or improved alignment; do not invent word timestamps or truncate words.
- Fit boundaries to valid frames using available pauses where possible. Show any shift or necessary silence allowance explicitly. Do not silently move dialogue, drop words, or stretch the recording to fit.
- Handle very short tails by regrouping within the maximum, or flagging an unsatisfied plan. Minimal frame-grid allowance may be necessary; do not pad every clip to 8 seconds merely to fill it.

### Audio and linked continuity

- Derive each audio window from transcript timestamps and the planned source clock. Reuse the same audio file with numeric `start`, `end`, and full-source `dur`; physical audio splitting is unnecessary.
- For a linked chain, account for the actual configured overlap and its source-time mapping. Never restart the same audio region on every clip or confuse a subtitle's absolute source time with a clip-local placement time.
- Preserve all spoken content across the assembled result, in order, without duplicated or missing words at joins. Distinguish overlapping context needed for generation from the new dialogue contributed to the assembled project.
- Prefer an initial prototype with explicit per-clip Timeline audio windows and hold = 1, using the original recording rather than asking ordinary Reference audio to regenerate it. This is the proposed implementation direction, pending a short render comparison.
- Keep upstream Song mode as an alternative to evaluate: one master recording can work when its calculated clip positions agree with the transcript-derived plan. Do not layer Song mode and duplicate Timeline audio inadvertently.
- Validate the required audio VAE and H3 Studio `locked_audio` -> Glide Join path when preservation of the recording is selected. Surface unsupported graph configurations before creation or rendering.
- Treat original-audio preservation, lip sync, visual continuity, and timing as separate evaluation outcomes. Correct timing metadata alone does not prove satisfactory generated lip sync or seamless joins.

### Prompt construction

- Build every clip's editable prompt from the shared visual instructions plus the exact spoken dialogue assigned to its generation window, using the selected-language `<d>...</d>` format and consistent subject/speaker binding.
- Keep held-over dialogue as continuation context where needed; it must not be requested a second time as new speech. Define and test this mapping alongside overlap handling.
- Preserve authored sections, identity/environment/wardrobe roles, audio/music instructions, and source/reference-token assignments. Resolve conflicts explicitly rather than overwriting or stacking contradictory instructions.
- Timeline audio is locked soundtrack content, not an `@audioN` reference. Do not insert undefined audio-reference tokens when constructing prompts. Ordinary Reference audio, if later offered, needs a distinct prompt policy.
- Allow manual review of every prompt. Do not invent dialogue, automatically infer acting directions, or promise transcript-driven semantic scene generation.

### Preview, creation, and safety

- Preview all clips before applying: clip name, included transcript cues and exact dialogue, source start/end, placement, frame count, generated duration, overlap/context, net new duration, and all adjustments or warnings.
- Permit boundary/grouping and prompt corrections, then rebuild the preview. Mark invalid or over-limit rows clearly; refuse creation until required issues are resolved.
- Create clips only after an explicit apply action. Use one atomic, stale-guarded core operation and one project Revert snapshot. A changed source, prompt, reference set, timing plan, audio mode, or relevant project clock invalidates the preview.
- Default to a new reviewable test project or an explicitly chosen append destination. Do not silently replace the user's existing project. Specify append-clock behavior before supporting a nonempty destination.
- Refuse mutations while a project render owns the state. Creation must not automatically queue a render, change model weights, restart ComfyUI, delete media, or alter existing workflow files.
- Give clips unique IDs, useful names, and explicit link intent. Start with no inherited output history, stale continuation files, or automatic look/seam references; render-time chaining rebuilds what it needs.
- Support project JSON export with accessible source paths and all required timing/mode metadata. Explain that JSON alone does not bundle the audio or images. Preserve the saved project's reproducibility on reload.

## Qwen ASR input already available

The user's example workflow is `TWL - Speech To Text - QwenASR.json`, under `user/default/workflows/My Edited Workflows/audio/`.

- Its `AILab_Qwen3ASRSubtitle` node uses Qwen3 ASR with `Qwen3-ForcedAligner-0.6B-hf`.
- `SUBTITLES` currently emits grouped `12.34-15.67: spoken words` lines. The workflow splits by punctuation or pause, with a 0.6-second gap setting and 40-character grouping limit. These caption groups should be regrouped into generation clips.
- The workflow's `output_format = none` previews text without saving it. Selecting `srt` saves SRT; it does not change the displayed subtitle format.
- The separate plain ASR `TEXT` output has no timing. The subtitle node also falls back to plain text when alignment is unavailable, which the importer must detect.
- The installed extension has a separate forced-alignment node that exposes word timestamps. Its format and coordinate system should be assessed before relying on it for splitting oversized subtitle cues. Do not assume the existing subtitle output exposes each word's timing.

## Proposed implementation boundary

Keep the importer, pure segmentation/prompt planner, and review UI in `ComfyUI-CGlide-TWL`, alongside the existing reference batch modules. Reuse narrow core commands for authoritative timing, project creation, validation, persistence, and Revert. Extend those commands only where necessary; do not expose mutable internal project state.

Before implementation, inspect the evaluated v1.4.6 integration baseline. Confirm how the supported API exposes project song state, clip clock, configured overlap, and graph capabilities: the current workspace snapshot alone may not cover every field needed for stale validation. Documentation on Dev is not evidence that these new capabilities already exist there.

Keep this feature independent of the abandoned Image Carry experiment. Retain upstream latent hold for linked visual continuity where the graph supports it.

## Decisions to resolve after rendering tests

1. Compare explicit locked Timeline windows against one Song-mode master on a short, timestamped speech example. Verify sample placement, overlap behavior, and lip sync before choosing a default implementation.
2. Specify the exact mapping among transcript time, clip-local generation time, held overlap, and assembled output time, including frame-grid adjustment and unavoidable timing differences.
3. Choose the first boundary-editing UI and unsupported-cue recovery: regrouping, manual review, or importing word alignment. Keep ASR execution outside the initial creator.
4. Specify new-project/export behavior first; add nonempty-project append only when its clock and inherited song policies are explicit.

## Acceptance checks

- [ ] Equivalent SRT and Qwen grouped input produce the same dialogue assignment; a source offset is applied exactly once.
- [ ] Short cues group naturally; exact-limit, over-limit, silence-gap, invalid/overlapping cue, missing-timestamp, and tiny-tail cases are covered.
- [ ] All generated clips stay at or below 8 seconds, including overlap, through export/import and rendering. No rounding above the ceiling.
- [ ] Each prompt preserves shared instructions and the exact assigned dialogue, without undefined audio tokens or duplicated overlap speech.
- [ ] A synthetic recording with distinct words/markers demonstrates no skipped, repeated, or reordered content across at least three linked clips. Measure timing against the source and state any frame-grid tolerance explicitly.
- [ ] User evaluates a Simon-style recording for original-audio preservation, lip sync, join continuity, and longer-chain appearance stability. Metadata and mocked tests do not count as real-render validation.
- [ ] Preview/apply handles stale state, cancellation, atomic creation, Revert, running-render guards, and project export/reload without altering unrelated content.

Out of initial scope: automatic ASR execution, diarization or overlapping multi-speaker performances, automatic acting-direction generation, screenplay breakdown, beat/scene analysis, physical source splitting, and automatic rendering.
