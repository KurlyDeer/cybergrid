# Contributing to CyberGrid

CyberGrid welcomes focused fixes, accessibility improvements, tests, and sysadmin workflow features.
Open a feature request before making a large architectural change. Search existing issues before reporting a bug.

## Fork and develop

1. Fork [KurlyDeer/cybergrid](https://github.com/KurlyDeer/cybergrid) on GitHub.
2. Clone your fork and create a feature branch:

   ```powershell
   git clone https://github.com/YOUR-ACCOUNT/cybergrid.git
   cd cybergrid
   git switch -c fix/descriptive-name
   npm install
   npm run build
   npm start
   ```

Use Node.js 22 and npm, matching CI. Windows packaging and native RDP require Windows.
Native dependencies may require Python and Visual Studio Build Tools with the C++ desktop workload.
`npm install` rebuilds the configured native dependencies; commit `package-lock.json` when changing dependencies.
Do not run the app as Administrator unless the specific diagnostic operation requires it.

## Checks before a pull request

```powershell
npm run typecheck
npm run build
node scripts/test-health-preferences.cjs
node scripts/test-diagnostics-reports.cjs
node scripts/test-session-log.cjs
node scripts/test-terminal-renderer.cjs
npx electron scripts/test-terminal-ui.cjs
git diff --check
```

There is currently no separate `lint` script. Follow the existing TypeScript style and fix unused declarations
reported by typecheck. Test UI changes at small window sizes, with keyboard navigation and light/dark themes.
Run the Electron UI test after building; it uses isolated temporary data and mock IPC, not your vault.
Its generated test assets are ignored. Run a clean build again before packaging:

```powershell
npm run build
npx electron-builder --win --publish never
```

Keep changes small, include a regression test, and document any checks you could not perform.
Do not claim production remote-device coverage from mocks or loopback tests.

## Security and privacy

- Never commit `.env`, credentials, private keys, vaults, session transcripts, `node_modules`, `build`, `dist`, or installers.
- Validate IPC input in the main process and accept messages only from trusted application frames.
- Keep context isolation enabled and Node integration disabled. Render external data with `textContent`, not HTML.
- Bound sockets, DNS, timers, and output size; clean up on errors, cancellation, and window closure.
- Bug reports are public. Review and redact logs manually even when using **Help > Report a Bug**.
- Do not disclose exploitable security issues publicly. Use GitHub's private vulnerability reporting if enabled;
  otherwise request a private contact channel without posting exploit details.

## Open the PR

Commit and push your branch to your fork, then use **Compare & pull request** on GitHub targeting `main`.
Complete the PR checklist, describe behavior and risks, link relevant issues, and include sanitized screenshots
for UI changes. Wait for CI and review; do not force-push release tags or publish release assets from a feature PR.

Contributions are provided under the repository's [MIT License](LICENSE).
