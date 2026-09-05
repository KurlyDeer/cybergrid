## Summary

Describe the change, motivation, and linked issue (if any).

## Verification

List tests executed and results. For UI changes, attach screenshots with sensitive data removed.
Describe manual checks and anything not tested.

## Developer checklist

- [ ] Read [CONTRIBUTING.md](../CONTRIBUTING.md).
- [ ] Linting/style reviewed; `git diff --check` passes (no separate lint script is currently configured).
- [ ] TypeScript checks pass: `npm run typecheck`.
- [ ] Build passes: `npm run build`.
- [ ] Relevant automated tests pass; regression coverage added where practical.
- [ ] No secrets, personal logs, vaults, dependencies, or generated binaries are committed.
- [ ] IPC inputs are validated, external data is rendered as text, and network operations are bounded.
- [ ] Documentation and user-visible behavior are updated as needed.

## Risks / compatibility

Mention Windows/native-module considerations, migrations, and rollback behavior.
