const { readFile, writeFile, mkdir } = require("node:fs/promises");
const { join, resolve } = require("node:path");
const { Resvg } = require("@resvg/resvg-js");

const ICON_SIZES = [16, 24, 32, 48, 64, 128, 256];

async function generateBrandAssets(outputDirectory = resolve(__dirname, "../build")) {
  const svg = await readFile(resolve(__dirname, "../src/assets/logo.svg"));
  const rasterize = (size) => new Resvg(svg, { fitTo: { mode: "width", value: size }, font: { loadSystemFonts: false } }).render().asPng();
  const images = ICON_SIZES.map(rasterize);
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach((png, index) => {
    const entry = 6 + index * 16;
    header[entry] = header[entry + 1] = ICON_SIZES[index] === 256 ? 0 : ICON_SIZES[index];
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(join(outputDirectory, "icon.ico"), Buffer.concat([header, ...images])),
    writeFile(join(outputDirectory, "icon.png"), rasterize(1024)),
  ]);
}

module.exports = { generateBrandAssets, ICON_SIZES };
if (require.main === module) generateBrandAssets(process.argv[2] && resolve(process.argv[2])).catch((error) => {
  console.error(error); process.exitCode = 1;
});
