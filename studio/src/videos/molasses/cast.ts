// Our molasses cast as lit flat sprites in the 3D world (same machinery as the bridge short): each frame every character
// asks for a drawing (key + draw call), the pool keeps one canvas per distinct drawing. Characters are yaw-only
// billboards shaded by cardShade(); standing ones get a contact blob. Effects are unlit cards; `rods` are thin 3D poles
// (paint rollers, the bucket stream) and `props` are movable 3D barrels / crates, both drawn by world.ts.
import * as THREE from "three";
import {
  Pen, bodyFront, bodySide, fxBurst, fxCreak, fxContact, fxShadow, fxDrip, fxRivet, fxDrop, fxBlueprint, fxBubble, fxTankPic, fxNoBottle,
  fxMolSplash, fxCold, fxStrand, fxSparkle, fxPuff, fxRing, fxDroplets, Outfit, Expr, FrontOpts, SideOpts, SKINS, MOL, MOL_LIT, MOL_HI, INK,
} from "./toon";
import {
  FPS, SHOTS, V3, TANK, TR, TH, HOOK_Z, runnerX, wallPt, RIVETS, RIV_TH, BURST_F, sOf, frontX, PAN, STUCK, KITCHEN, COURT, SALOON, FRONT_Z,
  GAVEL, HAMMER, LID_F, crestH, PAINT_F0, PAINT_F1, PAINT_TH0, PAINT_TH1, JELL as JELL_AT, paintK, smooth, clamp01, distT, hitS, colTilt, SHED, shedK, floodY,
} from "./story";
import { NOINK } from "./ink";
import { cardShade, blobMaterial, CARD_K } from "./cardshade";

// ---------------- canvas pool ----------------
type Entry = { cv: HTMLCanvasElement; tex: THREE.CanvasTexture; w: number; h: number };
export type Req = { key: string; w: number; h: number; k: number; draw: (p: Pen) => void; tex?: THREE.CanvasTexture };
const makeEntry = (w: number, h: number): Entry => {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { cv, tex, w, h };
};
export class Pool {
  private live = new Map<string, Entry>();
  private free: Entry[] = [];
  private reqs: Req[] = [];
  req(key: string, w: number, h: number, k: number, draw: (p: Pen) => void) {
    const r: Req = { key: `${w}x${h}|${key}`, w, h, k, draw };
    this.reqs.push(r);
    return r;
  }
  flush() {
    const want = new Map<string, Req[]>();
    for (const r of this.reqs) { const l = want.get(r.key); if (l) l.push(r); else want.set(r.key, [r]); }
    for (const [key, e] of this.live) if (!want.has(key)) { this.live.delete(key); this.free.push(e); }
    for (const [key, rs] of want) {
      let e = this.live.get(key);
      if (!e) {
        const r = rs[0], i = this.free.findIndex((x) => x.w === r.w && x.h === r.h);
        e = i >= 0 ? this.free.splice(i, 1)[0] : makeEntry(r.w, r.h);
        const g = e.cv.getContext("2d")!;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, e.w, e.h); g.setTransform(r.k, 0, 0, r.k, 0, 0);
        r.draw(new Pen(g));
        e.tex.needsUpdate = true;
        this.live.set(key, e);
      }
      for (const r of rs) r.tex = e.tex;
    }
    this.reqs = [];
  }
}

// ---------------- sprite meshes ----------------
const blank = (() => { const c = document.createElement("canvas"); c.width = c.height = 2; return new THREE.CanvasTexture(c); })();
export const SU = 0.00216; // metres per design unit: 1000 units = 2.16 m
const BODY = (() => { const g = new THREE.PlaneGeometry(600 * SU, 1000 * SU); g.translate(0, (975 - 500) * SU, 0); return g; })();
const CARD = new THREE.PlaneGeometry(1, 1);
export class Actor {
  mesh: THREE.Mesh; mat: THREE.MeshLambertMaterial; dmat: THREE.MeshDepthMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D, geo: THREE.BufferGeometry = BODY) {
    this.mat = cardShade(new THREE.MeshLambertMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide }));
    this.mat.alphaToCoverage = false;
    this.dmat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.customDepthMaterial = this.dmat;
    this.mesh.onBeforeRender = (r) => { const rt = r.getRenderTarget(); CARD_K.uPx.value = (rt ? rt.height : r.domElement.height) / 1920; };
    this.mesh.castShadow = false; this.mesh.receiveShadow = true; this.mesh.visible = false;
    this.mesh.rotation.order = "YXZ"; this.mesh.renderOrder = 1; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
  }
  bind() { const t = this.r?.tex; if (t) { this.mat.map = t; this.dmat.map = t; } }
}
export class Fx {
  mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; soft: THREE.MeshBasicMaterial; blob: THREE.MeshBasicMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D) {
    this.mat = new THREE.MeshBasicMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mat.alphaToCoverage = false;
    this.soft = new THREE.MeshBasicMaterial({ map: blank, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.blob = blobMaterial(blank);
    this.mesh = new THREE.Mesh(CARD, this.mat);
    this.mesh.visible = false; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
  }
  use(soft: boolean) { this.mesh.material = soft ? this.soft : this.mat; }
  bind() {
    const t = this.r?.tex;
    if (!t) return;
    if (this.r!.key.includes("|blob|")) {
      if (t.generateMipmaps) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; }
      this.blob.map = t; this.mesh.material = this.blob; this.mesh.renderOrder = 0.5;
    } else { this.mat.map = t; this.soft.map = t; this.mesh.renderOrder = 0; }
  }
}

// ---------------- placements ----------------
export type Place = { key: string; draw: (p: Pen) => void; x: number; y: number; z: number; scale?: number; mirror?: boolean; yaw?: number; roll?: number; size?: [number, number, number] };
export type FxPlace = { key: string; cw: number; ch: number; draw: (p: Pen) => void; x: number; y: number; z: number; w: number; h: number; flat?: boolean; rot?: number; soft?: boolean; yaw?: number };
export type Rod = { a: V3; b: V3; r: number; col: string };
export type PropPlace = { kind: "barrel" | "crate"; pos: V3; yaw: number; roll?: number; size: number };
export type CamInfo = { pos: THREE.Vector3; right: THREE.Vector3; sun?: THREE.Vector3 };
export type Stage = { places: Place[]; fx: FxPlace[]; rods: Rod[]; props: PropPlace[] };

const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
const q = (v: number, n = 120) => Math.round(v * n) / n;
const tier = (d: number): [number, number, number] =>
  d < 3.2 ? [1800, 3000, 3.0] : d < 6.5 ? [1080, 1800, 1.8] : d < 16 ? [480, 800, 0.8] : [240, 400, 0.4];
