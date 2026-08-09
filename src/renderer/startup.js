(() => {
  const status = document.getElementById("startup-status");
  const loadRenderer = () => {
    const script = document.createElement("script");
    script.src = "./renderer.js";
    script.async = true;
    script.addEventListener("error", () => {
      if (status) status.textContent = "CyberGrid could not load the application interface.";
    });
    document.head.append(script);
  };

  const startAfterFirstPaint = () => {
    requestAnimationFrame(() => requestAnimationFrame(loadRenderer));
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startAfterFirstPaint, { once: true });
  } else {
    startAfterFirstPaint();
  }
})();
