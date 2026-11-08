// Light presets per time of day (molasses short). The sun is CAMERA-RELATIVE and frozen per shot (world.ts update()):
// az = degrees from the shot camera's forward axis (0 = straight ahead = backlight, +90 = screen right, 180 = behind
// camera), el = elevation. lit/shade/lift are LINEAR RGB multipliers for shade.ts (may exceed 1).
// day: a clear January noon in Boston (low sun, crisp cool shade); night: the freezing night after the flood (moonlight,
// warm gas lamps). Field names follow the bridge presets (cast.ts / cardshade.ts read them).
type C3 = [number, number, number];
export type LightName = "day" | "night";
export type LightPreset = {
  az: number; el: number;
  lit: C3; shade: C3; lift: C3; lambert: number; sideK: number; term: number;
  charTint: C3; charShade: number; charGrad: number; bodyGrad: number; sideTint: C3;
  blob: C3; actorShadow: boolean;
  top: string; hor: string; skyCurve: C3; fog: string; fogNear: number; fogFar: number; sunDisc: string;
  sunCol: string; sunI: number; sky: string; ground: string; hemiI: number;
  bias: number; normalBias: number;
};
export const LIGHTS: Record<LightName, LightPreset> = {
  day: {
    az: 125, el: 34,
    lit: [1.6, 1.5, 1.34], shade: [0.31, 0.31, 0.4], lift: [0.05, 0.06, 0.12], lambert: 0.35, sideK: 0.84, term: 0.2,
    charTint: [1.0, 0.95, 0.93], charShade: 0.86, charGrad: 0.07, bodyGrad: 0.2, sideTint: [0.92, 0.9, 0.97],
    blob: [0.62, 0.58, 0.6], actorShadow: false,
    top: "#4a86d4", hor: "#c4d8ef", skyCurve: [0.0, 0.5, 0.6], fog: "#c4d8ef", fogNear: 30, fogFar: 330, sunDisc: "#000000",
    sunCol: "#fff3e0", sunI: 2.8, sky: "#dcecff", ground: "#b49a78", hemiI: 0.55,
    bias: -0.00025, normalBias: 0.015,
  },
  night: {
    az: 40, el: 34,
    lit: [0.95, 1.05, 1.4], shade: [0.22, 0.24, 0.42], lift: [0.05, 0.06, 0.15], lambert: 0.4, sideK: 0.8, term: 0.2,
    charTint: [0.8, 0.84, 1.02], charShade: 0.84, charGrad: 0.1, bodyGrad: 0.25, sideTint: [0.82, 0.86, 1.0],
    blob: [0.55, 0.58, 0.75], actorShadow: false,
    top: "#16244c", hor: "#4a5f96", skyCurve: [0.0, 0.5, 0.6], fog: "#3e5286", fogNear: 30, fogFar: 300, sunDisc: "#000000",
    sunCol: "#c4d4ff", sunI: 1.2, sky: "#5a6c9c", ground: "#2a2a40", hemiI: 0.4,
    bias: -0.0003, normalBias: 0.02,
  },
};

/** world-only look per light (sky stops by elevation in degrees, harbour colours, cloud palette): ON-SCREEN targets */
export type WorldLook = {
  sky: { c: string[]; e: number[] };
  water: { near: string; mid: string; far: string; crest: string; trough: string; glint: string; shade: C3 };
  bounce: C3; sat: number;
  cloud: { lit: string; mid: string; shade: string };
};
export const LOOK: Record<LightName, WorldLook> = {
  day: {
    // crisp winter blue: a little paler at the horizon than the bridge's summer sky
    sky: { c: ["#c4d8ef", "#a9c8ec", "#79a9e2", "#5a92db", "#3c79cc"], e: [0, 3, 8, 16, 40] },
    water: { near: "#3a6e84", mid: "#30607e", far: "#4a6c8a", crest: "#7aa6b8", trough: "#24506e", glint: "#d8eef6", shade: [0.5, 0.56, 0.72] },
    cloud: { lit: "#fbf8f1", mid: "#e1e5f3", shade: "#c3cbe9" },
    bounce: [0, 0, 0],
    sat: 1.06,
  },
  night: {
    sky: { c: ["#4a5f96", "#3a4f86", "#2a3c6e", "#1f2e58", "#142040"], e: [0, 4, 10, 20, 45] },
    water: { near: "#1a2a52", mid: "#16264a", far: "#2a3a66", crest: "#5a74a8", trough: "#0c1630", glint: "#ffd9a0", shade: [0.5, 0.56, 0.72] },
    cloud: { lit: "#56689a", mid: "#3e4e7c", shade: "#2c385e" },
    bounce: [0.02, 0.015, 0.0],
    sat: 1.0,
  },
};
