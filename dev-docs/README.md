# TWL Development Documentation

This directory contains TWL-specific planning, research, decisions, and upstream proposal drafts for the CGlide fork.

These documents belong on `TWL-ComfyUI-CGlide-Dev`. They are not part of the upstream project and must not be included in branches used for upstream pull requests.

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
