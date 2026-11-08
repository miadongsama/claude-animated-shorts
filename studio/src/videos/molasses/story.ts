// Timeline of the molasses short ("Slow as Molasses"): shots timed to shorts/molasses/voice/words.json (frames at 30 fps),
// story physics (the tank, the wave, the elevated railway, the flattened shed) and the camera grammar of the bridge short:
// continuous slow push-ins, symmetric smootherstep glides of 18-40 f, cuts for big reframes, 7-frame flip kicks on impacts.
// World axes: +x = east along Commercial Street, -z = north toward the harbour, +z = south, inland. Ground y = 0.
export const FPS = 30;
export const TOTAL = 2100;
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 4;
export const lin = (pts: [number, number][], x: number) => {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return pts[pts.length - 1][1];
};

// ---------------- places ----------------
export const D0 = 0;                       // ground (kept for code shared with the bridge files)
export const TANK: V3 = [0, 0, -17];       // tank centre on the wharf
export const TR = 13.7, TH = 15.2, ROOF_H = 2.2; // 90 ft wide, 50 ft tall
export const ST_Z0 = -4, ST_Z1 = 12;       // Commercial Street kerbs (16 m wide)
export const EL_Z0 = 0, EL_Z1 = 6;         // elevated railway deck (z range), girder underside / deck top:
export const EL_Y0 = 6.2, EL_Y1 = 7.0;
export const COLS_Z = [-1.0, 7.0];         // el columns just outside the deck
export const COLS_X = Array.from({ length: 23 }, (_, i) => -112 + i * 10); // the x = 68 pair is hit on "bending" (f1044)
export const WHARF_Z = -31, WATER_Y = -1.4;
export const FRONT_Z = 13.3;               // inland row fronts
export const SHED: { x0: number; x1: number; z0: number; z1: number; h: number } = { x0: 64.5, x1: 78.5, z0: 13.8, z1: 24, h: 6.5 }; // the front reaches it on "flattening" (f1070) // wooden shed that gets flattened
export const KITCHEN: V3 = [420, 0, 0];
export const COURT: V3 = [420, 0, 90];
export const SALOON: V3 = [96, 0, FRONT_Z];  // saloon / distillery fronts on the inland row

// ---------------- story physics ----------------
/** the tank bursts on "whole thing bursts" (frame 912); s = seconds since the burst */
export const BURST_F = 912;
export const sOf = (f: number) => (f - BURST_F) / FPS;
const S_STOP = 12;
/** radius of the wave front around the tank centre (m): 35 mph at first, slowing to a stop ~107 m out */
export const frontR = (s: number) => { const u = Math.max(0, Math.min(s, S_STOP)); return TR + 15.6 * (u - (u * u) / (2 * S_STOP)); };
/** crest height (m): 25 ft when it leaves the tank, ~1 m far out */
export const crestH = (s: number) => (s <= 0 ? 0 : (0.4 + 7.2 * Math.exp(-s / 5.2)) * smooth(s / 0.35));
/** settled depth behind the crest (m): 2-3 ft */
export const baseD = (s: number) => (s <= 0 ? 0 : 0.7 + 1.1 * Math.exp(-s / 3));
/** height of the molasses at distance r from the tank centre, s after the burst (y, m); < 0 = nothing there */
export const floodY = (r: number, s: number) => {
  if (s <= 0) return -1;
  const R = frontR(s), H = crestH(s), D = baseD(s);
  let y = -0.3;
  if (r <= R) {
    const d = R - r, face = smooth(d / (1.2 + 0.45 * H)) ** 0.8, decay = Math.exp(-Math.max(0, d - 0.45 * H) / (1.4 * H + 2.5));
    y = D * face + Math.max(0, H - D) * face * decay;
  }
  // the column that was the tank slumps out in the first second
  const col = TH * Math.exp(-s / 0.55) * (1 - smooth((r - 0.55 * TR) / (0.5 * TR + 4)));
  return Math.max(y, col);
};
/** forward curl of the crest: radial push (m) of a surface point at height y */
export const curl = (y: number, s: number) => { const H = crestH(s); return H > 0.5 ? 0.55 * H * clamp01(y / H) ** 2.4 : 0; };
/** lumps along the crest (by angle around the tank) so the top edge is not a ruler line */
export const lump = (ph: number, s: number) => 1 + 0.13 * Math.sin(7 * ph + 0.8 * s) + 0.08 * Math.sin(17 * ph - 1.7 * s) + 0.05 * Math.sin(31 * ph + 2.3 * s);
/** when the front reaches distance r (s after the burst) */
export const hitS = (r: number) => {
  if (r <= TR) return 0;
  let lo = 0, hi = S_STOP;
  if (frontR(hi) < r) return Infinity;
  for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (frontR(m) < r) lo = m; else hi = m; }
  return hi;
};
export const distT = (x: number, z: number) => Math.hypot(x - TANK[0], z - TANK[2]);
/** x where the front crosses the line z (east side), or the tank edge */
export const frontX = (s: number, z: number) => { const R = frontR(s), dz = z - TANK[2]; return R > Math.abs(dz) ? TANK[0] + Math.sqrt(R * R - dz * dz) : TANK[0]; };

