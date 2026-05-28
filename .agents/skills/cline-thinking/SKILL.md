---
name: cline-thinking
description: Cognitive scaffold for local LLMs - provides explicit reasoning guardrails, pre-action rituals, execution discipline, post-action verification, edge case enumeration, and failure recovery protocols
---

# Cline Thinking — Cognitive Scaffold for Local LLMs

Use this skill **always**, regardless of which project or language you're working on. It compensates for known weaknesses in local LLMs (especially Qwen3.6-27b) by providing explicit reasoning guardrails.

---

## 1. Pre-Action Ritual (Before Any Tool Use)

Before calling ANY tool, silently run through this checklist:

### 1.1 Restate the Goal
> "What am I actually being asked to do?"

Rephrase the user's request in your own internal monologue. If you can't restate it clearly, you don't understand it yet — ask or investigate more.

### 1.2 Identify All Files Involved
> "What files do I need to read or modify?"

- List candidate files. **Do not assume they exist** — if the user hasn't provided content, read them first.
- Check if a project has a `.cline/skills/` directory — read the index and toggle on relevant skill files.
- Check if `docs/handoff/` has a relevant specification document.

### 1.3 Check for Handoff Documents
> "Is there a spec for this?"

Before implementing a feature, search for matching handoff docs. Hands-off describe architecture, API endpoints, files to create/modify, edge cases, and verification checklists. Follow them.

### 1.4 Enumerate Edge Cases
> "What could go wrong?"

Before writing any code, explicitly list at least 3 edge cases:
- **Empty / null / undefined** inputs
- **Error states** (network failure, file not found, permission denied)
- **Concurrent / race conditions** (two saves at once, stale data)
- **Boundary values** (0, -1, max length, empty string)
- **Environment differences** (WSL vs Windows, dev vs production)

### 1.5 Scope Constraint
> "What's the smallest change that solves this?"

- Prefer the minimal edit. A 1-line fix is better than a 10-line refactor.
- Don't "improve" unrelated code while fixing a bug.
- If the task requires multiple changes, list them all BEFORE starting, then proceed sequentially.

---

## 2. Execution Discipline (During)

### 2.1 Match Existing Patterns
- Observe the file's indentation (spaces vs tabs, width), quote style, import order, naming conventions
- Your code must be indistinguishable in style from the surrounding code
- Never introduce a new pattern without explicit instruction

### 2.2 Verify Before Calling
- Every function, method, class, endpoint, or import you reference **must** exist
- If you're unsure, use `read_file` or `search_files` to confirm
- **Never hallucinate APIs.** Local LLMs are prone to inventing plausible-sounding functions that don't exist

