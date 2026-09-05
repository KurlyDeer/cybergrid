interface ModalAction { label: string; primary?: boolean; run?: () => void | Promise<void> }

/** Theme-aware, accessible application modal. Content is text, never injected HTML. */
export class GlobalModal {
  private readonly dialog = document.createElement("dialog");
  private generation = 0;

  constructor(private readonly onVisibilityChange: () => void) {
    this.dialog.id = "global-modal";
    this.dialog.className = "global-modal";
    this.dialog.setAttribute("aria-labelledby", "global-modal-title");
    this.dialog.setAttribute("aria-describedby", "global-modal-description");
    this.dialog.addEventListener("close", () => this.onVisibilityChange());
    this.dialog.addEventListener("click", (event) => {
      const bounds = this.dialog.getBoundingClientRect();
      if (event.target === this.dialog && (event.clientX < bounds.left || event.clientX > bounds.right ||
          event.clientY < bounds.top || event.clientY > bounds.bottom)) this.close();
    });
    document.body.append(this.dialog);
  }

  show(title: string, message: string, actions: ModalAction[] = [{ label: "OK", primary: true }]): void {
    const generation = ++this.generation;
    const heading = document.createElement("h2");
    heading.id = "global-modal-title";
    heading.textContent = title;
    const description = document.createElement("p");
    description.id = "global-modal-description";
    description.textContent = message;
    const error = document.createElement("p");
    error.className = "global-modal-error";
    error.setAttribute("role", "alert");
    error.hidden = true;
    const footer = document.createElement("footer");
    footer.className = "global-modal-actions";
    for (const action of actions) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = action.primary ? "primary-button" : "secondary-button";
      button.textContent = action.label;
      button.addEventListener("click", async () => {
        if (button.disabled) return;
        button.disabled = true;
        try {
          await action.run?.();
          if (generation === this.generation) this.close();
        } catch {
          if (generation !== this.generation) return;
          error.textContent = "The update action could not complete. Please try again.";
          error.hidden = false;
          button.disabled = false;
        }
      });
      footer.append(button);
    }
    this.dialog.replaceChildren(heading, description, error, footer);
    if (!this.dialog.open) this.dialog.showModal();
    this.onVisibilityChange();
  }

  close(): void { ++this.generation; this.dialog.close(); }
}
