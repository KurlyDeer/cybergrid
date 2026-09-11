# CyberGrid v1.3.10 verification

## RDP changes

The Electron main process no longer uses the PID or exit/close events of the initial `mstsc.exe` launcher as session identity. A per-session utility process snapshots existing RDP windows before launch, then asynchronously searches for a new `TscShellContainerClass` window with a matching endpoint token in its Unicode title. Similar addresses, wrong ports/classes, pre-existing windows, and handles claimed by another tab are excluded.

Successful attachment marks the HWND with a per-session property. The two-second lifecycle check verifies `IsWindow`, the class, and that property, so a recycled HWND is not mistaken for the old session. Title reads stop after docking because caption removal or later title changes should not end a live session. Both native geometry calls and lifecycle checks remain outside Electron's event loop. Existing child styles, one-pixel repaint nudge, and 150 ms resize coalescing are retained.

Closing a tab posts `WM_CLOSE` to its verified window rather than terminating the old launcher PID. Cancellation before attachment allows a short, bounded cleanup search for a late replacement window. Cleanup then disposes the helper and removes the temporary Credential Manager entry and RDP file. No broad process-name termination is used.

Microsoft documents the behavior of [GetWindowTextW](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getwindowtextw), the handle-reuse caveat for [IsWindow](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-iswindow), and asynchronous [PostMessageW](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-postmessagew). Window properties reduce handle-reuse risk but cannot make cross-process UI operations atomic.

## Regression commands

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
# Remove offscreen test bundles before packaging.
npm run build
npx electron-builder --win
npx electron scripts/test-rdp-native-host.cjs --packaged
```

The v1.3.9 core test has been extended with ghost launcher exits, title/class matching, similar-host rejection, concurrent handle claims, recycled-window guards, actual two-second window loss, cancellation during asynchronous credential injection, and cancellation while a window search is still in flight. The native smoke test verifies Unicode titles and window properties on its own hidden test window, loads the production utility helper, and confirms that a deliberately stalled helper cannot freeze the main process.

The offscreen UI suite includes `test-v1310-ui.cjs`: 25 nested folders, 120-item badges, 200/320/600-pixel widths, compact/full layouts, scroll preservation, Windows/FortiOS/PAN-OS command dispatch, and closed/late/queued RDP IPC races. No real server credentials or remote sessions are used in these tests.

The final installer archive was checked against the local production bundles, with no offscreen test fixtures included. The packaged native helper smoke test also passed; `latest.yml` contains the matching installer SHA-512. Windows executable metadata reports CyberGrid version 1.3.10.

## Remaining validation

- Authenticated RDP drawing and mstsc process handoff need testing on deployment workstations, including normal versus elevated launch, mixed-DPI displays, tab switching, and native disconnect confirmations. Synthetic lifecycle tests do not prove universal rendering compatibility.
- Only exact `TscShellContainerClass` windows whose titles include the configured endpoint are accepted. A title rewritten to a different alias, hidden endpoint, slow launch beyond the deadline, or client using a different class fails visibly rather than falling back to an unrelated window. A custom-port title must include that port.
- Pre-existing windows are deliberately left alone. Simultaneous external mstsc launches to the same endpoint can still be ambiguous; avoid launching the same target outside CyberGrid during attachment.
- `WM_CLOSE` follows Windows disconnect behavior; it is not unconditional process termination. If Windows blocks the request or displays a confirmation, complete the native prompt. A replacement window appearing after the cancellation cleanup deadline may need to be closed manually.
- `Get-Process` requires PowerShell. FortiOS and PAN-OS commands are separated, and `diagnose sys top` is interactive (press `q` to stop). Macros execute only when clicked in a connected terminal.
- `npm audit` reported zero known vulnerabilities before packaging. This is a point-in-time dependency result, not a complete security guarantee. Binaries are unsigned unless an Authenticode certificate is configured.
