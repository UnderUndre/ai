# Contributing

## Quick Start

```bash
git clone https://github.com/UnderUndre/ai.git
cd ai/packages/cli
npm install
npm test
```

## Development

| Command | What |
|---------|------|
| `npm run build` | Compile TS |
| `npm test` | All tests |
| `npm run test:unit` | Unit only |
| `npm run test:integration` | Integration only |
| `npm run validate` | Type-check |

## Branch Strategy

- `main` — stable, always passes CI
- Feature branches: `type/short-description` (e.g., `feat/cursor-transformer`)
- PRs into `main`, squash merge

## Commit Conventions

```
type(scope): subject
```

Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `perf`

See `.github/instructions/coding/git/copilot-instructions.md` for full rules.

## Adding a Transformer

1. Create `src/transformers/your-transformer.ts` implementing `TransformerFn`
2. Register in `src/transformers/registry.ts`
3. Add golden test fixtures in `tests/fixtures/golden/`
4. Add unit test in `tests/unit/transformers/`
5. Update README with new transformer entry

## Adding a CLI Command

1. Create `src/cli/your-command.ts` with `defineCommand`
2. Register in `src/cli.ts` subCommands
3. If mutating: add to `MUTATING_COMMANDS` set and use `guardMutatingCommand`
4. Add integration test

## Code Style

- TypeScript strict mode, ESM
- No `any` — use `unknown` + type narrowing
- No `console.log` — use `consola`
- No empty `catch {}` — at minimum log a warning
- Forward-slash paths via `pathe`

## Testing

Every PR must pass `npm run validate && npm test`. Golden tests use fixtures in `tests/fixtures/` — update them when transformer output changes.

## Issues

Use GitHub issues. Label with `bug`, `feature`, `docs`, or `transformer`.
