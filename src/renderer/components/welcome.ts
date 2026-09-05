/** Static DOM: the landing page allocates no terminal or GPU context. */
export function createWelcomeContent(actions: {
  connect: () => void;
  openLink: (destination: "repository" | "documentation") => void;
}): HTMLElement {
  const page = document.createElement("section");
  page.className = "welcome-page";
  page.innerHTML = `
    <div class="welcome-heading">
      <img src="assets/cybergrid-mark.svg" width="52" height="52" alt="" />
      <p class="welcome-eyebrow">YOUR INFRASTRUCTURE. ONE WORKSPACE.</p>
      <h1>Welcome to CyberGrid</h1>
      <p class="welcome-subtitle">Multi-Protocol Infrastructure Manager</p>
      <p>Connect, troubleshoot, and document your systems from a focused, local-first command center.</p>
    </div>
    <div class="welcome-actions">
      <button type="button" class="primary-button" data-welcome="connect">Create New Connection</button>
      <button type="button" class="secondary-button" data-welcome="repository">View GitHub Repository ↗</button>
      <button type="button" class="secondary-button" data-welcome="documentation">Read Documentation / Wiki ↗</button>
    </div>
    <div class="welcome-features">
      <article><h2>Connect without friction</h2><p>SSH, embedded RDP, Serial COM, web consoles, and local shells. Paste an endpoint in the Quick Connect bar to begin.</p><kbd>Ctrl + N</kbd><span> Quick Connect</span></article>
      <article><h2>Your next action, closer</h2><p>Search your inventory, open Session Tools for vendor commands, or press Space to reconnect a closed SSH tab.</p><kbd>Ctrl + K</kbd><span> Command Palette</span></article>
      <article><h2>Keep a useful record</h2><p>Capture configuration backups and opt-in session logs. Credentials stay in your encrypted local vault.</p><kbd>F1</kbd><span> Built-in Help</span></article>
    </div>`;
  page.querySelector('[data-welcome="connect"]')?.addEventListener("click", actions.connect);
  for (const destination of ["repository", "documentation"] as const) {
    page.querySelector(`[data-welcome="${destination}"]`)?.addEventListener("click", () => actions.openLink(destination));
  }
  return page;
}
