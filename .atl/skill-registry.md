# Skill Registry — App para pedirme

Generated: 2026-04-17

## Project Context

- **Stack**: Next.js 16 + React 19 + TypeScript 5 + Tailwind v4 + Supabase + Google Maps
- **Testing**: None configured — Strict TDD unavailable
- **Linter**: ESLint 9 (`npm run lint`)

## User Skills

| Skill | Trigger Context |
|-------|----------------|
| `go-testing` | Go tests, Bubbletea TUI testing |
| `branch-pr` | Creating a pull request, opening a PR |
| `issue-creation` | Creating a GitHub issue, reporting a bug |
| `skill-creator` | Creating a new AI skill |
| `judgment-day` | Adversarial review, "judgment day", "dual review" |

## Compact Rules

### branch-pr
- Always create an issue first before a PR
- Follow conventional commits (no AI attribution)

### issue-creation
- Issue title: imperative, ≤70 chars
- Include reproduction steps for bugs

### General (from AGENTS.md + CLAUDE.md)
- Clean architecture — separation of concerns
- Code in English, comments in Spanish
- Prioritize simplicity and performance
- No test suite — validate via `npm run lint` and `tsc --noEmit`
- Never run `npm run build` after changes