/** el column tilt (rad, top pushed toward +z) at column x when s after the burst */
export const colTilt = (x: number, zc: number, s: number) => {
  const r = distT(x, zc), hs = hitS(r);
  if (!isFinite(hs) || s < hs) return 0;
  const H = crestH(hs), k = clamp01((H - 1.2) / 5);
  return 0.5 * k * easeOut((s - hs) / 0.45);
};
/** shed squash 0..1 (flattened) */
export const shedK = (s: number) => {
  const hs = hitS(distT((SHED.x0 + SHED.x1) / 2, SHED.z0));
  return isFinite(hs) ? easeOut((s - hs) / 0.35) : 0;
};
/** tank state for frame f: paint 0 (grey) .. 1 (brown), burst 0 .. 1, groan wobble */
export const PAINT_F0 = 548, PAINT_F1 = 596;
export const PAINT_TH0 = 1.5, PAINT_TH1 = 0.45; // the paint edge sweeps across the wall the painter camera sees
export const paintK = (f: number) => clamp01((f - PAINT_F0) / (PAINT_F1 - PAINT_F0));
export const burstK = (f: number) => (f < BURST_F ? 0 : clamp01(sOf(f) / 1.6));
/** roof snow 1 .. 0 during the thaw (shot 7) */
export const THAW_F0 = 712, THAW_F1 = 790;
export const snowK = (f: number) => 1 - clamp01((f - THAW_F0) / (THAW_F1 - THAW_F0));

// ---------------- shots ----------------
export type Light = "day" | "night";
export type Crowd = "none" | "hook" | "street" | "jell" | "rim" | "painters" | "kids" | "ship" | "groan" | "lunch" | "rivets" | "burst" | "wave"
  | "pancake" | "honey" | "stuck" | "court" | "engineer" | "barrels" | "saloon" | "oldman";
