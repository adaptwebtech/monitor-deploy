#!/bin/bash
# Block Write/Edit outside a git worktree.
GIT_DIR=$(git rev-parse --git-dir 2>/dev/null)
GIT_COMMON=$(git rev-parse --git-common-dir 2>/dev/null)

if [ -z "$GIT_DIR" ]; then
  exit 0
fi

if [ "$GIT_DIR" = "$GIT_COMMON" ]; then
  echo "BLOCKED: Not in a git worktree. Call EnterWorktree first, then retry the edit." >&2
  exit 1
fi
