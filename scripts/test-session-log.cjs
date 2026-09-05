const assert = require("node:assert/strict");
const { mkdtemp, readFile, rm, writeFile } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");
const { buildSync } = require("esbuild");
const Module = require("node:module");

function loadSource(file) {
  const filename = resolve(file);
  const compiled = buildSync({ entryPoints: [filename], bundle: true, platform: "node", format: "cjs", write: false });
  const loaded = new Module(filename, module);
  loaded.paths = module.paths;
  loaded._compile(compiled.outputFiles[0].text, filename);
  return loaded.exports;
}

(async () => {
  const { SessionLog } = loadSource("src/main/session-log.ts");
  const directory = await mkdtemp(join(tmpdir(), "cybergrid-log-test-"));
  try {
    const errors = [];
    const log = await SessionLog.start(directory, "../test:device", (error) => errors.push(error));
    assert.equal(require("node:path").dirname(log.path), directory);
    const bytes = Buffer.from("device#\r\n\x1b[32mstatus OK\x1b[0m\r\n", "utf8");
    log.write(bytes);
    log.write("tail");
    await Promise.all([log.stop(), log.stop()]);
    log.write("not recorded");
    assert.deepEqual(await readFile(log.path), Buffer.concat([bytes, Buffer.from("tail")]));
    assert.deepEqual(errors, []);
    const second = await SessionLog.start(directory, "../test:device", (error) => errors.push(error));
    assert.notEqual(second.path, log.path);
    second.write(Buffer.alloc(9 * 1024 * 1024));
    await second.stop();
    assert.match(errors.pop(), /could not keep up/);
    assert.equal((await readFile(second.path)).length, 0);
    const invalid = join(directory, "not-a-directory");
    await writeFile(invalid, "test fixture");
    await assert.rejects(SessionLog.start(invalid, "test", () => {}));
    console.log("PASS: raw bytes, flush/idempotent stop, unique safe paths, bounded buffering, filesystem errors");
  } finally {
    // This is a newly created, isolated test directory only.
    await rm(directory, { recursive: true, force: true });
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
