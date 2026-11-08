// usage: node scripts/profile.mjs <compositionId> <firstFrame> <nFrames>  -- times frames under several post settings
import fs from "node:fs";
import path from "node:path";
if (process.env.REMOTION_TMP) { fs.mkdirSync(process.env.REMOTION_TMP, { recursive: true }); process.env.TEMP = process.env.TMP = process.env.TMPDIR = process.env.REMOTION_TMP; }
const { bundle } = await import("@remotion/bundler");
const { renderMedia, selectComposition } = await import("@remotion/renderer");
const [id = "MolassesShort", f0s = "700", ns = "8"] = process.argv.slice(2);
const f0 = Number(f0s), n = Number(ns);
const browserExecutable = process.env.CHROME || null;
const chromiumOptions = { gl: process.env.REMOTION_GL || "angle" };
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), publicDir: path.resolve("public") });
const configs = JSON.parse(process.env.CONFIGS || '[{"name":"base","post":{}}]');
for (const c of configs) {
  const inputProps = { post: c.post };
  const composition = await selectComposition({ serveUrl, id, browserExecutable, chromiumOptions, inputProps, timeoutInMilliseconds: 300000 });
  const stamps = [];
  const t0 = Date.now();
  await renderMedia({ composition, serveUrl, codec: "h264", outputLocation: `out/test/prof_${c.name}.mp4`, inputProps, browserExecutable, chromiumOptions,
    frameRange: [f0, f0 + n - 1], concurrency: Number(process.env.CONC || 1), timeoutInMilliseconds: 300000, scale: Number(process.env.SCALE || 1),
    onProgress: ({ renderedFrames }) => { if (stamps.length < renderedFrames) stamps.push(Date.now()); } });
  const d = stamps.slice(1).map((s, i) => (s - stamps[i]) / 1000).sort((a, b) => a - b);
  const med = d.length ? d[Math.floor(d.length / 2)] : NaN;
  console.log(`CONFIG ${c.name}: total ${((Date.now() - t0) / 1000).toFixed(1)} s, first frame at ${((stamps[0] - t0) / 1000).toFixed(1)} s, median frame ${med.toFixed(2)} s`);
}