const SUN = new THREE.Vector3(0.5, 0.75, -0.4).normalize();
const tmp = new THREE.Vector3();
let NIGHT = false;
const light2D = (cam: CamInfo, mirror: boolean) => {
  const sx = SUN.dot(cam.right) * (mirror ? -1 : 1), sy = -SUN.y;
  return Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) * (Math.PI / 4);
};
const viewOf = (cam: CamInfo, x: number, z: number, dx: number, dz: number) => {
  const tx = cam.pos.x - x, tz = cam.pos.z - z, tl = Math.hypot(tx, tz) || 1;
  const c = (tx * dx + tz * dz) / tl;
  return { side: Math.abs(c) < 0.57, mirror: dx * cam.right.x + dz * cam.right.z < 0, fs: Math.round(Math.sqrt(Math.max(0, 1 - c * c)) * 20) / 20, toward: c > 0 };
};
const LEAD = 2 / FPS;
const LID = [0.5, 1, 1, 0.5];
const lidAt = (f: number, i: number, swaps: number[] = []) => {
  for (const ts of swaps) { const k = f - Math.round(ts - 2) + 1; if (k >= 0 && k < 4) return LID[k]; }
  let s = Math.round(-60 * hh(i, 9));
  for (let n = 0; s <= f && n < 400; n++) {
    const k = f - s;
    if (k >= 0 && k < 4) return LID[k];
    s += Math.round(15 + 54 * hh(i * 31 + n, 13));
  }
  return 0;
};
const fkey = (o: object) => JSON.stringify(o, (_k, v) => (typeof v === "number" ? q(v) : typeof v === "function" ? undefined : v));

type Who = { i: number; o: Outfit; okey: string };
/** one character drawing; `hk` = extra key for a held prop (its drawing depends on more than the options) */
const person = (cam: CamInfo, who: Who, x: number, y: number, z: number, view: { side: boolean; mirror: boolean }, fo: FrontOpts, so: SideOpts, scale = 1, hk = ""): Place => {
  const d = cam.pos.distanceTo(tmp.set(x, y + 1.2, z)) / scale;
  const [w, h, k] = tier(d);
  const mirror = view.side && view.mirror, light = light2D(cam, mirror), seed = (who.i * 5 + 3) % 7 + 1;
  const f2: FrontOpts = { ...fo, light, seed }, s2: SideOpts = { ...so, light, seed };
  const key = view.side ? `S|${who.okey}|${fkey(s2)}` : `F|${who.okey}|${fkey(f2)}|${hk}`;
  return { key, x, y, z, scale, mirror, draw: (p) => (view.side ? bodySide(p, who.o, s2) : bodyFront(p, who.o, f2)), size: [w, h, k] };
};
const CONTACT: [number, number, number] = [0.2, 0.21, 0.33];
const TAIL: [number, number, number] = [0.42, 0.44, 0.62];
const toSrgb = (v: number) => { const c = clamp01(v); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; };
const hexOf = (c: [number, number, number], k: number) => "#" + c.map((v) => Math.round(255 * toSrgb(1 - (1 - v) * k)).toString(16).padStart(2, "0")).join("");
const blob = (out: Stage, x: number, y: number, z: number, sc = 1, k = 1) => {
  const hl = Math.hypot(SUN.x, SUN.z) || 1, ox = -SUN.x / hl, oz = -SUN.z / hl, rot = Math.atan2(-ox, -oz);
  if (!NIGHT) {
    const el = Math.asin(Math.min(0.99, Math.max(0.1, SUN.y)));
    const len = Math.min(2.4, Math.max(0.5, 1.6 / Math.tan(el))) * sc, h = len + 0.55 * sc, c = 0.3 * h;
    const tc = hexOf(TAIL, k);
    out.fx.push({ key: `blob|shadow|${tc}`, cw: 128, ch: 256, draw: (p) => fxShadow(p, tc), x: x + ox * c, y: y + 0.018, z: z + oz * c, w: 0.72 * sc, h, flat: true, rot });
  }
  const cc = hexOf(CONTACT, k);
  out.fx.push({ key: `blob|contact|${cc}`, cw: 128, ch: 128, draw: (p) => fxContact(p, cc), x: x + ox * 0.03 * sc, y: y + 0.022, z: z + oz * 0.03 * sc, w: 0.52 * sc, h: 0.4 * sc, flat: true, rot });
};

// ---------------- the cast ----------------
const JELL: Outfit = { jacket: "#3a3f52", pants: "#2f3342", boots: "#2a2220", hat: "bowler", moustache: "#5a4030", tie: "#8c2f3a", vest: "#5a5f72", build: "stout", skin: SKINS[1] };
const worker = (v: number): Outfit => ({ jacket: ["#5a6e8c", "#7a5a3c", "#4e6a4e", "#8a6a4a", "#6a4e6e"][v % 5], pants: ["#3b3f52", "#4a4038", "#3a4450"][v % 3], boots: "#3a2a20",
  hat: "flatcap", cap: ["#6b6253", "#4a4a52", "#7a6a50", "#5a4a3a"][v % 4], skin: SKINS[v % 4], moustache: v % 3 === 1 ? "#4a3426" : undefined });
const PAINTER: Outfit = { jacket: "#efece4", pants: "#e3dfd4", boots: "#4a3426", hat: "flatcap", cap: "#e8e4da", skin: SKINS[2] };
const kid = (v: number, indoor = false): Outfit => ({ jacket: ["#c0353a", "#3f6fb5", "#d9a441"][v % 3], pants: "#3b3f52", boots: "#4a3426", build: "kid", skin: SKINS[(v + 1) % 4],
  ...(indoor ? { hat: "hair", hair: ["#5a3b2a", "#2a1a10", "#c98a4a"][v % 3] } : { hat: "beanie", cap: ["#2f6a43", "#c0353a", "#3f6fb5"][v % 3], scarf: ["#f3d35a", "#f3efe4", "#e8a23a"][v % 3] }) });
