const { copyFile, mkdir } = require("node:fs/promises");
const { join } = require("node:path");
const { build } = require("esbuild");

const projectRoot = join(__dirname, "..");
const sourceRoot = join(projectRoot, "src");
const outputRoot = join(projectRoot, "build");
const rendererOutput = join(outputRoot, "renderer");

const common = {
  bundle: true,
  charset: "utf8",
  legalComments: "none",
  minify: true,
  sourcemap: false,
  target: "es2022",
  treeShaking: true,
};

async function bundleApplication() {
  await mkdir(join(outputRoot, "main"), { recursive: true });
  await mkdir(rendererOutput, { recursive: true });
  await mkdir(join(rendererOutput, "assets"), { recursive: true });

  await Promise.all([
    build({
      ...common,
      entryPoints: [join(sourceRoot, "main", "main.ts")],
      external: [
        "electron",
        "electron-updater",
        "ssh2",
        "serialport",
        "node-pty",
        "@serialport/bindings-cpp",
        "better-sqlite3",
        "fast-xml-parser",
        "mac-oui-lookup",
        "ws",
      ],
      format: "cjs",
      outfile: join(outputRoot, "main", "main.js"),
      platform: "node",
    }),
    build({
      ...common,
      entryPoints: [join(sourceRoot, "main", "preload.ts")],
      external: ["electron"],
      format: "cjs",
      outfile: join(outputRoot, "main", "preload.js"),
      platform: "node",
    }),
    build({
      ...common,
      entryPoints: [join(sourceRoot, "renderer", "renderer.ts")],
      format: "iife",
      outfile: join(rendererOutput, "renderer.js"),
      platform: "browser",
    }),
    build({
      ...common,
      entryPoints: [join(sourceRoot, "renderer", "launcher.ts")],
      format: "iife",
      outfile: join(rendererOutput, "launcher.js"),
      platform: "browser",
    }),
    build({
      ...common,
      entryPoints: [join(sourceRoot, "renderer", "detached.ts")],
      format: "iife",
      outfile: join(rendererOutput, "detached.js"),
      platform: "browser",
    }),
    build({
      ...common,
      entryPoints: [join(sourceRoot, "renderer", "vnc-bootstrap.mjs")],
      format: "esm",
      outfile: join(rendererOutput, "vnc-bootstrap.mjs"),
      platform: "browser",
    }),
  ]);

  await Promise.all([
    copyFile(join(sourceRoot, "renderer", "index.html"), join(rendererOutput, "index.html")),
    copyFile(join(sourceRoot, "renderer", "launcher.html"), join(rendererOutput, "launcher.html")),
    copyFile(join(sourceRoot, "renderer", "detached.html"), join(rendererOutput, "detached.html")),
    copyFile(join(sourceRoot, "renderer", "startup.js"), join(rendererOutput, "startup.js")),
    copyFile(
      join(sourceRoot, "assets", "cybergrid-mark.svg"),
      join(rendererOutput, "assets", "cybergrid-mark.svg"),
    ),
    copyFile(
      join(projectRoot, "node_modules", "xterm", "css", "xterm.css"),
      join(rendererOutput, "xterm.css"),
    ),
  ]);
}

bundleApplication().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
