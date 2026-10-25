# Local companion workspace instructions

This is the installed `ComfyUI-CGlide-TWL` runtime repository. Resolve Documents with `[Environment]::GetFolderPath('MyDocuments')` and read `<Documents>\Projects\dev\CGlide\AGENTS.md` for the development directory map and session entry points.

The companion dialogue development worktree is `<Documents>\Projects\dev\CGlide\CGlide-Dialogue-Dev`; the core Dev handoff is `<Documents>\Projects\dev\CGlide\CGlide-Dev-Planning\dev-docs\README.md`. Read this checkout's README too when diagnosing installed behavior. Core branch rules apply to the core repository, not automatically to this companion.

Check `git worktree list --porcelain` and `git status --short --branch` before edits. Development worktrees share this repository's Git metadata. Preserve unrelated changes and do not switch installed branches, restart ComfyUI, interrupt renders, or queue GPU jobs merely to inspect development work. Keep this agent file local and untracked.