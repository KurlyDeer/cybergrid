const { copyFileSync, mkdirSync } = require("node:fs");
const { join } = require("node:path");

const projectRoot = join(__dirname, "..");
const rendererOutput = join(projectRoot, "dist", "renderer");

mkdirSync(rendererOutput, { recursive: true });
copyFileSync(
  join(projectRoot, "src", "renderer", "index.html"),
  join(rendererOutput, "index.html"),
);
copyFileSync(
  join(projectRoot, "src", "renderer", "vnc-bootstrap.mjs"),
  join(rendererOutput, "vnc-bootstrap.mjs"),
);
