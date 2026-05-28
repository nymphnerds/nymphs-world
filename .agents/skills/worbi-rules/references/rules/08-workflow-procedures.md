# Workflow Procedures

These workflow procedures apply to ALL tasks.

## Before Making Changes

- [ ] Restate the goal in your own words
- [ ] Identify all files involved — **READ them first**, don't assume contents
- [ ] Enumerate at least 3 edge cases that could go wrong
- [ ] Determine the smallest change that solves the problem

## During Changes

- [ ] Make changes in **small batches** — one file at a time
- [ ] When editing large files: make a `.new` copy first, edit the copy, verify it's correct, then overwrite the original
- [ ] Match existing code style (indentation, quotes, import order, naming)
- [ ] Verify every API/function you reference **actually exists** (read the file, don't hallucinate)
- [ ] Only use MCP servers to look up correct syntax when unsure
- [ ] Monitor context window usage — be aware of remaining tokens with large files

## After Changes

- [ ] Verify the tool result — read the final file content (auto-formatting may have changed it)
- [ ] Run verification with the project's equivalent (`npx tsc --noEmit` for TS, `node -c` for JS, etc.)
- [ ] Compare result to the original request — did you do everything asked, nothing extra?
- [ ] State what was **NOT** done (known gaps)

## Plan-to-Act Handoff (MANDATORY)

**Context:** Different AI models are used for Plan mode and Act mode. Act mode has no memory of the Plan mode conversation. You MUST write a detailed handoff before asking the user to toggle to Act mode.

### When to Write a Handoff
- Whenever the plan involves code/file changes that will be executed in Act mode
- Before asking the user to "toggle to Act mode"

### Handoff Format

Include the following sections, formatted as a clear markdown block:

```markdown
## Handoff: <Brief Title of Task>

### Goal
One-sentence summary of what needs to be done.

### Files to Edit
- `<path>` — what change to make in this file
- `<path>` — what change to make in this file

### Current Code Context
What the relevant code looks like NOW (include key snippets so Act mode can find the exact location).

### Change to Make
Exact instructions. Include SEARCH/REPLACE descriptions, line numbers, or code blocks.

### Edge Cases
1. Edge case 1
2. Edge case 2
3. Edge case 3

### Verification
How to verify the change is correct after applying.
```

### Rules
- **NEVER** ask the user to toggle to Act mode without including a handoff
- **NEVER** assume Act mode will remember the Plan mode conversation
- **ALWAYS** include enough context for Act mode to execute without asking clarifying questions
- **ALWAYS** read the files first to include accurate current code context in the handoff
- Keep the handoff self-contained — Act mode should be able to execute it blindly