const SAILOR: Outfit = { jacket: "#2f3f5f", pants: "#2a2f45", boots: "#1e1e22", hat: "beanie", cap: "#2a2a35", scarf: "#c9ccd2", skin: SKINS[3] };
const FIREMAN: Outfit = { jacket: "#3a4566", pants: "#3a4566", boots: "#1e1e22", hat: "helmet", cap: "#4a4048", buttons: "#e8c45a", moustache: "#3a2a20", skin: SKINS[0] };
const POLICE: Outfit = { jacket: "#24305a", pants: "#24305a", boots: "#1e1e22", hat: "helmet", cap: "#24305a", buttons: "#e8c45a", skin: SKINS[1] };
const PANMAN: Outfit = { jacket: "#8a5a3c", pants: "#3b3f52", boots: "#3a2a20", hat: "bowler", cap: "#5a4632", moustache: "#6a4a30", vest: "#e2c49a", skin: SKINS[0], build: "stout" };
const LAWYER: Outfit = { jacket: "#2e2a36", pants: "#2e2a36", boots: "#1e1a1e", hat: "hair", hair: "#3a2a20", moustache: "#3a2a20", tie: "#c0353a", vest: "#4a4458", skin: SKINS[0] };
const JUDGE: Outfit = { jacket: "#1d1b22", pants: "#1d1b22", boots: "#1d1b22", dress: "#1d1b22", hat: "hair", hair: "#e3e0da", glasses: true, build: "stout", skin: SKINS[2] };
const ENGINEER: Outfit = { jacket: "#5a6e5a", pants: "#3b3f52", boots: "#3a2a20", hat: "hair", hair: "#6a4a30", glasses: true, tie: "#2f4a8a", vest: "#7a8a7a", skin: SKINS[3] };
const BARTENDER: Outfit = { jacket: "#f3efe4", pants: "#2a2a35", boots: "#1e1a1e", hat: "hair", hair: "#2a1a10", moustache: "#2a1a10", apron: "#ffffff", vest: "#2a2a35", skin: SKINS[1] };
const OFFICIAL: Outfit = { jacket: "#3a3f52", pants: "#2f3342", boots: "#2a2220", hat: "bowler", cap: "#2a2830", tie: "#2f4a8a", skin: SKINS[0] };
const OLDMAN: Outfit = { jacket: "#8a6a5a", pants: "#4a4458", boots: "#3a2a20", hat: "hair", hair: "#ece8e0", glasses: true, moustache: "#ece8e0", build: "stout", skin: SKINS[0] };
const LADY: Outfit = { jacket: "#5a3f6a", pants: "#3b3f52", boots: "#3a2a20", hat: "bowler", cap: "#4a3050", dress: "#6e4a7a", skin: SKINS[2] };

// held props, drawn on the character canvas (hands = final hand points in design units)
const blueprintHeld = (rot: number) => (p: Pen, hd: (([number, number] | null))[], u: number) => {
  const [a, b] = hd; if (!a || !b) return;
  const g = p.g, cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2 - 8 * u;
  g.save(); g.translate(cx, cy); g.rotate(rot); g.scale((84 * u) / 520, (84 * u) / 520); g.translate(-260, -190);
  fxBlueprint(new Pen(g)); g.restore();
  p.dot(a[0], a[1], 5.5 * u); p.dot(b[0], b[1], 5.5 * u);
};
const pailHeld = (side: 0 | 1, full = false) => (p: Pen, hd: (([number, number] | null))[], u: number) => {
  const h = hd[side]; if (!h) return;
  const [x, y] = h;
  p.arc(x, y + 14 * u, 13 * u, 11 * u, 200, 340, 2 * u);
  p.poly([[x - 14 * u, y + 12 * u], [x + 14 * u, y + 12 * u], [x + 11 * u, y + 38 * u], [x - 11 * u, y + 38 * u]], "#9aa0a8", 2.4 * u);
  if (full) p.ell(x, y + 13 * u, 12 * u, 3 * u, MOL, 1.2 * u);
  p.dot(x, y, 5.5 * u);
};
const thumbHeld = (p: Pen, hd: (([number, number] | null))[], u: number) => {
  const h = hd[1]; if (!h) return;
  p.ell(h[0], h[1], 9 * u, 8 * u, INK, 0);
  p.poly([[h[0] - 4 * u, h[1] - 5 * u], [h[0] + 4 * u, h[1] - 5 * u], [h[0] + 3.5 * u, h[1] - 22 * u], [h[0] - 3.5 * u, h[1] - 22 * u]], INK, 0);
  p.dot(h[0], h[1] - 22 * u, 3.6 * u);
};
const sandwichHeld = (side: 0 | 1) => (p: Pen, hd: (([number, number] | null))[], u: number) => {
  const h = hd[side]; if (!h) return;
  const [x, y] = h;
  p.poly([[x - 14 * u, y - 10 * u], [x + 14 * u, y - 10 * u], [x + 14 * u, y + 2 * u], [x - 14 * u, y + 2 * u]], "#e8c886", 2 * u);
  p.poly([[x - 15 * u, y - 5 * u], [x + 15 * u, y - 5 * u], [x + 15 * u, y - 2 * u], [x - 15 * u, y - 2 * u]], "#7fb85a", 0);
  p.dot(x, y + 2 * u, 5.5 * u);
};
const plateHeld = (tilt: number, cake: boolean) => (p: Pen, hd: (([number, number] | null))[], u: number) => {
  const h = hd[1]; if (!h) return;
  const [x, y] = h, g = p.g;
  g.save(); g.translate(x, y - 2 * u); g.rotate(tilt);
  p.ell(0, 0, 22 * u, 5 * u, "#f4f1ea", 2 * u);
  if (cake) { p.ell(0, -4 * u, 15 * u, 4.5 * u, "#e2b066", 1.8 * u); p.ell(2 * u, -7 * u, 9 * u, 2.4 * u, MOL, 0); }
  g.restore(); p.dot(x, y, 5.5 * u);
};
const rollerHeld = (p: Pen, hd: (([number, number] | null))[], u: number) => { for (const h of hd) if (h) p.dot(h[0], h[1], 5.5 * u); };
const penHeld = (p: Pen, hd: (([number, number] | null))[], u: number) => {
  const h = hd[1]; if (!h) return;
  p.band([[h[0] - 2 * u, h[1] + 6 * u], [h[0] + 9 * u, h[1] - 16 * u]], "#1f2a6a", 2.4 * u, 1 * u, "round");
  p.dot(h[0], h[1], 5.5 * u);
};
const gavelHeld = (k: number) => (p: Pen, hd: (([number, number] | null))[], u: number) => {
  const h = hd[1]; if (!h) return;
  const g = p.g; g.save(); g.translate(h[0], h[1]); g.rotate(-1.1 + 1.3 * k);
  p.band([[0, 10 * u], [0, -34 * u]], "#8a5a34", 4.5 * u, 1.4 * u, "round");
  p.poly([[-14 * u, -46 * u], [14 * u, -46 * u], [14 * u, -32 * u], [-14 * u, -32 * u]], "#6e4228", 2 * u);
  g.restore(); p.dot(h[0], h[1], 5.5 * u);
};
const hammerHeld = (k: number) => (p: Pen, hd: (([number, number] | null))[], u: number) => {
  const h = hd[1]; if (!h) return;
  const g = p.g; g.save(); g.translate(h[0], h[1]); g.rotate(-1.2 + 1.5 * k);
  p.band([[0, 12 * u], [0, -42 * u]], "#8a5a34", 5 * u, 1.5 * u, "round");
  p.poly([[-12 * u, -56 * u], [20 * u, -56 * u], [20 * u, -40 * u], [-12 * u, -40 * u]], "#7d848c", 2.2 * u);
  g.restore(); p.dot(h[0], h[1], 5.5 * u);
  const l = hd[0]; if (l) p.dot(l[0], l[1], 5.5 * u);
};
const dots = (p: Pen, hd: (([number, number] | null))[], u: number) => { for (const h of hd) if (h) p.dot(h[0], h[1], 5.5 * u); };