export type ShotDef = { id: number; a: number; b: number; light: Light; crowd: Crowd; s: (f: number) => number; place: "out" | "kitchen" | "court"; sunAz?: number; sunEl?: number; roof?: boolean };
/** s(f) = seconds after the burst shown in the shot (negative = before) */
const pre = (f: number) => sOf(f);
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 176, light: "day", crowd: "hook", place: "out", s: (f) => 1.0 + f / FPS },          // flash-forward: the wave in the street (crest ~6 m at the start)
  { id: 2, a: 176, b: 374, light: "day", crowd: "street", place: "out", s: pre },
  { id: 3, a: 374, b: 434, light: "day", crowd: "jell", place: "out", s: pre },
  { id: 4, a: 434, b: 504, light: "day", crowd: "rim", place: "out", s: pre, roof: false },
  { id: 5, a: 504, b: 599, light: "day", crowd: "painters", place: "out", s: pre },
  { id: 6, a: 599, b: 668, light: "day", crowd: "kids", place: "out", s: pre },
  { id: 7, a: 668, b: 819, light: "day", crowd: "ship", place: "out", s: pre },
  { id: 8, a: 819, b: 940, light: "day", crowd: "lunch", place: "out", s: pre },
  { id: 9, a: 940, b: 1114, light: "day", crowd: "wave", place: "out", s: pre },
  { id: 10, a: 1114, b: 1205, light: "day", crowd: "pancake", place: "out", s: pre },
  { id: 11, a: 1205, b: 1296, light: "day", crowd: "pancake", place: "out", s: pre },
  { id: 12, a: 1296, b: 1435, light: "day", crowd: "honey", place: "kitchen", s: pre, sunAz: 150, sunEl: 50 },
  { id: 13, a: 1435, b: 1469, light: "day", crowd: "wave", place: "out", s: (f) => 1.74 + (f - 1435) / FPS }, // the front hits the lamp post at x 36 ~f1452
  { id: 14, a: 1469, b: 1580, light: "night", crowd: "stuck", place: "out", s: () => 40 },
  { id: 15, a: 1580, b: 1620, light: "night", crowd: "none", place: "out", s: () => 40 },
  { id: 16, a: 1620, b: 1721, light: "day", crowd: "court", place: "court", s: () => 40, sunAz: 150, sunEl: 52 },
  { id: 17, a: 1721, b: 1820, light: "day", crowd: "engineer", place: "court", s: () => 40, sunAz: 140, sunEl: 52 },
  { id: 18, a: 1820, b: 1880, light: "day", crowd: "barrels", place: "out", s: () => -1 }, // elsewhere, no flood
  { id: 19, a: 1880, b: 1951, light: "day", crowd: "saloon", place: "out", s: () => -1 },
  { id: 20, a: 1951, b: TOTAL, light: "day", crowd: "oldman", place: "kitchen", s: pre, sunAz: 150, sunEl: 40 },
];
/** crossfades (frames) at place/time changes; a white 4-frame flash after the hook */
export const XFADE: Record<number, number> = { 12: 8, 13: 8, 14: 14, 16: 8, 18: 8, 20: 8 };
export const FLASH_AT = 176;

export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

// ---------------- the hook runner and the wave on the street ----------------
/** street centre line the hook is staged on */
export const HOOK_Z = 9.6;
export const runnerX = (f: number) => { const s = SHOTS[0].s(f); return frontX(s, HOOK_Z) + lin([[0, 9], [120, 6], [176, 3.2]], f); };

// ---------------- camera ----------------
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
type Shot = Partial<Cam> & { pos: V3; look: V3 };
type Key = { f: number; dur?: number; cut?: boolean; s: (f: number) => Shot };
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
const mixC = (a: Cam, b: Cam, k: number): Cam => ({
  pos: a.pos.map((v, i) => v + (b.pos[i] - v) * k) as V3, look: a.look.map((v, i) => v + (b.look[i] - v) * k) as V3,
  fov: a.fov + (b.fov - a.fov) * k, roll: a.roll + (b.roll - a.roll) * k,
});
const full = (c: Shot): Cam => ({ fov: 40, roll: 0, ...c });
const run = (keys: Key[], f: number) => {
  let cur = full(keys[0].s(f));
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (f < k.f) break;
    cur = k.cut ? full(k.s(f)) : mixC(cur, full(k.s(f)), glide((f - k.f) / (k.dur ?? 24)));
  }
  return cur;
};
/** push-in factor since f0 (subject grows ~rate per frame; punch raises it for n frames with 8 f soft edges) */
const pushK = (f: number, f0: number, rate: number, punch = 0, n = 35) => {
  const x = Math.max(0, f - f0);
  let s = rate * x;
  if (punch > rate) for (let i = 0; i < Math.min(x, n); i++) s += (punch - rate) * Math.max(0, Math.min(1, (i + 0.5) / 8, (n - i - 0.5) / 8));
  return Math.exp(-s);
};
const dolly = (pos: V3, look: V3, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos: [look[0] + (pos[0] - look[0]) * k, look[1] + (pos[1] - look[1]) * k, look[2] + (pos[2] - look[2]) * k], look, ...rest });
const zoom = (pos: V3, look: V3, fov: number, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos, look, fov: (360 / Math.PI) * Math.atan(Math.tan((fov * Math.PI) / 360) * k), ...rest });
const rolled = (s: (f: number) => Shot, roll: number) => (f: number): Shot => ({ ...s(f), roll });
/** a point on the tank wall at angle th (rad, 0 = facing the street +z, + toward +x), height y, pushed out by `out` m */
export const wallPt = (th: number, y: number, out = 0): V3 => [TANK[0] + (TR + out) * Math.sin(th), y, TANK[2] + (TR + out) * Math.cos(th)];
const K = KITCHEN, C = COURT;

