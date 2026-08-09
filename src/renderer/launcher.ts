type CyberGridApi = import("../shared/ipc").CyberGridApi;
type ServerProfileSummary = import("../shared/ipc").ServerProfileSummary;

export {};

declare global { interface Window { cybergrid: CyberGridApi; } }

const query = document.getElementById("query") as HTMLInputElement;
const results = document.getElementById("results") as HTMLDivElement;
const status = document.getElementById("status") as HTMLDivElement;
let profiles: ServerProfileSummary[] = [];
let matches: ServerProfileSummary[] = [];
let selectedIndex = 0;

function score(profile: ServerProfileSummary, rawQuery: string): number {
  const needle = rawQuery.trim().toLocaleLowerCase();
  if (!needle) return profile.favorite ? 100 : 1;
  const fields = [profile.name, profile.host, profile.group, profile.username, ...profile.tags]
    .map((field) => field.toLocaleLowerCase());
  let best = -1;
  for (const field of fields) {
    if (field === needle) best = Math.max(best, 1_000);
    else if (field.startsWith(needle)) best = Math.max(best, 700 - field.length);
    else if (field.includes(needle)) best = Math.max(best, 500 - field.indexOf(needle));
  }
  return best;
}

function select(index: number): void {
  if (matches.length === 0) return;
  selectedIndex = (index + matches.length) % matches.length;
  [...results.querySelectorAll<HTMLButtonElement>(".result")].forEach((button, buttonIndex) => {
    button.classList.toggle("selected", buttonIndex === selectedIndex);
  });
}

async function launch(profile: ServerProfileSummary): Promise<void> {
  status.hidden = false;
  status.textContent = `Opening ${profile.name}…`;
  try {
    await window.cybergrid.system.launchProfileFromQuickLauncher(profile.id);
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : String(error);
  }
}

function render(): void {
  matches = profiles.map((profile) => ({ profile, score: score(profile, query.value) }))
    .filter((candidate) => candidate.score >= 0)
    .sort((left, right) => right.score - left.score || left.profile.name.localeCompare(right.profile.name))
    .slice(0, 6).map((candidate) => candidate.profile);
  selectedIndex = Math.min(selectedIndex, Math.max(0, matches.length - 1));
  results.replaceChildren();
  for (const [index, profile] of matches.entries()) {
    const button = document.createElement("button");
    button.className = "result";
    button.type = "button";
    button.role = "option";
    const protocol = document.createElement("span");
    protocol.className = "protocol";
    protocol.textContent = profile.protocol.toUpperCase();
    const meta = document.createElement("span");
    meta.className = "meta";
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = profile.name;
    const endpoint = document.createElement("span");
    endpoint.className = "endpoint";
    endpoint.textContent = `${profile.host}:${profile.port}`;
    meta.append(name, endpoint);
    const group = document.createElement("span");
    group.className = "group";
    group.textContent = profile.group;
    button.append(protocol, meta, group);
    button.addEventListener("pointerenter", () => select(index));
    button.addEventListener("click", () => void launch(profile));
    results.append(button);
  }
  status.hidden = matches.length > 0;
  status.textContent = profiles.length === 0 ? "No saved connections are available." : "No matching connections.";
  select(selectedIndex);
}

query.addEventListener("input", () => { selectedIndex = 0; render(); });
query.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown") { event.preventDefault(); select(selectedIndex + 1); }
  else if (event.key === "ArrowUp") { event.preventDefault(); select(selectedIndex - 1); }
  else if (event.key === "Enter") { event.preventDefault(); const profile = matches[selectedIndex]; if (profile) void launch(profile); }
  else if (event.key === "Escape") window.cybergrid.system.hideQuickLauncher();
});

void (async () => {
  try {
    await window.cybergrid.system.whenReady();
    const vault = await window.cybergrid.vault.status();
    if (!vault.unlocked) {
      status.textContent = "CyberGrid is locked. Press Enter to open the main window.";
      query.placeholder = "Unlock CyberGrid to search saved connections";
      query.addEventListener("keydown", (event) => {
        if (event.key === "Enter") void window.cybergrid.system.showMainWindow();
      });
      return;
    }
    profiles = await window.cybergrid.vault.listProfiles();
    render();
    query.focus();
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : String(error);
  }
})();