/** a lone molasses jet squirting out of a rivet hole (side-on, 300 x 120 canvas) */
const jet = (p: Pen) => {
  // an arcing squirt that breaks into drops
  const pts: [number, number][] = [];
  for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push([20 + 200 * t, 40 + 60 * t * t]); }
  p.line(pts, MOL, 16);
  p.stroke(pts.slice(0, 8).map(([x, y]) => [x, y - 3] as [number, number]), 4, MOL_HI);
  for (const [x, y, r] of [[238, 108, 9], [262, 122, 7], [282, 140, 5]] as const) p.ell(x, y, r, r * 1.2, MOL, 4);
};
const stream = (p: Pen) => { p.poly([[46, 0], [74, 0], [66, 1000], [54, 1000]], "#9fd4f0", 0); p.stroke([[58, 0], [58, 1000]], 5, "#e8f6ff"); };

// ---------------- crowd helpers ----------------
/** a standing / walking extra; dir = walk direction (x, z), phase from time */
const walker = (cam: CamInfo, out: Stage, i: number, o: Outfit, okey: string, x: number, z: number, f: number, opts: { dir?: [number, number]; speed?: number; expr?: Expr; run?: boolean; scale?: number; look?: number } = {}) => {
  const { dir = [1, 0], speed = 0, expr = "neutral", run = false, scale = 1, look = 0 } = opts;
  const phase = speed ? q(((f / FPS) * (run ? 2.6 : 0.9) + hh(i, 5)) % 1, 120) : 0;
  const view = viewOf(cam, x, z, dir[0], dir[1]);
  const mode = speed ? (run ? "march" : "stroll") : "stand";
  const fo: FrontOpts = { mode, phase, expr, look, blink: lidAt(f, i), lift: run ? 85 : 60 };
  const so: SideOpts = { mode: speed ? "march" : "stand", phase, expr, blink: lidAt(f, i), stomp: run ? 1.6 : 0.6, stride: (run ? 1.3 : 0.8) * view.fs };
  out.places.push(person(cam, { i, o, okey }, x, 0, z, speed ? view : { side: false, mirror: false }, fo, so, scale));
  blob(out, x, 0, z, scale);
};
const wallFx = (out: Stage, key: string, cw: number, ch: number, draw: (p: Pen) => void, th: number, y: number, w: number, h: number, outM = 0.06, rot = 0) => {
  const [x, , z] = wallPt(th, y, outM);
  out.fx.push({ key, cw, ch, draw, x, y, z, w, h, yaw: th, rot });
};
/** design-space hand target (u units from (300, chin)) for a world point, for a card at (cx, cy, cz) facing the camera */
const handTo = (cam: CamInfo, card: V3, world: V3, scale = 1, build: "adult" | "stout" | "kid" = "adult"): [number, number] => {
  // where the camera ray through the world point crosses the card's plane (the card turns to face the camera)
  const nx = cam.pos.x - card[0], nz = cam.pos.z - card[2], nl = Math.hypot(nx, nz) || 1, n = [nx / nl, nz / nl];
  const wx = world[0] - cam.pos.x, wy = world[1] - cam.pos.y, wz = world[2] - cam.pos.z;
  const den = n[0] * wx + n[1] * wz, tt = Math.abs(den) > 1e-6 ? (n[0] * (card[0] - cam.pos.x) + n[1] * (card[2] - cam.pos.z)) / den : 1;
  const px = cam.pos.x + tt * wx, py = cam.pos.y + tt * wy, pz = cam.pos.z + tt * wz;
  const dx = (px - card[0]) * cam.right.x + (pz - card[2]) * cam.right.z, dy = py - card[1];
  const a = build === "kid" ? 112 : 118, HH = 2 * a * 0.94, torso = build === "kid" ? 0.85 : build === "stout" ? 1.15 : 1.1, legs = build === "kid" ? 1.0 : build === "stout" ? 1.32 : 1.4;
  const chin = 975 - (legs + torso) * HH, u = (2 * a) / 100;
  return [(dx / (SU * scale)) / u, (975 - dy / (SU * scale) - chin) / u];
};

