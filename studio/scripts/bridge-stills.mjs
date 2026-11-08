// usage: node scripts/bridge-stills.mjs <outPrefix> <frame,frame,...> [scale] [compositionId]  (bundles once, GPU via ANGLE, jpeg)
// BRIDGE_ENTRY=src/sandboxes/<name>/index.tsx renders a sandbox copy instead of the main project entry.
// Every bundle copies public/ into the temp folder and never deletes it: set REMOTION_TMP to a folder on a big drive.
// CHROME=<path to chrome.exe> uses your own Chrome; by default Remotion downloads and uses its own headless browser.
import fs from "node:fs";
if (process.env.REMOTION_TMP) { fs.mkdirSync(process.env.REMOTION_TMP, { recursive: true }); process.env.TEMP = process.env.TMP = process.env.TMPDIR = process.env.REMOTION_TMP; }
const { bundle } = await import("@remotion/bundler");
const { renderStill, selectComposition } = await import("@remotion/renderer");
const path = await import("node:path");
const [prefix, frames, scale = "0.5", id = "BridgeShort"] = process.argv.slice(2);
if (!prefix || !frames) { console.log("usage: node scripts/bridge-stills.mjs <outPrefix> <frame,frame,...> [scale] [compositionId]"); process.exit(1); }
fs.mkdirSync(path.dirname(path.resolve(prefix + "x")), { recursive: true });
const browserExecutable = process.env.CHROME || null;
const chromiumOptions = { gl: process.env.REMOTION_GL || "angle" }; // REMOTION_GL=swangle on machines without a GPU
const serveUrl = await bundle({ entryPoint: path.resolve(process.env.BRIDGE_ENTRY || "src/index.ts"), publicDir: path.resolve("public") });
const composition = await selectComposition({ serveUrl, id, browserExecutable, chromiumOptions });
const onBrowserLog = (l) => { if (l.type === "error" || l.type === "warning") console.log(`[${l.type}]`, l.text.slice(0, 300)); };
for (const f of frames.split(",").map(Number)) {
  const t0 = Date.now();
  await renderStill({ composition, serveUrl, frame: f, output: `${prefix}${f}.jpg`, imageFormat: "jpeg", jpegQuality: 88, scale: Number(scale),
    browserExecutable, chromiumOptions, timeoutInMilliseconds: 180000, onBrowserLog });
  console.log("still", f, ((Date.now() - t0) / 1000).toFixed(1) + "s");
}