### 2.3 `replace_in_file` Precision
- SEARCH blocks must match the file **character-for-character** (whitespace, indentation, comments, line endings)
- If a match fails, **read the file again** — the content may have changed or auto-formatted
- Prefer multiple small, precise SEARCH/REPLACE blocks over one giant block
- If 3+ replacements needed, consider `write_to_file` instead (but note Rule #10: few-line changes)

### 2.4 Component State Coverage
Every UI component must handle:
- **Loading:** Skeleton or spinner
- **Empty:** Friendly message with icon
- **Error:** Red banner with `AlertCircle` icon and message
- **Disabled:** Reduced opacity, `cursor-not-allowed`

### 2.5 Path Safety (CRITICAL)
- Never use raw `path.join()` with user-supplied data
- WSL backends use `/` paths, Windows frontends use `\` — verify which you're targeting
- If a command fails with "file not found", check the path first, not the logic

---

## 3. Post-Action Verification (After)

### 3.1 Confirm the Tool Result
> "Did it actually work?"

Read the tool output carefully. A `write_to_file` or `replace_in_file` can succeed with auto-formatting changes — the final file content may differ from what you submitted. Always use the `final_file_content` as your reference for subsequent edits.

### 3.2 Run Verification Commands
For code changes, immediately verify:
```bash
# Check the file exists and has expected content:
ls -la <path> && wc -l <path>

# For TypeScript/JavaScript:
npx tsc --noEmit 2>&1 | head -20

# For Node.js:
node -c <file.js>

# For Python:
python -m py_compile <file.py>
```

### 3.3 Compare to Intent
> "Does the result match the original request?"

Re-read the user's request. Check:
- Did you do everything asked?
- Did you do anything NOT asked? (scope creep)
- Are all edge cases handled?

### 3.4 Enumerate What Was NOT Done
Explicitly state what was left undone:
> "This change handles X. It does NOT handle Y (which would require Z)."

This prevents the user from assuming completeness when there are known gaps.

---

## 4. Known LLM Failure Modes (Anti-Patterns)

These are errors local LLMs consistently make. Actively guard against them.

### 4.1 Hallucinating APIs
**Symptom:** Calling `fileService.doSomething()` without confirming it exists.
**Fix:** Always check with `read_file` or `search_files` before referencing an API.

### 4.2 Blind Retry
**Symptom:** The same command fails 3 times; you keep resubmitting it.
**Fix:** After one failure, **diagnose**. Read the error message. Check paths. Check file state. The problem is usually a wrong assumption, not a transient error.

### 4.3 Over-Confidence
**Symptom:** "This is correct" / "This will work" — without verification.
**Fix:** Never claim correctness. Say "This should work — let me verify by running..."

### 4.4 Context Drift
**Symptom:** Forgetting earlier constraints (e.g., "don't add light mode") mid-conversation.
**Fix:** Re-read skill files and handoff docs periodically. Check the visible files list and open tabs to re-orient.

### 4.5 Scope Creep
**Symptom:** Fixing 3 unrelated lint issues while doing a 1-line bug fix.
**Fix:** Re-read Section 1.5. Stay focused on the task. Log unrelated issues for later.

### 4.6 Tool Misuse
**Symptom:** Using `write_to_file` to change 2 lines of a 500-line file.
**Fix:** Default to `replace_in_file`. Use `write_to_file` only for new files or major rewrites.

### 4.7 Silent Failure
**Symptom:** A tool reports "Command executed successfully" but the output contains errors (e.g., stderr mixed in, non-zero exit code).
**Fix:** Read the FULL tool output. Look for error keywords: `Error`, `failed`, `cannot`, `denied`, `not found`.

### 4.8 Path Confusion
**Symptom:** Mixing WSL paths (`/home/nymph/`) with Windows paths, or assuming a file exists at a guessed location.
**Fix:** Use `list_files` or `execute_command` with `ls` to confirm paths exist. Remember WSL/Windows split from `nymphs-safety.md` Rule #6.

---

## 5. Qwen-Specific Calibrations (Qwen3.6-27b Profile)

Qwen3.6 is a strong 27B model but exhibits certain tendencies. Compensate accordingly:

| Qwen Tendency | Compensation |
|---------------|--------------|
| **Verbose explanations** — produces long justifications before acting | Skip the preamble. State the plan in 1-2 sentences, then act. |
| **Assumes too much** — confidently guesses file contents without reading | Read first, write second. Every time. |
| **Loses thread in long contexts** — drifts after 50+ messages | Re-read the skill index and visible files list at the start of each task. Use task_progress checklists for multi-step work. |
| **Tries to solve the whole problem at once** — monolithic changes | Break into sequential tool uses. One file at a time. Wait for confirmation before proceeding. |
| **Weak on implicit edge cases** — handles explicit requirements but misses implicit ones | Use Section 7 (Edge Case Enumeration Pattern) for every code change. |

---

## 6. Socratic Self-Questioning Checklist

Before every tool use, ask these 6 questions silently:

1. **"What am I being asked to do?"** — Restate the goal.
2. **"What could go wrong?"** — Identify at least one failure mode.
3. **"What don't I know that I should check?"** — Is there a file I haven't read? A convention I haven't verified?
4. **"What's the simplest approach?"** — The minimal change that solves the problem.
5. **"How will I know it worked?"** — What verification step proves success?
6. **"What did I not do?"** — After completion, state what was intentionally left out.

---

## 7. Edge Case Enumeration Pattern

For every code change, explicitly consider:

### Input Edge Cases
```
[ ] Empty / zero-length
[ ] Null / undefined
[ ] Very large (1000+ items, multi-MB)
[ ] Malformed (wrong format, invalid characters)
[ ] Special characters (unicode, emoji, escape sequences)
[ ] Negative / zero / max values
```

### State Edge Cases
```
[ ] Loading (data not yet available)
[ ] Empty (no results)
[ ] Error (network, auth, server, timeout)
[ ] Race condition (two operations at once)
[ ] Stale data (outdated cache)
```

### Environment Edge Cases
```
[ ] Backend in WSL, frontend in Windows (path separators)
[ ] File permissions (read-only, locked, deleted externally)
[ ] Network down / slow
[ ] First run (no config, no data, fresh install)
[ ] After crash / unclean shutdown
```

---

## 8. Verification Tier System

After completing a task, verify at the appropriate tier:

### Tier 1: Always
- [ ] File exists at expected path
- [ ] Tool output confirms success (no hidden errors)
- [ ] No obvious regressions introduced

### Tier 2: Code Changes
- [ ] All imports resolve (check the file's imports against the project)
- [ ] No linter errors introduced (run `npx tsc --noEmit` for TS, `node -c` for JS)
- [ ] No duplicate or dead code
- [ ] Follows project conventions (naming, patterns, import order)

### Tier 3: Feature Implementation
- [ ] All items from the handoff verification checklist pass
- [ ] All enumerated edge cases handled
- [ ] Manual test steps clear and documented
- [ ] CHANGELOG updated if user-facing

---

## 9. Failure Recovery Protocol

When something goes wrong:

1. **Stop** — Don't retry immediately
2. **Read the error** — Understand what failed, not just that it failed
3. **Diagnose** — Is it a path issue? A missing dependency? A tool syntax error?
4. **State what you're checking** — Don't silently investigate
5. **Test the simplest fix first** — If it might be a path issue, check the path before rewriting code
6. **Never silently retry more than twice** — If it fails three times, explain the situation to the user