// shot 1 (hook): the camera backs down the street ahead of the runner and the wave
const S1a = (f: number) => { const x = runnerX(f); return { pos: [x + 9.5, 1.35, HOOK_Z + 1.5] as V3, look: [x - 4, 3.3, HOOK_Z - 1.2] as V3, fov: 50 }; };
const S1b = (f: number) => { const x = runnerX(f); return { pos: [x + 6.8, 1.1, HOOK_Z + 1.3] as V3, look: [x - 3, 3.1, HOOK_Z - 0.8] as V3, fov: 48, roll: -0.04 }; };
const S1c = (f: number) => { const x = runnerX(f); return { pos: [x + 13, 12.5, HOOK_Z + 2.6] as V3, look: [x - 7, 1.6, HOOK_Z - 2.5] as V3, fov: 48, roll: 0.03 }; };
const S1d = (f: number) => { const x = runnerX(f); return { pos: [x + 3.0, 1.45, HOOK_Z + 0.7] as V3, look: [x - 0.3, 1.8, HOOK_Z - 0.2] as V3, fov: 42, roll: -0.045 }; };
// shot 2: winter aerial over the harbour -> the tank from the street -> looking up its 50 ft wall -> crane up the side
const S2a = (f: number) => zoom([62, 40, -98], [0, 5, 2], 44, pushK(f, 176, 0.0018));
const S2b = (f: number) => zoom([24, 2.2, -2.2], [0, 7.5, -17], 46, pushK(f, 230, 0.002));
const S2c = (f: number) => { const c = wallPt(0.95, 0.5, 8.5), l = wallPt(0.85, 7.6, 0); return dolly(c, l, pushK(f, 258, 0.0012, 0.004, 32), { fov: 86, roll: 0.03 }); }; // wide lens: the whole 50 ft wall over a man
const S2d = (f: number) => dolly([15, 20.5, -1.5], [0, 15.5, -17], pushK(f, 302, 0.0018), { fov: 46 });
// shot 3: Jell and his blueprint (tank soft behind)
export const JELL: V3 = [5.0, 0, -2.5];
const S3a = (f: number) => dolly([JELL[0] + 2.4, 1.62, JELL[2] + 3.6], [JELL[0], 1.55, JELL[2]], pushK(f, 374, 0.0025), { fov: 38 });
const S3b = (f: number) => dolly([JELL[0] + 1.6, 1.62, JELL[2] + 2.9], [JELL[0], 1.6, JELL[2]], pushK(f, 398, 0.002, 0.006, 28), { fov: 36, roll: 0.04 });
// shot 4: down into the empty tank from the rim (six inches of water at the bottom), then Jell's thumbs-up
const S4a = (f: number) => dolly(wallPt(0.5, TH + 2.4, -0.8), [TANK[0], 0.6, TANK[2]], pushK(f, 434, 0.0022), { fov: 60 }); // down into the empty tank: one tiny puddle
const S4b = (f: number) => dolly([JELL[0] + 2.1, 1.5, JELL[2] + 3.1], [JELL[0], 1.45, JELL[2]], pushK(f, 482, 0.003, 0.006, 22), { fov: 38, roll: -0.04 });
// shot 5: a leaking seam close-up, then the painters
const SEAM = 0.55; // wall angle of the leaking seam (rad)
const S5a = (f: number) => { const p = wallPt(SEAM, 2.6), q = wallPt(SEAM + 0.1, 2.0, 3.6); return dolly(q, p, pushK(f, 504, 0.0025, 0.006, 30), { fov: 38 }); };
const S5b = (f: number) => zoom([18.8, 1.9, -6.0], [11.2, 3.4, -9.6], 50, pushK(f, 544, 0.0022));
// shot 6: kids with buckets at the foot of the (now brown) tank
const KIDS = 0.28; // wall angle in front of which the kids stand
const S6a = (f: number) => { const p = wallPt(KIDS, 0.85, 1.6), q = wallPt(KIDS + 0.08, 1.05, 5.4); return dolly(q, p, pushK(f, 599, 0.0025), { fov: 40 }); };
const S6b = (f: number) => { const p = wallPt(KIDS - 0.02, 0.95, 1.7), q = wallPt(KIDS + 0.02, 1.0, 4.0); return dolly(q, p, pushK(f, 632, 0.002, 0.005, 26), { fov: 38, roll: 0.035 }); };
// shot 7: the ship tops it up -> icicles drip on the shed roof by the tank -> the tank groans
export const SHIP = { x0: -78, x1: -26, z: -40, w: 10 };
const S7a = (f: number) => zoom([-74, 21, -100], [-20, 8, -24], 46, pushK(f, 668, 0.002));
const S7b = (f: number) => dolly([29.6, 3.8, -2.3], [27.0, 5.4, -5.7], pushK(f, 708, 0.0025), { fov: 44 });
const S7c = (f: number) => { const p = wallPt(-0.3, 3.0), q = wallPt(-0.27, 1.25, 7.4); return zoom(q, p, 50, pushK(f, 767, 0.0025, 0.005, 30), { roll: 0.04 }); };
// shot 8: lunch at the foot of the tank -> rivets shoot out -> the whole thing bursts
const LUNCH = -0.42;
const S8a = (f: number) => { const p = wallPt(LUNCH, 1.1, 1.4), q = wallPt(LUNCH - 0.1, 1.35, 5.6); return dolly(q, p, pushK(f, 819, 0.0025), { fov: 40 }); };
export const RIV_TH = -0.47;
const S8b = (f: number) => { const p = wallPt(RIV_TH, 4.6), q = wallPt(RIV_TH - 0.12, 2.6, 4.2); return dolly(q, p, pushK(f, 842, 0.003, 0.007, 30), { fov: 40, roll: -0.04 }); };
const S8c = (f: number) => zoom([30, 17, 12], [0, 6.5, -17], 48, pushK(f, 898, 0.0018));
// shot 9: the wave down the street -> its height -> racing alongside -> the el columns buckle -> the shed is flattened
const S9a = (f: number) => zoom([56, 1.9, 10.2], [22, 4.4, 5.0], 46, pushK(f, 940, 0.0015));
const S9b = (f: number) => zoom([51, 0.8, 10.0], [28, 6.0, 3.0], 48, pushK(f, 958, 0.0015, 0.005, 30), { roll: 0.04 }); // the crest reaches this lens just after the cut at f1000
const S9c = (f: number) => { const x = frontX(sOf(f), 4); return { pos: [x + 1.5, 3.0, 12.6] as V3, look: [x - 0.8, 2.8, 0] as V3, fov: 50, roll: -0.03 }; };
const S9d = (f: number) => zoom([76, 2.2, 12.6], [68.5, 4.2, 3.0], 46, pushK(f, 1044, 0.002), { roll: 0.035 });
const S9e = (f: number) => zoom([81, 4.8, 6.0], [71.0, 2.4, 16.5], 50, pushK(f, 1071, 0.002)); // above the crest: the front reaches this spot before the shot ends
// shots 10-11 share one camera: the pancake man on his crate, closer on "Unluckily" (roll)
export const PAN: V3 = [42, 0, 11.6];
const S10a = (f: number) => dolly([PAN[0] + 2.0, 1.75, PAN[2] - 4.6], [PAN[0], 1.55, PAN[2]], pushK(f, 1110, 0.0018), { fov: 40, roll: -0.03 });
const S11a = (f: number) => dolly([PAN[0] + 1.6, 1.6, PAN[2] - 3.8], [PAN[0], 1.5, PAN[2]], pushK(f, 1201, 0.0018), { fov: 38, roll: 0.04 });
// shot 12: the kitchen: a honey jar, warm honey pours, cold honey is glue
const S12a = (f: number) => dolly([K[0] + 0.15, 1.35, K[2] + 2.3], [K[0] - 0.1, 1.0, K[2]], pushK(f, 1292, 0.0025), { fov: 38 });
const S12b = (f: number) => dolly([K[0] + 0.55, 1.18, K[2] + 1.15], [K[0] + 0.1, 0.98, K[2] + 0.1], pushK(f, 1325, 0.002), { fov: 36, roll: 0.03 });
const S12c = (f: number) => dolly([K[0] - 0.2, 1.4, K[2] + 2.2], [K[0] - 0.35, 1.15, K[2] - 0.1], pushK(f, 1365, 0.0025, 0.006, 30), { fov: 38, roll: -0.035 });
// shot 13: the runny wave races past a lamp post (day)
const S13a = (f: number) => { const up = smooth((f - 1446) / 22); return zoom([48, 1.5 + 2.6 * up, 11.2], [28, 2.8 + 0.4 * up, 8.0], 46, pushK(f, 1431, 0.002)); }; // ahead of the front all shot (it reaches x 48 at ~f1473)
// shot 14: the freezing night: the flood set solid, rescuers stuck where they stand
export const STUCK: V3 = [31, 0, 3.2]; // past the reach of the fallen wall panels (~33 m from the tank centre)
const S14a = (f: number) => zoom([STUCK[0] + 2.5, 3.0, STUCK[2] + 7.4], [STUCK[0] - 0.6, 1.3, STUCK[2] - 0.6], 44, pushK(f, 1465, 0.0018)); // between the bent columns
const S14b = (f: number) => dolly([STUCK[0] + 3.0, 1.5, STUCK[2] + 3.4], [STUCK[0] + 0.2, 1.25, STUCK[2]], pushK(f, 1532, 0.0025), { fov: 38, roll: 0.035 });
// shot 15: the silent wide (night)
const S15a = (f: number) => zoom([58, 10.5, 30], [2, 3.5, -10], 44, pushK(f, 1576, 0.0012));
// shot 16: the courtroom: the company blames anarchists, the court blames the tank (gavel)
const S16a = (f: number) => dolly([C[0] - 1.2, 1.6, C[2] + 4.2], [C[0] - 1.6, 1.55, C[2] + 0.6], pushK(f, 1616, 0.0025), { fov: 40 });
const S16b = (f: number) => dolly([C[0] + 0.9, 1.95, C[2] + 4.6], [C[0] + 0.75, 1.8, C[2] - 0.5], pushK(f, 1678, 0.0025, 0.006, 24), { fov: 42, roll: 0.035 });
// shot 17: a real engineer signs the plans
const S17a = (f: number) => dolly([C[0] - 2.2, 1.55, C[2] + 3.4], [C[0] - 2.9, 1.25, C[2] + 1.2], pushK(f, 1717, 0.0025), { fov: 40 });
const S17b = (f: number) => dolly([C[0] - 2.35, 1.55, C[2] + 3.0], [C[0] - 2.85, 1.25, C[2] + 0.95], pushK(f, 1767, 0.0015, 0.004, 24), { fov: 40, roll: -0.03 });
// shot 18: barrels by the distillery door; shot 19: the saloon gets its new sign
const S18a = (f: number) => zoom([SALOON[0] - 13.0, 2.4, SALOON[2] - 7.5], [SALOON[0] - 4.8, 1.9, SALOON[2]], 46, pushK(f, 1816, 0.002)); // the distillery door, clear of the el column at x 88
const S19a = (f: number) => dolly([SALOON[0] + 6.5, 1.7, SALOON[2] - 6.0], [SALOON[0] + 4.3, 1.75, SALOON[2] + 0.2], pushK(f, 1880, 0.0022, 0.005, 26), { fov: 40, roll: 0.03 });
// shot 20: the kitchen in January: slow molasses, then a deadpan Bostonian puts the lid back on
const S20a = (f: number) => dolly([K[0] + 0.7, 1.32, K[2] + 2.0], [K[0] + 0.25, 1.0, K[2] - 0.1], pushK(f, 1947, 0.002), { fov: 38 });
const S20b = (f: number) => dolly([K[0] + 0.45, 1.38, K[2] + 2.0], [K[0] + 0.25, 1.12, K[2] - 0.3], pushK(f, 2030, 0.0022, 0.005, 30), { fov: 40, roll: 0.03 }); // face, jar and lid in frame

