# CyberGrid v1.3.9 verification

## Architecture

`src/main/rdp/native-host.ts` owns a per-session Electron utility process. Only PID/geometry/window-handle messages cross this boundary; passwords do not. `native-worker.ts` lazily loads Koffi and performs all user32 calls. The main-process interval is single-flight and has a separate deadline, so even a stalled native enumeration cannot prevent cancellation. Closing a session kills its helper immediately, then asynchronously terminates the exact owned mstsc process, removes temporary credentials, and deletes its RDP file. Application shutdown awaits this cleanup.

Moving a synchronous FFI call into `setInterval` alone would not make it non-blocking. Electron's [utility process API](https://www.electronjs.org/docs/latest/api/utility-process) supplies the isolation boundary. The repaint sequence uses [SetWindowPos](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setwindowpos) frame-change and asynchronous-position flags, followed by a one-pixel width nudge and redraw requests.

## Repeatable checks

Run from the repository root on Windows:

```powershell
npm run typecheck
node scripts/test-v139-core.cjs
node scripts/test-updater-security-performance.cjs
node scripts/test-terminal-renderer.cjs
node scripts/test-health-preferences.cjs
node scripts/test-diagnostics-reports.cjs
node scripts/test-session-log.cjs
npm run build
npx electron scripts/test-rdp-native-host.cjs
npx electron scripts/test-terminal-ui.cjs
# Remove test-only bundle fixtures/screenshots before packaging.
npm run build
npx electron-builder --win
npx electron scripts/test-rdp-native-host.cjs --packaged
```

Coverage includes default/custom IPv4 and IPv6 RDP addresses, serialized polling, bounded deadlines and cancellation, exact-PID selection, child styles and repaint ordering, bounded/sanitized command output, loopback TCP success/refusal, asynchronous credential cleanup, and command argument validation. The native-host smoke test loads real Windows Koffi and enumerates windows without attaching to any of them; a deliberately stalled helper checks that the Electron event loop remains responsive. UI tests exercise nine nested levels at 200/320/600-pixel sidebar widths, compact/full layouts, the typed context bridge, read-only diagnostic tabs and cancellation on close. Earlier updater, themes, terminal disposal, broadcast and diagnostics regressions also run.

For this release, typecheck, all listed regressions, the clean build and Windows packaging passed. Native helper execution was also checked from the packaged `app.asar`. Packaged main/preload/renderer/worker/style bytes matched the local build, test fixtures were absent from the archive, and updater SHA-512 metadata matched the installer. Installer and portable SHA-256 hashes are published with the GitHub release.

The release audit also patched the transitive `js-yaml` dependency from 4.3.1 to 4.3.2 for [GHSA-2883-xcg3-v3hh](https://github.com/advisories/GHSA-2883-xcg3-v3hh), a YAML merge-source CPU exhaustion issue published in the advisory database on September 8, 2026. `npm audit` then reported zero known vulnerabilities. This is a point-in-time dependency check, not a claim that the application has no security defects. GitHub may take time to reconcile older alerts for `fast-uri` and `@xmldom/xmldom`, which are already patched in this lockfile.

## Safety and remaining limits

- No production vault, credentials or remote hosts are used in these tests. DNS flushing and Nmap execution use fixtures; TCP tests use loopback only. No network sweep is run automatically during verification.
- Native window discovery is verified, but authenticated end-to-end RDP rendering was not exercised against a live server. Test credentials, window switching, resizing, multi-monitor DPI, minimize/restore and tab closure on supported workstation hardware before deployment. Cross-process [SetParent](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setparent) has DPI-awareness limitations.
- A 10-second window-discovery timeout fails the session visibly instead of leaving an unbounded polling loop. Slow launch environments may reach that deadline. A helper exists only for an open RDP session and adds process overhead in exchange for isolation.
- Nmap must be installed in an absolute PATH directory. Arguments are passed as an array with `shell: false`; the target is a validated IPv4 /24. This is host discovery, not a full port scan. No automatic elevation or downloads occur.
- Native Credential Manager commands still transiently pass credentials in the cmdkey process arguments, as in earlier versions. Authorized local process inspection may see them. Existing same-host Credential Manager entries may be replaced by this workflow; review organizational credential policy. No credentials are included in helper messages or generated RDP files.
- Installers are unsigned unless an Authenticode certificate is explicitly configured. Checksums verify byte integrity, not publisher identity.
