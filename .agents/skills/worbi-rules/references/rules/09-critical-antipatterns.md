# WORBI — Critical Anti-Patterns

These rules apply to ALL tasks in this project. Violation = failed task.

## NEVER DO

- **NEVER** push to GitHub without explicit user instruction
- **NEVER** hallucinate APIs — read the file to confirm the function/method exists
- **NEVER** assume file contents — read first, write second
- **NEVER** chain commands with `&&` (causes crashes)
- **NEVER** silently retry a failed command more than 2 times — diagnose instead

## WORBI-Specific — NEVER DO

- **NEVER** introduce new dependencies without updating `package.json`
- **NEVER** add light mode or theme switching
- **NEVER** add icon libraries other than `lucide-react`
- **NEVER** use inline `<style>` tags or CSS modules — use `globals.css`
- **NEVER** pipe commands to tail or head, output is to be in terminal only
- **NEVER** use outdated skill names (`worbi-architecture`, `worbi-ui` — converted to `.clinerules/` rules in v7)

## Logging Policy

- **Do NOT `cat` log files** without asking the user first — the user will either permit it or paste the output
- If you need to check logs, ask the user and they will provide the relevant output