const CAMS: Record<number, Key[]> = {
  1: [
    { f: 0, s: S1a },
    { f: 41, dur: 30, s: S1b },      // "wave": closer, lower
    { f: 97, cut: true, s: S1c },    // "Boston": high over the street (the wave fills it)
    { f: 130, cut: true, s: S1d },   // "moved faster than you can run": the runner's face, the wave behind
  ],
  2: [
    { f: 176, s: S2a },
    { f: 230, cut: true, s: S2b },   // "a steel tank"
    { f: 258, cut: true, s: S2c },   // "fifty feet tall"
    { f: 292, dur: 40, s: S2d },     // "holding two point three million gallons": crane up the side
  ],
  3: [
    { f: 374, s: S3a },
    { f: 398, dur: 22, s: S3b },     // "couldn't read"
  ],
  4: [
    { f: 434, s: S4a },
    { f: 482, cut: true, s: S4b },   // "of water": thumbs up
  ],
  5: [
    { f: 504, s: S5a },
    { f: 544, cut: true, s: S5b },   // "so the company painted it brown"
  ],
  6: [
    { f: 599, s: S6a },
    { f: 632, dur: 24, s: S6b },     // "scoop up the drips"
  ],
  7: [
    { f: 668, s: S7a },
    { f: 708, cut: true, s: S7b },   // "a warm spell thaws"
    { f: 767, cut: true, s: S7c },   // "and the tank starts to groan"
  ],
  8: [
    { f: 819, s: S8a },
    { f: 842, cut: true, s: S8b },   // "rivets shoot out"
    { f: 898, cut: true, s: S8c },   // "and the whole thing bursts"
  ],
  9: [
    { f: 940, s: S9a },
    { f: 958, cut: true, s: S9b },   // "twenty-five feet high"
    { f: 1000, cut: true, s: S9c },  // "thirty-five miles an hour": racing alongside
    { f: 1040, cut: true, s: S9d },  // "bending the railway"
    { f: 1068, cut: true, s: S9e },  // "flattening buildings"
  ],
  10: [
    { f: 1110, s: S10a },
    { f: 1201, dur: 18, s: S11a },   // "Unluckily" (runs across the invisible 10 -> 11 change)
  ],
  12: [
    { f: 1292, s: S12a },
    { f: 1325, cut: true, s: S12b }, // "Warm, it pours"
    { f: 1365, cut: true, s: S12c }, // "Straight from the fridge"
  ],
  13: [{ f: 1431, s: S13a }],
  14: [
    { f: 1465, s: S14a },
    { f: 1532, cut: true, s: S14b }, // "holding people where they stood"
  ],
  15: [{ f: 1576, s: S15a }],
  16: [
    { f: 1616, s: S16a },
    { f: 1678, cut: true, s: S16b }, // "The court blamed the tank"
  ],
  17: [
    { f: 1717, s: S17a },
    { f: 1767, dur: 24, s: S17b },   // "real engineer"
  ],
  18: [{ f: 1816, s: S18a }],
  19: [{ f: 1876, s: S19a }],
  20: [
    { f: 1947, s: S20a },
    { f: 2030, cut: true, s: S20b }, // "Boston knows better"
  ],
};
CAMS[11] = CAMS[10];

