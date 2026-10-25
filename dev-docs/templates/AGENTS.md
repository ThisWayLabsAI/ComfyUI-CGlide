# Repository Working Rules

## Branch roles

- `main` must remain an exact mirror of `upstream/main`.
- Do not commit directly to `main`.
- TWL implementation work belongs on `TWL-ComfyUI-CGlide-Dev`.
- Promote tested TWL changes selectively to `TWL-ComfyUI-CGlide`.
- Create upstream pull-request branches directly from `upstream/main`.
- Never merge a TWL branch into an upstream pull-request branch.

## Upstream pull-request hygiene

Before preparing an upstream pull request, run:

```powershell
git fetch upstream
git diff --name-status upstream/main...HEAD
git log --oneline --no-merges upstream/main..HEAD
```

Upstream pull requests must not contain:

- `dev-docs/`
- Agent or session documentation
- TWL branding or private customizations
- Merge commits from TWL branches
- Unrelated formatting changes

## Customization architecture

- Prefer a separate `ComfyUI-CGlide-TWL` companion extension.
- Keep changes to upstream files limited to small, generic extension seams.
- Do not implement TWL features directly inside `web/csglide_cast.js` when they can live in separate TWL files.
- Treat `node.properties.gcast_project`, UI closures, and undocumented object fields as private implementation details.
- Do not expose mutable internal state as a public extension API.

## High-conflict files

Review upstream changes carefully in:

- `web/csglide_cast.js`
- `csglide_cast.py`
- `csglide_seed.py`
- `__init__.py`
- `pyproject.toml`

Review the symbol-based conflict inventory in `dev-docs/roadmaps/cglide-customization-roadmap.md` before resolving changes in these areas.

## GitHub workflows

- The Publish and Release workflows are disabled in the fork's GitHub repository settings.
- Do not delete or modify inherited workflow files merely to disable them.
- Do not add registry credentials without explicit user authorization.

## Development documentation

- Version maintained planning documents under `dev-docs/` only on the Dev branch.
- Keep raw sessions and temporary scratch output local and untracked.
- Never place secrets or confidential material in the public fork.

## Local worktree locations

Resolve the Windows Documents known folder with `[Environment]::GetFolderPath('MyDocuments')`. The CGlide development workspace is `<Documents>\Projects\dev\CGlide`; read its `AGENTS.md` for the directory map before choosing a checkout. The old `<Documents>\CGlide-*` locations were moved on 2026-10-24.

- Core Dev planning/code: `CGlide-Dev-Planning` under that workspace. Its `dev-docs/README.md` is the current development handoff; use it even when the installed checkout has an older handoff.
- Companion dialogue development: `CGlide-Dialogue-Dev` under that workspace.
- Image continuation experiment: `CGlide-Experiments/h3-image-continuation` under that workspace.
- Installed runtime checkouts remain `ComfyUI/custom_nodes/ComfyUI-CGlide` and sibling `ComfyUI-CGlide-TWL`. Check the intended installed or development companion explicitly; the relocated Dev folders are not an installed sibling pair.

These development folders are linked Git worktrees sharing the installed repositories' Git metadata. Inspect `git worktree list --porcelain` and `git status --short --branch` in the relevant repositories; verify current branches rather than relying on historical handoffs. Do not delete the installed repositories, recreate the old paths, or switch installed branches merely to locate development work.

## Worktree safety

- At the start of a new session, read `dev-docs/README.md` for the dated handoff and then the roadmap's current checkpoint and conflict inventory. Check the sibling companion repository's README and worktree too. Historical plans must not override later decisions; unvalidated renders must not be reported as tested.

- Preserve unrelated user changes in a dirty worktree.
- Before switching or integrating branches, inspect `git status --short --branch`.
- Do not use destructive Git commands to resolve branch or worktree problems.
