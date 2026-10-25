# CGlide local development workspace

This directory was organized on 2026-10-24. These instructions apply to the relocated worktrees beneath it. Resolve Documents with `[Environment]::GetFolderPath('MyDocuments')`; the workspace is `<Documents>\Projects\dev\CGlide` (currently `C:\Users\steven\Documents\Projects\dev\CGlide`).

## Directory map

| Directory | Purpose | Git state recorded at migration |
| --- | --- | --- |
| `CGlide-Dev-Planning` | Core TWL development and maintained planning | `TWL-ComfyUI-CGlide-Dev` |
| `CGlide-Dialogue-Dev` | Companion timestamped-dialogue development | `feature/timestamped-dialogue` |
| `CGlide-Experiments/h3-image-continuation` | Preserved Image Carry experiment | Detached HEAD at `0cc31a8` |

The old directories directly under Documents no longer exist. Verify branches and worktree status at session start; the table is a dated observation, not an instruction to switch branches.

Installed runtime repositories remain:

- Core: `C:\ComfyUI-Easy-Install\ComfyUI\custom_nodes\ComfyUI-CGlide`
- Companion: `C:\ComfyUI-Easy-Install\ComfyUI\custom_nodes\ComfyUI-CGlide-TWL`

The relocated directories are linked Git worktrees sharing those installed repositories' object databases and metadata. Do not remove their parent repositories or treat them as independent clones. Use Git worktree commands for future relocation. Do not install duplicate custom-node packages from these development folders.

## Session entry points

1. Read `CGlide-Dev-Planning/dev-docs/README.md` for the latest dated handoff and its verification limits. Historical handoffs in installed or experimental checkouts may be older.
2. Read the core repository's local `AGENTS.md` and the Dev roadmap's current checkpoint and symbol-based conflict inventory before core work or integration. Core branch rules apply to the core repository; the companion has its own branches.
3. Read the intended companion checkout's `README.md`. For dialogue feature development this is `CGlide-Dialogue-Dev/README.md`; for runtime diagnosis also check the installed companion. These relocated worktrees are not named or arranged as the installed sibling pair.
4. Check `git worktree list --porcelain` from both installed repositories and `git status --short --branch` in every checkout you intend to edit. Preserve unrelated dirty files. Do not switch installed branches, restart servers, interrupt renders, or queue GPU jobs just to inspect development work.

Maintain planning documents under the core Dev worktree's `dev-docs/`. Keep upstream pull-request branches free of local agent files, session records, migration evidence, and TWL-only documentation. Do not commit this workspace-level guide into a worktree or alter global Codex configuration to locate these projects.

## Migration record

`MIGRATION-2026-10-24.txt` records the relocation, Git states and verification. `_migration-2026-10-24/` contains manifests, original documentation copies and test logs. These describe the migration snapshot; later authorized edits will naturally differ from its hashes. They are local records outside all worktrees.