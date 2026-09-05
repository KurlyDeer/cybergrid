# v1.3.8 security and performance audit

Audit date: 2026-09-05. This is a scoped engineering review and regression run, not an independent penetration test or a guarantee of crash-free operation.

## Changes and checks

- All three application BrowserWindow creation sites use the shared hardened preferences: context isolation, sandboxing and web security enabled; Node integration, subframe/worker Node integration, remote-module access, insecure mixed content and webview tags disabled. Embedded web consoles use a separate sandboxed WebContentsView without the application preload.
- IPC requires the expected WebContents, its top-level sender frame and the exact expected local page URL. An iframe, navigated page or unrelated window is rejected even if it knows a channel name. Renderer calls remain on the typed CyberGridApi context bridge; raw ipcRenderer and IPC event objects are not exposed.
- Updater UI uses textContent, not remote HTML, and no updater path calls native message-box APIs. Update downloads remain opt-in; restart requires an explicit action (previously downloaded updates can still install on normal quit). Checks coalesce, download progress is throttled and duplicate errors are suppressed. File selectors, exit confirmations and emergency crash dialogs remain native.
- Terminal and WebGL resources are disposed before disconnect IPC, including when that request stalls. Renderer disposal is idempotent. Detached windows remove event subscriptions, resize observers and queued frames on unload. Closed-session events are discarded; pre-attachment data queues and retired-session identifiers have explicit limits.
- RDP geometry updates coalesce for 150 ms and cancel on teardown; duplicate bounds/visibility changes do not repeatedly invoke Win32. Initial docking and tab visibility changes still apply immediately. Tests use mocked native bindings: live mstsc docking across monitors/DPI/GPU configurations is not verified by this run.
- Compatible build-tool dependency patches: fast-uri 3.1.5 → 3.1.7 and @xmldom/xmldom 0.8.13 → 0.8.15. Both full and production-only npm audits report zero known advisories at the audit date. This describes the registry advisory database at that time, not all possible vulnerabilities.
- Checked source for recognizable private-key blocks and common access-key/token formats; none were found. Git tracking checks exclude executable outputs, logs, databases, .env files and dependency directories. Pattern scans cannot prove the absence of every possible secret.

## Regression commands

```powershell
npm run typecheck
node scripts/test-updater-security-performance.cjs
node scripts/test-terminal-renderer.cjs
node scripts/test-health-preferences.cjs
node scripts/test-diagnostics-reports.cjs
node scripts/test-session-log.cjs
npm run build
npx electron scripts/test-terminal-ui.cjs
npm run build
npx electron-builder --win
```

The UI suite uses an isolated temporary profile and synthetic IPC, not real credentials or network hosts. It verifies all six themes, modal safety/keyboard dismissal, passive notification expiry, narrow-window sidebar geometry, persistence/rollback and immediate terminal disposal. Its intentional "Simulated disk failure" message tests preference rollback. Rebuilding after UI tests removes test bundles and screenshots before packaging.

## Remaining operational risks

- Windows binaries are unsigned until an Authenticode certificate is configured. Check published hashes and origin; do not treat a successful build as a trust verdict.
- Existing self-signed certificate bypass is scoped to embedded web-console contents, not updater or application pages. It still weakens server authentication for those consoles; use only trusted management networks.
- Legacy SSH algorithms and external tools/scripts are administrator-enabled capabilities with inherent risks. RDP cmdkey injection uses argument arrays (not shell interpolation), but passwords can still be visible to sufficiently privileged local process inspection while cmdkey runs.
- Session logs/backups and clipboard content may contain operational secrets. Existing bug reporting is user-initiated with a redacted preview; no background report submission was added.
- Testing does not perform a real self-update/restart or contact live infrastructure. The updater event lifecycle, native resize scheduling and UI flows are covered with controlled fixtures.