// impact kicks: the image offset flips sign every frame, decays to 0 in 7 f (seconds, gain)
export const RIVETS = [842, 850, 857, 862, 866, 871, 876, 881].map((f) => f / FPS);
export const GAVEL = [1688 / FPS, 1697 / FPS];
export const HAMMER = [1913 / FPS, 1921 / FPS, 1928 / FPS];
export const LID_F = 2046;
const KICKS: [number, number][] = [
  ...RIVETS.map((t) => [t, 0.35] as [number, number]), [BURST_F / FPS, 1.8], [(BURST_F + 8) / FPS, 1.0],
  [1044 / FPS, 0.9], [1071 / FPS, 1.1], ...GAVEL.map((t) => [t, 0.6] as [number, number]), ...HAMMER.map((t) => [t, 0.5] as [number, number]), [LID_F / FPS, 0.5],
];
export const kickAt = (t: number) => {
  let a = 0;
  for (const [t0, g] of KICKS) {
    const n = Math.floor((t - t0) * FPS + 1e-6);
    if (n >= 0 && n < 7) a += g * (n % 2 ? -1 : 1) * (1 - n / 7) ** 1.5;
  }
  return a;
};
export const camAt = (id: number, f: number): Cam => {
  const c = run(CAMS[id], f), a = kickAt(f / FPS);
  if (!a) return c;
  const d: V3 = [c.look[0] - c.pos[0], c.look[1] - c.pos[1], c.look[2] - c.pos[2]];
  const L = Math.hypot(...d), h = Math.hypot(d[0], d[2]) || 1;
  const m = (3 / 640) * Math.tan((c.fov * Math.PI) / 360) * L * a;
  return { ...c, look: [c.look[0] - (d[2] / h) * m, c.look[1] + 0.6 * m, c.look[2] + (d[0] / h) * m], roll: c.roll + a * 0.004 };
};
export const keyEnd = (id: number, f: number) => {
  let e = 0;
  for (const k of CAMS[id]) if (f >= k.f) e = k.f + (k.cut ? 0 : k.dur ?? 24);
  return Math.max(f, e);
};