// ---------------- shots ----------------
const hook = (cam: CamInfo, f: number, out: Stage) => {
  const rx = runnerX(f);
  walker(cam, out, 1, worker(0), "w0", rx, HOOK_Z, f, { dir: [1, 0], speed: 6, run: true, expr: f < 96 ? "shock" : "nervous" });
  walker(cam, out, 2, LADY, "lady", rx + 5.5, HOOK_Z + 1.9, f, { dir: [1, 0], speed: 6, run: true, expr: "shock" });
  walker(cam, out, 3, worker(3), "w3", rx + 3.2, HOOK_Z - 2.9, f, { dir: [1, 0], speed: 6, run: true, expr: "shock" });
  walker(cam, out, 4, worker(1), "w1", rx + 9, HOOK_Z - 5.5, f, { dir: [1, 0.1], speed: 6, run: true, expr: "nervous" });
  crestSpray(f, SHOTS[0].s(f), out, [HOOK_Z - 4, HOOK_Z - 1, HOOK_Z + 1.5]);
};
/** brown spray thrown off the top of the crest where it runs down the street */
const crestSpray = (f: number, s: number, out: Stage, zs: number[]) => {
  const H = crestH(s);
  if (H < 1.5) return;
  zs.forEach((z, i) => {
    const x = frontX(s, z) + 0.12 * H;
    const u = q(((f * 0.045 + hh(i, 3)) % 1), 30);
    out.fx.push({ key: `drops${u}`, cw: 400, ch: 300, draw: (p) => fxDroplets(p, u), x, y: H * 0.95, z, w: 0.55 * H, h: 0.41 * H });
  });
};
const street = (cam: CamInfo, f: number, out: Stage) => {
  // winter pedestrians, a worker at the foot of the tank for scale
  const ws: [number, number, number, number][] = [[8, 12.6, -1, 0], [-6, 12.4, 1, 1], [24, 12.5, -1, 3], [32, 12.7, 1, 5]];
  ws.forEach(([x0, z, d, i]) => walker(cam, out, 10 + i, i % 3 === 2 ? LADY : worker(i), i % 3 === 2 ? "lady" : `w${i}`, x0 + d * 0.8 * (f - 176) / FPS, z, f, { dir: [d, 0], speed: 0.8, expr: i % 2 ? "smile" : "neutral" }));
  walker(cam, out, 20, worker(2), "w2", 12.2, -8.0, f, { expr: f > 258 ? "puzzled" : "neutral", look: f > 258 ? -1 : 0 });
};
const jell = (cam: CamInfo, f: number, out: Stage, thumbs = false) => {
  const P: V3 = JELL_AT;
  if (thumbs) {
    const fo: FrontOpts = { mode: "stand", expr: "grin", blink: lidAt(f, 30), arms: [null, [52, -4]], held: thumbHeld, facing: 0 };
    out.places.push(person(cam, { i: 30, o: JELL, okey: "jell" }, ...P, { side: false, mirror: false }, fo, {}, 1, "thumb"));
  } else {
    const turn = f < 398 ? 0 : smooth((f - 398) / 16) * Math.PI;
    const fo: FrontOpts = { mode: "stand", expr: f < 398 - 2 ? "smug" : "puzzled", blink: lidAt(f, 30, [398]), arms: [[-34, 40], [34, 40]], held: blueprintHeld(q(turn, 20)), look: f < 398 ? 0 : 1 };
    out.places.push(person(cam, { i: 30, o: JELL, okey: "jell" }, ...P, { side: false, mirror: false }, fo, {}, 1, `bp${q(turn, 20)}`));
  }
  blob(out, P[0], 0, P[2], 1.1);
};
const rim = (cam: CamInfo, f: number, out: Stage) => {
  // one bucket tipped in from the rim: a thin stream falls 15 m into the empty tank and makes a puddle
  if (f > 444 && f < 476) out.fx.push({ key: "stream", cw: 120, ch: 1000, draw: stream, x: TANK[0] + 0.08, y: 7.0, z: TANK[2], w: 0.38, h: 12.8 });
  const u = q(((f - 448) / FPS * 0.8) % 1, 30);
  if (f > 448) out.fx.push({ key: `ring${u}`, cw: 600, ch: 600, draw: (p) => fxRing(p, u), x: TANK[0], y: 0.53, z: TANK[2], w: 3.0, h: 3.0, flat: true });
};
const painters = (cam: CamInfo, f: number, out: Stage) => {
  if (f < 544) {
    // the leak: drips running down a seam of the bare steel
    for (let i = 0; i < 4; i++) {
      const u = q(((f - 504) / FPS * 0.55 + hh(i, 4)) % 1, 30);
      wallFx(out, `drip${u}`, 120, 420, (p) => fxDrip(p, u), 0.55 + (i - 1.5) * 0.035, 1.8 + 1.0 * i, 0.4, 1.4);
    }
    return;
  }
  // two painters roll brown paint over the steel, following the edge of the paint
  const pk = paintK(f), edge = PAINT_TH0 + (PAINT_TH1 - PAINT_TH0) * pk;
  [[edge - 0.04, 0], [edge + 0.16, 1]].forEach(([th, i]) => {
    const [x, , z] = wallPt(th, 0, 1.4), top = wallPt(th, 4.2 + 1.2 * i + 0.3 * Math.sin(f * 0.3 + i), 0.12);
    const fo: FrontOpts = { mode: "stand", expr: i ? "smile_closed" : "smile", blink: lidAt(f, 50 + i), arms: [[-8, 26], [10, 12]], held: rollerHeld };
    out.places.push(person(cam, { i: 50 + i, o: PAINTER, okey: "painter" }, x, 0, z, { side: false, mirror: false }, fo, {}, 1, "roller"));
    blob(out, x, 0, z);
    out.rods.push({ a: [x, 1.05, z], b: top, r: 0.03, col: "#8a5a34" });
    out.rods.push({ a: [top[0] - 0.25 * Math.cos(th), top[1], top[2] + 0.25 * Math.sin(th)], b: [top[0] + 0.25 * Math.cos(th), top[1], top[2] - 0.25 * Math.sin(th)], r: 0.09, col: "#6e4024" });
  });
};
const kids = (cam: CamInfo, f: number, out: Stage) => {
  const base = 0.28;
  for (let i = 0; i < 3; i++) {
    const th = base + (i - 1) * 0.07, [x, , z] = wallPt(th, 0, 1.0 + 0.35 * (i % 2));
    const licking = i === 1 && f > 640;
    const fo: FrontOpts = licking
      ? { mode: "stand", expr: "lick", blink: lidAt(f, 60 + i), arms: [[-20, 50], [8, -14]], held: (p, hd, u) => { pailHeld(0, true)(p, hd, u); dots(p, [null, hd[1]], u); } }
      : { mode: "stand", expr: i === 0 ? "grin" : "smile", blink: lidAt(f, 60 + i), arms: i === 2 ? [[-18, 24], [18, 24]] : [[-20, 50], null], held: i === 2 ? (p, hd, u) => { const m: [number, number] = [(hd[0]![0] + hd[1]![0]) / 2, (hd[0]![1] + hd[1]![1]) / 2]; pailHeld(0, true)(p, [m, null], u); } : pailHeld(0, true) };
    out.places.push(person(cam, { i: 60 + i, o: kid(i), okey: `kid${i}` }, x, 0, z, { side: false, mirror: false }, fo, {}, 0.72, `pail${licking}`));
    blob(out, x, 0, z, 0.72);
  }
  for (let i = 0; i < 3; i++) {
    const u = q(((f - 599) / FPS * 0.6 + hh(i, 8)) % 1, 30);
    wallFx(out, `drip${u}`, 120, 420, (p) => fxDrip(p, u), base + (i - 1) * 0.07 + 0.02, 1.7 + 0.3 * i, 0.22, 0.75);
  }
};
const ship = (cam: CamInfo, f: number, out: Stage) => {
  if (f < 708) {
    walker(cam, out, 70, SAILOR, "sailor", -36, -29.2, f, { expr: "smile" });
    walker(cam, out, 71, worker(4), "w4", -30, -28.5, f, { expr: "neutral" });
    return;
  }
  if (f < 767) {
    // the thaw: drops fall from the icicles on the freight house eave
    for (let i = 0; i < 7; i++) {
      const u = ((f - 708) / FPS * 0.9 + hh(i, 2)) % 1, x = 24 + i * 1.6 + 0.4 * Math.sin(i * 4);
      out.fx.push({ key: "drop", cw: 60, ch: 90, draw: fxDrop, x, y: 4.9 - 4.6 * u * u, z: -5.55, w: 0.09, h: 0.135 });
    }
    return;
  }
  // the groan: two workers look up at the bulging wall, strain ticks on the plates
  [[-0.24, 0], [-0.12, 1]].forEach(([th, i]) => {
    const [x, , z] = wallPt(th, 0, 3.0 + i);
    const fo: FrontOpts = { mode: "stand", expr: "nervous", look: i ? -1 : 1, blink: lidAt(f, 75 + i, [775]), headTilt: -6 };
    out.places.push(person(cam, { i: 75 + i, o: worker(i + 2), okey: `w${i + 2}` }, x, 0, z, { side: false, mirror: false }, fo, {}));
    blob(out, x, 0, z);
  });
  [[-0.36, 4.6], [-0.25, 6.2], [-0.42, 3.4], [-0.3, 7.6]].forEach(([th, y], i) => {
    const u = q(((f / FPS) * 1.3 + i * 0.37) % 1, 30);
    wallFx(out, `creak${u}`, 300, 300, (p) => fxCreak(p, u), th, y, 1.5, 1.5, 0.25, i * 0.6 - 0.9);
  });
};
const lunch = (cam: CamInfo, f: number, out: Stage) => {
  const bs = sOf(f);
  if (f < 842) {
    for (let i = 0; i < 3; i++) {
      const th = -0.42 + (i - 1) * 0.06, [x, , z] = wallPt(th, 0, 1.4);
      const bite = (f / FPS * 0.8 + hh(i)) % 1 < 0.3;
      const fo: FrontOpts = { mode: "sit", expr: bite ? "grin" : (["smile", "smile_closed", "grin"] as Expr[])[i], blink: lidAt(f, 80 + i), arms: [null, bite ? [10, -2] : [26, 40]], held: sandwichHeld(1) };
      out.places.push(person(cam, { i: 80 + i, o: worker(i), okey: `w${i}` }, x, 0.45, z, { side: false, mirror: false }, fo, {}, 1, `sw${bite}`));
      blob(out, x, 0.45, z);
    }
    return;
  }
  if (bs < 0) {
    // rivets shoot out one after another up the seam, molasses squirting from every hole
    RIVETS.forEach((tr, i) => {
      const fr = Math.round(tr * FPS), y = 2.6 + i * 0.62;
      if (f < fr) return;
      const age = (f - fr) / FPS, th = RIV_TH + 0.01 * Math.sin(i * 3);
      if (age < 5 / FPS) { const u = q(age / (5 / FPS), 30); wallFx(out, `burst${u}`, 500, 500, (p) => fxBurst(p, u), th, y, 0.7, 0.7, 0.3); }
      const n = [Math.sin(th), 0, Math.cos(th)], d = 6 * age;
      if (age < 0.9) out.fx.push({ key: "rivet", cw: 100, ch: 100, draw: fxRivet, x: TANK[0] + (TR + 0.2 + d) * n[0] + 0.4 * age, y: y + 2.5 * age - 4.9 * age * age, z: TANK[2] + (TR + 0.2 + d) * n[2], w: 0.16, h: 0.16, rot: age * 9 });
      const [jx, , jz] = wallPt(th - 0.03, 0, 0.45);
      out.fx.push({ key: "jet", cw: 300, ch: 160, draw: jet, x: jx, y: y - 0.15, z: jz, w: 0.9, h: 0.48, rot: -0.15 });
    });
    return;
  }
  // the burst: a ring of brown splash round the foot of the tank
  if (bs < 1.0) {
    const u = q(bs / 1.0, 30);
    for (let i = 0; i < 6; i++) {
      const th = -1.4 + i * 0.55, [x, , z] = wallPt(th, 0, 2.5 + 6 * bs);
      out.fx.push({ key: `mspl${u}`, cw: 800, ch: 800, draw: (p) => fxMolSplash(p, u), x, y: 3.2, z, w: 9, h: 9 });
    }
  }
};
const wave = (cam: CamInfo, f: number, out: Stage, id: number) => {
  const s = SHOTS[id - 1].s(f);
  if (id === 9 && f < 1040) {
    // people running ahead of the wave down the street
    [[0, 2.0, 1], [1, 8.5, 3], [2, -2.5, 4], [3, 10.8, 0]].forEach(([i, z, v]) => {
      const x = frontX(s, z) + 7 + 4 * i + 1.6 * (f - 940) / FPS;
      walker(cam, out, 90 + i, i === 2 ? LADY : worker(v), i === 2 ? "lady" : `w${v}`, x, z, f, { dir: [1, 0], speed: 6, run: true, expr: "shock" });
    });
    crestSpray(f, s, out, [-0.5, 3, 6.5, 10]);
  }
  if (id === 9 && f >= 1040 && f < 1068) {
    // the crest slams the el columns
    for (const zc of [-1.0, 7.0]) {
      const hs = hitS(distT(68, zc)), age = s - hs;
      if (age > 0 && age < 0.8) { const u = q(age / 0.8, 30); out.fx.push({ key: `mspl${u}`, cw: 800, ch: 800, draw: (p) => fxMolSplash(p, u), x: 68.6, y: 2.4, z: zc, w: 6, h: 6 }); }
    }
  }
  if (id === 9 && f >= 1068) {
    const k = shedK(s);
    if (k > 0 && k < 0.98) for (let i = 0; i < 4; i++) {
      const u = q(k, 30);
      out.fx.push({ key: `puff${u}`, cw: 300, ch: 300, draw: (p) => fxPuff(p, u), x: SHED.x0 + 2 + i * 3.4, y: 1.2, z: SHED.z0 + 0.5, w: 3.5, h: 3.5, soft: true });
    }
  }
};
const pancake = (cam: CamInfo, f: number, out: Stage) => {
  const unlucky = f >= 1205;
  const drift = unlucky ? smooth((f - 1209) / 40) : 0;
  out.props.push({ kind: "crate", pos: [PAN[0] + 1.8 * drift, 0.15 + 0.2 * drift, PAN[2] - 0.6 * drift], yaw: 0.3 + 0.9 * drift, roll: 0.25 * drift, size: 0.95 });
  const onCrate = !unlucky || f < 1213;
  const y = onCrate ? 0.95 : 0.95 * (1 - smooth((f - 1213) / 6));
  const expr: Expr = !unlucky ? (f < 1150 ? "grin" : "laugh") : f < 1213 ? "nervous" : "shock";
  const fo: FrontOpts = { mode: "stand", expr, blink: lidAt(f, 100, [1205]), arms: [unlucky ? [-34, -20] : null, unlucky ? [34, -24] : [30, 34]], held: plateHeld(unlucky ? 0.9 : -0.15, !unlucky), tilt: unlucky && !onCrate ? 6 : 0 };
  out.places.push(person(cam, { i: 100, o: PANMAN, okey: "pan" }, PAN[0], y, PAN[2], { side: false, mirror: false }, fo, {}, 1, `plate${unlucky}`));
};
const honey = (cam: CamInfo, f: number, out: Stage) => {
  const K = KITCHEN, P: V3 = [K[0] - 0.3, 0.32, K[2] - 0.66];
  let fo: FrontOpts;
  if (f < 1365) {
    const handle: V3 = [K[0] - 0.1, 1.12 + 0.01 * Math.sin(f / FPS * 3), K[2] - 0.1];
    fo = { mode: "stand", expr: f < 1325 ? "smile" : "grin", blink: lidAt(f, 110), look: f < 1325 ? 0 : 1, arms: [null, handTo(cam, P, handle, 0.72, "kid")], held: dots };
  } else {
    const spoonTop: V3 = [K[0] - 0.18, 0.802 + 0.09 + 0.22 + (f >= 1405 ? 0.22 * smooth((f - 1405) / 14) : 0), K[2] - 0.12];
    const hnd = handTo(cam, P, spoonTop, 0.72, "kid");
    fo = { mode: "stand", expr: f < 1400 ? "puzzled" : "strain", blink: lidAt(f, 110, [1400]), arms: [null, hnd], held: dots };
    if (f < 1395) out.fx.push({ key: `cold${q((f - 1365) / 30, 30)}`, cw: 400, ch: 300, draw: (p) => fxCold(p, q((f - 1365) / 30, 30)), x: K[0] - 0.18, y: 1.05, z: K[2] - 0.05, w: 0.6, h: 0.45, soft: true });
  }
  out.places.push(person(cam, { i: 110, o: kid(1, true), okey: "kidin" }, ...P, { side: false, mirror: false }, fo, {}, 0.72, "hk"));
};
const stuck = (cam: CamInfo, f: number, out: Stage) => {
  const S = STUCK;
  // a fireman hauls one boot out on a long strand; a sailor and a policeman are held fast where they stand
  const pull = 0.5 + 0.5 * Math.sin(f * 0.18);
  const fF: FrontOpts = { mode: "stand", expr: "strain", blink: lidAt(f, 120), arms: [[-20, 40], [20, 40]], held: dots, tilt: -4 + 3 * pull };
  out.places.push(person(cam, { i: 120, o: FIREMAN, okey: "fire" }, S[0], 0, S[2], { side: false, mirror: false }, fF, {}, 1, "h"));
  out.fx.push({ key: `strand${q(pull, 10)}`, cw: 160, ch: 400, draw: (p) => fxStrand(p, q(pull, 10)), x: S[0] + 0.12, y: 0.75 + 0.18 * pull, z: S[2] + 0.12, w: 0.18, h: 0.4 + 0.25 * pull });
  const fS: FrontOpts = { mode: "stand", expr: "nervous", blink: lidAt(f, 121), arms: [[-36, -16 + 6 * Math.sin(f * 0.3)], [36, -20 - 6 * Math.sin(f * 0.3)]], held: dots };
  out.places.push(person(cam, { i: 121, o: SAILOR, okey: "sailor" }, S[0] - 2.4, 0, S[2] - 1.6, { side: false, mirror: false }, fS, {}, 1, "h"));
  const fP: FrontOpts = { mode: "stand", expr: "puzzled", blink: lidAt(f, 122), look: -1 };
  out.places.push(person(cam, { i: 122, o: POLICE, okey: "police" }, S[0] + 2.2, 0, S[2] - 2.4, { side: false, mirror: false }, fP, {}));
  for (let i = 0; i < 14; i++) {
    const x = S[0] - 6 + hh(i, 1) * 14, z = S[2] - 5 + hh(i, 2) * 9, on = (f + Math.floor(hh(i, 3) * 40)) % 40 < 6;
    if (on) out.fx.push({ key: "spark", cw: 100, ch: 100, draw: fxSparkle, x, y: 0.75, z, w: 0.12, h: 0.12 });
  }
};
const court = (cam: CamInfo, f: number, out: Stage) => {
  const C = COURT;
  // the company's lawyer points at his anarchist; the judge's gavel lands on the tank
  const pointing = f < 1678;
  const fL: FrontOpts = { mode: "stand", expr: pointing ? "smug" : "sad", blink: lidAt(f, 130, [1678]), arms: pointing ? [null, [72, -66]] : undefined, held: dots, look: pointing ? 1 : 0 };
  out.places.push(person(cam, { i: 130, o: LAWYER, okey: "lawyer" }, C[0] - 1.6, 0, C[2] + 0.6, { side: false, mirror: false }, fL, {}, 1, "h"));
  if (pointing && f > 1626) out.fx.push({ key: `bubble${q(f / FPS, 15)}`, cw: 700, ch: 560, draw: (p) => fxBubble(p, q(f / FPS, 15)), x: C[0] - 1.3, y: 2.38, z: C[2] + 0.8, w: 1.1, h: 0.88 });
  let k = 1;
  for (const tg of GAVEL) { const n = (f / FPS - tg) * FPS; if (n >= -9 && n < -5) k = Math.min(k, 1 - smooth((n + 9) / 4)); else if (n >= -5 && n < 0) k = 0; }
  const fJ: FrontOpts = { mode: "stand", expr: f >= 1678 ? "stern" : "puzzled", blink: lidAt(f, 131, [1678]), arms: [null, [30, 18 - 30 * (1 - k)]], held: gavelHeld(q(k, 30)) };
  out.places.push(person(cam, { i: 131, o: JUDGE, okey: "judge" }, C[0], 0.8, C[2] - 1.42, { side: false, mirror: false }, fJ, {}, 1, `g${q(k, 30)}`));
  for (const tg of GAVEL) if (f / FPS >= tg && f / FPS < tg + 5 / FPS) { const u = q((f / FPS - tg) / (5 / FPS), 30); out.fx.push({ key: `burst${u}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, u), x: C[0] + 0.45, y: 1.72, z: C[2] - 1.0, w: 0.6, h: 0.6 }); }
  out.fx.push({ key: "tankpic", cw: 600, ch: 480, draw: fxTankPic, x: C[0] + 1.25, y: 1.75, z: C[2] + 0.5, w: 0.9, h: 0.72, yaw: -0.25 });
};
const engineer = (cam: CamInfo, f: number, out: Stage) => {
  const C = COURT, P: V3 = [C[0] - 2.9, 0, C[2] + 0.42];
  const k = clamp01((f - 1788) / 26), pen: V3 = [C[0] - 2.75 + 0.28 * k, 0.86 + 0.02 * Math.sin(f * 1.3), C[2] + 1.0];
  const fo: FrontOpts = { mode: "stand", expr: f < 1767 ? "smile" : f < 1788 ? "smug" : "smile_closed", blink: lidAt(f, 140, [1767]), arms: [[-24, 54], handTo(cam, P, pen)], held: penHeld };
  out.places.push(person(cam, { i: 140, o: ENGINEER, okey: "eng" }, ...P, { side: false, mirror: false }, fo, {}, 1, "pen"));
  const fJ: FrontOpts = { mode: "stand", expr: "smile", blink: lidAt(f, 131) };
  out.places.push(person(cam, { i: 131, o: JUDGE, okey: "judge" }, C[0], 0.8, C[2] - 1.42, { side: false, mirror: false }, fJ, {}));
};
const barrels = (cam: CamInfo, f: number, out: Stage) => {
  const S = SALOON, x = S[0] - 13 + 1.2 * (f - 1820) / FPS, z = FRONT_Z - 1.6;
  out.props.push({ kind: "barrel", pos: [x + 0.9, 0, z], yaw: Math.PI / 2, roll: -(x / 0.5), size: 1.0 });
  walker(cam, out, 150, worker(1), "w1", x, z, f, { dir: [1, 0], speed: 1.2, expr: "smile" });
  walker(cam, out, 151, worker(3), "w3", S[0] - 6.4, FRONT_Z - 0.9, f, { expr: "smile_closed" });
};
const saloon = (cam: CamInfo, f: number, out: Stage) => {
  const S = SALOON, sign: V3 = [S[0] + 4.0, 1.85, FRONT_Z - 0.06];
  let k = 1;
  for (const tg of HAMMER) { const n = (f / FPS - tg) * FPS; if (n >= -9 && n < -5) k = Math.min(k, 1 - smooth((n + 9) / 4)); else if (n >= -5 && n < 0) k = 0; }
  const P: V3 = [S[0] + 4.6, 0, FRONT_Z - 0.7];
  const fo: FrontOpts = { mode: "stand", expr: "stern", blink: lidAt(f, 160), arms: [handTo(cam, P, [sign[0] - 0.3, 1.7, sign[2]]), [28, -34 + 30 * k]], held: hammerHeld(q(k, 30)) };
  out.places.push(person(cam, { i: 160, o: OFFICIAL, okey: "off" }, ...P, { side: false, mirror: false }, fo, {}, 1, `hm${q(k, 30)}`));
  blob(out, P[0], 0, P[2]);
  out.fx.push({ key: "nobottle", cw: 700, ch: 520, draw: fxNoBottle, x: sign[0], y: sign[1], z: sign[2], w: 0.8, h: 0.6, yaw: Math.PI });
  for (const tg of HAMMER) if (f / FPS >= tg && f / FPS < tg + 5 / FPS) { const u = q((f / FPS - tg) / (5 / FPS), 30); out.fx.push({ key: `burst${u}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, u), x: sign[0] + 0.35, y: sign[1] + 0.2, z: sign[2] - 0.1, w: 0.55, h: 0.55 }); }
  const fB: FrontOpts = { mode: "stand", expr: "sad", blink: lidAt(f, 161, [1914]), arms: [[-20, 40], [20, 40]], held: dots };
  out.places.push(person(cam, { i: 161, o: BARTENDER, okey: "bar" }, S[0] + 2.4, 0, FRONT_Z - 0.6, { side: false, mirror: false }, fB, {}, 1, "d"));
  blob(out, S[0] + 2.4, 0, FRONT_Z - 0.6);
};
const oldman = (cam: CamInfo, f: number, out: Stage) => {
  const K = KITCHEN, P: V3 = [K[0] + 0.32, 0, K[2] - 0.78];
  let fo: FrontOpts;
  if (f < 2030) {
    const lip: V3 = [K[0] + 0.06, 1.05, K[2] + 0.06];
    fo = { mode: "stand", expr: "smile_closed", blink: lidAt(f, 170), arms: [handTo(cam, P, [lip[0] - 0.06, lip[1], lip[2]], 1, "stout"), handTo(cam, P, [lip[0] + 0.06, lip[1] + 0.05, lip[2]], 1, "stout")], held: dots };
  } else {
    const lidHit = f >= 2040 && f < 2052;
    const jarTop: V3 = [K[0] + 0.05 - (f > 2056 ? 0.2 * smooth((f - 2056) / 16) : 0), 0.99, K[2] - 0.05];
    fo = { mode: "stand", expr: "sideeye", look: f < 2040 ? 1 : 0, blink: lidAt(f, 170, [2040]), arms: [null, lidHit || f > 2052 ? handTo(cam, P, jarTop, 1, "stout") : [26, 40]], held: dots };
  }
  out.places.push(person(cam, { i: 170, o: OLDMAN, okey: "old" }, ...P, { side: false, mirror: false }, fo, {}, 1, "h"));
  if (f >= LID_F && f < LID_F + 5) { const u = q((f - LID_F) / 5, 30); out.fx.push({ key: `burst${u}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, u, "#fff3b0", 8, 30, 160), x: K[0] + 0.05, y: 1.0, z: K[2] - 0.0, w: 0.3, h: 0.3 }); }
};

/** everything with a face in shot `id` at frame f */
export const stage = (id: number, f: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [], rods: [], props: [] };
  const s = SHOTS[id - 1];
  NIGHT = s.light === "night";
  if (cam.sun) SUN.copy(cam.sun).normalize();
  switch (s.crowd) {
    case "hook": hook(cam, f, out); break;
    case "street": street(cam, f, out); break;
    case "jell": jell(cam, f, out); break;
    case "rim": if (f < 482) rim(cam, f, out); else jell(cam, f, out, true); break;
    case "painters": painters(cam, f, out); break;
    case "kids": kids(cam, f, out); break;
    case "ship": ship(cam, f, out); break;
    case "lunch": lunch(cam, f, out); break;
    case "wave": wave(cam, f, out, id); break;
    case "pancake": pancake(cam, f, out); break;
    case "honey": honey(cam, f, out); break;
    case "stuck": stuck(cam, f, out); break;
    case "court": court(cam, f, out); break;
    case "engineer": engineer(cam, f, out); break;
    case "barrels": barrels(cam, f, out); break;
    case "saloon": saloon(cam, f, out); break;
    case "oldman": oldman(cam, f, out); break;
    default: break;
  }
  return out;
};
export { FPS, colTilt, PAINT_F0, PAINT_F1, BURST_F };
