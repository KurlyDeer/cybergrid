const assert = require("node:assert/strict");
const vm = require("node:vm");
const { build } = require("esbuild");

(async () => {
  const output = await build({
    entryPoints: ["src/renderer/terminal/rendering.ts"], bundle: true, platform: "node", format: "cjs", write: false,
    plugins: [{ name: "fake-gpu", setup(builder) {
      builder.onResolve({ filter: /^xterm-addon-(webgl|canvas)$/ }, ({ path }) => ({ path, namespace: "fake" }));
      builder.onLoad({ filter: /.*/, namespace: "fake" }, ({ path }) => ({ contents: path.endsWith("webgl")
        ? "export const WebglAddon = globalThis.FakeWebgl;" : "export const CanvasAddon = globalThis.FakeCanvas;", loader: "js" }));
    } }],
  });
  for (const scenario of ["webgl", "unsupported", "context-loss"]) {
    const loaded = [];
    let loss;
    let disposed = 0;
    class FakeWebgl { onContextLoss(fn) { loss = fn; return { dispose() {} }; } dispose() { disposed++; } }
    class FakeCanvas { dispose() {} }
    const sandbox = { module: { exports: {} }, FakeWebgl, FakeCanvas };
    sandbox.exports = sandbox.module.exports;
    vm.runInNewContext(output.outputFiles[0].text, sandbox);
    const terminal = { loadAddon(addon) {
      if (scenario === "unsupported" && addon instanceof FakeWebgl) throw new Error("WebGL unavailable");
      loaded.push(addon);
    } };
    const handle = sandbox.module.exports.installTerminalRenderer(terminal);
    if (scenario === "context-loss") loss();
    assert(loaded.at(-1) instanceof (scenario === "webgl" ? FakeWebgl : FakeCanvas));
    handle.dispose();
    assert(disposed >= 1);
  }
  console.log("PASS: WebGL primary renderer, Canvas on activation failure, Canvas on GPU context loss, disposal");
})().catch((error) => { console.error(error); process.exitCode = 1; });