// ---------------- lens: depth of field + foreground framing ----------------
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
export const DOF: Dof[] = [
  { f: 0, cInf: 0 },                                                       // hook wide: wave + runner + street sharp
  { f: 130, cInf: 14, focus: (f) => [runnerX(f), 1.75, HOOK_Z] },          // the runner's face, the wave soft behind
  { f: 176, cInf: 0 },                                                     // aerial, street, the wall, crane
  { f: 374, cInf: 12, focus: () => [JELL[0], 1.6, JELL[2]] },              // Jell MS
  { f: 434, cInf: 0 },                                                     // into the tank
  { f: 482, cInf: 12, focus: () => [JELL[0], 1.6, JELL[2]] },              // thumbs-up
  { f: 504, cInf: 14 },                                                    // leaking seam (focus = look)
  { f: 544, cInf: 0 },                                                     // painters
  { f: 599, cInf: 10 },                                                    // kids (focus = look)
  { f: 668, cInf: 0 },                                                     // ship wide
  { f: 708, cInf: 12 },                                                    // icicles (focus = look)
  { f: 767, cInf: 0 },                                                     // groan
  { f: 819, cInf: 10 },                                                    // lunch
  { f: 842, cInf: 12 },                                                    // rivets
  { f: 898, cInf: 0 },                                                     // the burst and the wave: readable
  { f: 1114, cInf: 10, focus: () => [PAN[0], 1.6, PAN[2]] },               // pancake man
  { f: 1296, cInf: 12 },                                                   // kitchen inserts (focus = look)
  { f: 1435, cInf: 0 },                                                    // runny wave, night street
  { f: 1532, cInf: 10, focus: () => [STUCK[0] + 0.2, 1.4, STUCK[2]] },     // stuck rescuers
  { f: 1580, cInf: 0 },                                                    // silent wide
  { f: 1620, cInf: 10 },                                                   // courtroom (focus = look)
  { f: 1820, cInf: 0 },                                                    // barrels, saloon
  { f: 1880, cInf: 8 },
  { f: 1951, cInf: 12 },                                                   // kitchen in January
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
export const focusAt = (id: number, f: number): V3 => {
  const d = dofAt(f);
  return d.focus ? d.focus(f) : camAt(id, f).look;
};

/** near framing objects (Kenney / cartoon plants), visible while a <= f < b inside their own shot */
export type Fg = { a: number; b: number; kit: string; pos: V3; s?: number; yaw?: number };
export const FOREGROUND: Fg[] = [
  { a: 1114, b: 1296, kit: "barrel", pos: [PAN[0] + 1.1, 0, PAN[2] - 2.3], s: 0.95 },
];
