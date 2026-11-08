// Painted textures for the molasses short (1919 North End): brick tenement facades with sash windows and stone lintels,
// plank sheds, the saloon / distillery / firehouse / warehouse fronts, the riveted tank plates (bare steel and the brown
// paint), molasses swirls, the el's lattice girders, kitchen + courtroom interiors and the snowy view out of a window.
// Same painting rules as paint.ts: flat base, low-contrast blotches, seams as dark tints, no outlines thicker than 2 px.
import * as THREE from "three";
import { ctex, jit } from "./paint";

const U = (r: () => number, a: number, b: number) => a + (b - a) * r();
const blot = (g: CanvasRenderingContext2D, x: number, y: number, rad: number, rgb: string, a: number) => {
  const gr = g.createRadialGradient(x, y, 0, x, y, rad);
  gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
};
const bricks = (g: CanvasRenderingContext2D, r: () => number, W: number, H: number, m: (v: number) => number, wall: string, mortar = "#d9c3a4") => {
  g.fillStyle = mortar; g.fillRect(0, 0, W, H);
  const bw = m(0.25), bh = m(0.085);
  for (let y = 0, row = 0; y < H; y += bh, row++) for (let x = -(row % 2) * bw / 2; x < W; x += bw) {
    g.fillStyle = jit(r, wall, 0.09, 4, 0.12);
    g.fillRect(x + 1, y + 1, bw - 2, bh - 2);
  }
  const n = Math.round((W * H) / (m(1) * m(1) * 10)) + 4;
  for (let i = 0; i < n; i++) blot(g, U(r, 0, W), U(r, 0, H), m(U(r, 0.5, 1.6)), "60,35,30", U(r, 0.05, 0.11));
};
/** a sash window with a stone lintel and sill, centred at cx, sill at by (canvas px) */
const sash = (g: CanvasRenderingContext2D, r: () => number, m: (v: number) => number, cx: number, by: number, trim: string, arch = false) => {
  const ww = m(0.95), wh = m(1.6), x0 = cx - ww / 2, y0 = by - wh;
  g.fillStyle = trim; g.fillRect(x0 - m(0.12), y0 - m(0.28), ww + m(0.24), m(0.24)); // lintel
  if (arch) { g.beginPath(); g.arc(cx, y0 - m(0.04), ww / 2 + m(0.1), Math.PI, 0); g.fill(); }
  g.fillStyle = trim; g.fillRect(x0 - m(0.1), by, ww + m(0.2), m(0.12)); // sill
  g.fillStyle = "rgba(50,35,30,0.4)"; g.fillRect(x0 - m(0.1), by + m(0.12), ww + m(0.2), m(0.03));
  g.fillStyle = "#efe8da"; g.fillRect(x0 - m(0.05), y0 - m(0.05), ww + m(0.1), wh + m(0.1));
  const lit = r() < 0.18;
  const gl = g.createLinearGradient(0, y0, 0, by);
  if (lit) { gl.addColorStop(0, "#f2d79a"); gl.addColorStop(1, "#d9a85e"); } else { gl.addColorStop(0, "#7f8fc9"); gl.addColorStop(1, "#4c5594"); }
  g.fillStyle = gl; g.fillRect(x0, y0, ww, wh);
  if (r() < 0.4) { g.fillStyle = ["#f3e3c6", "#e8d2b8", "#d7e6cf"][Math.floor(r() * 3)]; g.fillRect(x0, y0, ww, wh * U(r, 0.15, 0.45)); } // blind
  g.fillStyle = "#efe8da"; g.fillRect(x0, y0 + wh / 2 - m(0.03), ww, m(0.06)); g.fillRect(cx - m(0.02), y0, m(0.04), wh);
  g.save(); g.beginPath(); g.rect(x0, y0, ww, wh); g.clip(); g.fillStyle = "rgba(255,255,255,0.4)";
  g.save(); g.translate(x0 + ww * 0.3, y0 + wh * 0.5); g.rotate(Math.PI / 4); g.fillRect(-m(0.03), -wh, m(0.06), wh * 2); g.restore(); g.restore();
  g.strokeStyle = "rgba(50,35,30,0.55)"; g.lineWidth = 1.5; g.strokeRect(x0 - m(0.05), y0 - m(0.05), ww + m(0.1), wh + m(0.1));
};
const PXM = (wm: number, hm: number) => Math.min(64, 2048 / Math.max(wm, hm));

/** brick tenement facade: storeys x windows, a shop front on the ground floor when `shop` is set */
export const blockFacade = (key: string, wm: number, hm: number, wall: string, trim: string, storeys: number, shop?: string) => {
  const PX = PXM(wm, hm), W = Math.round(wm * PX), H = Math.round(hm * PX), m = (v: number) => v * PX;
  return ctex("blk" + key, W, H, (g, r) => {
    bricks(g, r, W, H, m, wall);
    const nWin = Math.max(1, Math.round(wm / 2.6));
    for (let s = 0; s < storeys; s++) {
      const by = H - m(s * 3.2 + 1.0);
      if (s === 0 && shop) {
        g.fillStyle = shop; g.fillRect(m(0.4), H - m(3.0), W - m(0.8), m(2.9));
        g.fillStyle = "rgba(255,255,255,0.15)"; g.fillRect(m(0.4), H - m(3.0), W - m(0.8), m(0.08));
        g.fillStyle = "#2a2a3a"; g.fillRect(m(0.4), H - m(3.05), W - m(0.8), m(0.4)); // fascia (no lettering)
        for (let i = 0; i < 2; i++) {
          const x0 = m(0.9) + (i * (W - m(1.8))) / 2 + m(0.1), x1 = x0 + (W - m(1.8)) / 2 - m(1.2);
          const gl = g.createLinearGradient(0, H - m(2.5), 0, H - m(0.6)); gl.addColorStop(0, "#9fb0dc"); gl.addColorStop(1, "#56609c");
          g.fillStyle = gl; g.fillRect(x0, H - m(2.5), x1 - x0, m(1.9));
          g.strokeStyle = "rgba(240,235,220,0.9)"; g.lineWidth = m(0.06); g.strokeRect(x0, H - m(2.5), x1 - x0, m(1.9));
        }
        g.fillStyle = "#4a3022"; g.fillRect(W / 2 - m(0.55), H - m(2.4), m(1.1), m(2.4));
        g.strokeStyle = "rgba(30,20,15,0.6)"; g.lineWidth = 2; g.strokeRect(W / 2 - m(0.55), H - m(2.4), m(1.1), m(2.4));
        continue;
      }
      for (let i = 0; i < nWin; i++) {
        const cx = ((i + 0.5) * W) / nWin;
        if (s === 0 && i === Math.floor(nWin / 2)) { // stoop door
          g.fillStyle = trim; g.fillRect(cx - m(0.75), H - m(2.75), m(1.5), m(2.75));
          g.fillStyle = "#3e2a20"; g.fillRect(cx - m(0.55), H - m(2.5), m(1.1), m(2.5));
          g.fillStyle = "rgba(255,230,190,0.18)"; for (let k = 1; k < 4; k++) g.fillRect(cx - m(0.55) + k * m(0.27), H - m(2.5), 2, m(2.5));
          continue;
        }
        sash(g, r, m, cx, by, trim, s === storeys - 1);
      }
      if (s > 0) { g.fillStyle = "rgba(240,230,210,0.5)"; g.fillRect(0, H - m(s * 3.2) - m(0.06), W, m(0.1)); } // belt course
    }
    g.fillStyle = "rgba(60,45,40,0.35)"; g.fillRect(0, H - m(0.35), W, m(0.35));
  });
};

/** weathered vertical plank boards (sheds, doors, barrel staves, crates); `n` boards per texture width */
export const shedPlanks = (key: string, col: string, n: number) => ctex(key, 512, 512, (g, r) => {
  const bw = 512 / n;
  for (let i = 0; i < n; i++) {
    g.fillStyle = jit(r, col, 0.1, 4, 0.15); g.fillRect(i * bw, 0, bw, 512);
    for (let k = 0; k < 5; k++) { g.fillStyle = "rgba(60,35,20,0.12)"; g.fillRect(i * bw + U(r, 2, bw - 4), 0, 1.5, 512); }
    g.fillStyle = "rgba(40,20,10,0.5)"; g.fillRect(i * bw, 0, 2.5, 512);
    g.fillStyle = "rgba(255,230,200,0.18)"; g.fillRect(i * bw + 3, 0, 2, 512);
    for (const y of [60, 450]) { g.fillStyle = "#3a2a20"; g.beginPath(); g.arc(i * bw + bw / 2, y, 3, 0, 7); g.fill(); }
  }
  for (let i = 0; i < 10; i++) blot(g, U(r, 0, 512), U(r, 0, 512), U(r, 30, 90), "60,40,30", 0.08);
});

const frontBase = (key: string, wm: number, hm: number, draw: (g: CanvasRenderingContext2D, r: () => number, W: number, H: number, m: (v: number) => number) => void, wall = "#a8513a") => {
  const PX = PXM(wm, hm), W = Math.round(wm * PX), H = Math.round(hm * PX), m = (v: number) => v * PX;
  return ctex(key, W, H, (g, r) => {
    bricks(g, r, W, H, m, wall);
    for (let s = 1; s < Math.floor(hm / 3.2); s++) {
      const n = Math.max(1, Math.round(wm / 2.6));
      for (let i = 0; i < n; i++) sash(g, r, m, ((i + 0.5) * W) / n, H - m(s * 3.2 + 1.0), "#e9dcc0", s === Math.floor(hm / 3.2) - 1);
    }
    draw(g, r, W, H, m);
  });
};
/** saloon front (10 m): big windows, swinging half-doors, an awning painted above; no lettering */
export const saloonFront = () => frontBase("saloonFront", 10, 13.4, (g, r, W, H, m) => {
  g.fillStyle = "#3f2a20"; g.fillRect(m(0.3), H - m(3.4), W - m(0.6), m(3.4));
  for (const x0 of [m(0.9), W - m(4.0)]) {
    const gl = g.createLinearGradient(0, H - m(2.9), 0, H - m(0.9)); gl.addColorStop(0, "#f1cf8e"); gl.addColorStop(1, "#c88a4a");
    g.fillStyle = gl; g.fillRect(x0, H - m(2.9), m(3.1), m(2.0));
    g.strokeStyle = "#e7d3a8"; g.lineWidth = m(0.07); g.strokeRect(x0, H - m(2.9), m(3.1), m(2.0));
    g.fillStyle = "rgba(60,30,20,0.55)"; for (let k = 0; k < 6; k++) g.fillRect(x0 + m(0.3) + k * m(0.45), H - m(1.5), m(0.22), m(0.5)); // bottles on the bar
  }
  g.fillStyle = "#1e1414"; g.fillRect(W / 2 - m(0.85), H - m(2.7), m(1.7), m(2.7));
  g.fillStyle = "#8a5a34"; g.fillRect(W / 2 - m(0.8), H - m(2.0), m(0.78), m(1.1)); g.fillRect(W / 2 + m(0.02), H - m(2.0), m(0.78), m(1.1));
  g.strokeStyle = "rgba(30,15,10,0.7)"; g.lineWidth = 2; g.strokeRect(W / 2 - m(0.8), H - m(2.0), m(0.78), m(1.1)); g.strokeRect(W / 2 + m(0.02), H - m(2.0), m(0.78), m(1.1));
  for (let i = 0; i < 12; i++) { g.fillStyle = i % 2 ? "#e9dcc0" : "#3f6a4a"; g.fillRect(m(0.2) + (i * (W - m(0.4))) / 12, H - m(3.75), (W - m(0.4)) / 12 + 1, m(0.42)); } // striped awning
}, "#9c5a44");
/** distillery door (8 m): a wide arched cart door, small barred windows */
export const distilleryFront = () => frontBase("distilleryFront", 8, 10.2, (g, r, W, H, m) => {
  g.fillStyle = "#e2d5b8"; g.beginPath(); g.moveTo(W / 2 - m(1.8), H); g.lineTo(W / 2 - m(1.8), H - m(2.6)); g.arc(W / 2, H - m(2.6), m(1.8), Math.PI, 0); g.lineTo(W / 2 + m(1.8), H); g.fill();
  g.fillStyle = "#5a3a26"; g.beginPath(); g.moveTo(W / 2 - m(1.55), H); g.lineTo(W / 2 - m(1.55), H - m(2.6)); g.arc(W / 2, H - m(2.6), m(1.55), Math.PI, 0); g.lineTo(W / 2 + m(1.55), H); g.fill();
  g.fillStyle = "rgba(255,230,190,0.15)"; for (let k = 1; k < 8; k++) g.fillRect(W / 2 - m(1.55) + k * m(0.39), H - m(4.1), 2, m(4.1));
  for (const x of [m(1.0), W - m(1.8)]) { g.fillStyle = "#2c2e3c"; g.fillRect(x, H - m(2.6), m(0.8), m(1.0)); g.fillStyle = "#c9ccd2"; for (let k = 1; k < 4; k++) g.fillRect(x + k * m(0.2), H - m(2.6), 2, m(1.0)); }
}, "#94493a");
/** firehouse front (12 m): two red arched engine doors, a granite band */
export const firehouseFront = () => frontBase("firehouseFront", 12, 10.2, (g, r, W, H, m) => {
  g.fillStyle = "#d8d0c0"; g.fillRect(0, H - m(4.6), W, m(0.4));
  for (const cx of [W * 0.3, W * 0.7]) {
    g.fillStyle = "#e2d5b8"; g.beginPath(); g.moveTo(cx - m(1.7), H); g.lineTo(cx - m(1.7), H - m(3.0)); g.arc(cx, H - m(3.0), m(1.7), Math.PI, 0); g.lineTo(cx + m(1.7), H); g.fill();
    g.fillStyle = "#b23a32"; g.beginPath(); g.moveTo(cx - m(1.45), H); g.lineTo(cx - m(1.45), H - m(3.0)); g.arc(cx, H - m(3.0), m(1.45), Math.PI, 0); g.lineTo(cx + m(1.45), H); g.fill();
    g.strokeStyle = "rgba(60,15,15,0.55)"; g.lineWidth = 3; for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(cx - m(1.45) + k * m(0.73), H); g.lineTo(cx - m(1.45) + k * m(0.73), H - m(3.6)); g.stroke(); }
    g.fillStyle = "#f2e1a8"; g.fillRect(cx - m(1.2), H - m(3.2), m(2.4), m(0.5));
  }
}, "#a24e38");
/** warehouse front: loading doors at intervals */
export const warehouseFront = (key: string, wm: number) => frontBase("wh" + key, wm, 10.2, (g, r, W, H, m) => {
  for (let x = m(4); x < W - m(3); x += m(9)) {
    g.fillStyle = "#4e3a2c"; g.fillRect(x, H - m(3.4), m(2.8), m(3.4));
    g.strokeStyle = "rgba(255,230,190,0.2)"; g.lineWidth = 2; g.beginPath(); g.moveTo(x, H - m(3.4)); g.lineTo(x + m(2.8), H); g.moveTo(x + m(2.8), H - m(3.4)); g.lineTo(x, H); g.stroke();
  }
}, "#9a5440");

/** riveted tank plates: grey bare steel or the brown paint; plates 3 m x 1.6 m, rivet rows on every seam.
 *  u wraps the circumference (repeat set by world.ts), v covers the full 15.2 m height */
export const tankPlates = (paint: boolean) => ctex(paint ? "tankBrown" : "tankSteel", 1024, 1024, (g, r) => {
  const base = paint ? "#6e4024" : "#8e949c";
  g.fillStyle = base; g.fillRect(0, 0, 1024, 1024);
  const rows = 9, cols = 4, ph = 1024 / rows, pw = 1024 / cols;
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    g.fillStyle = jit(r, base, paint ? 0.05 : 0.04, 3, 0.1);
    g.fillRect(j * pw + (i % 2) * pw / 2, i * ph, pw, ph);
    g.fillRect(j * pw + (i % 2) * pw / 2 - 1024, i * ph, pw, ph);
  }
  for (let i = 0; i < 30; i++) blot(g, U(r, 0, 1024), U(r, 0, 1024), U(r, 40, 120), paint ? "40,20,10" : "60,55,50", 0.07);
  if (!paint) for (let i = 0; i < 16; i++) { // rust weeps under the seams
    const x = U(r, 0, 1024), y = Math.floor(U(r, 1, rows)) * ph;
    const gr = g.createLinearGradient(0, y, 0, y + U(r, 40, 110)); gr.addColorStop(0, "rgba(120,60,30,0.35)"); gr.addColorStop(1, "rgba(120,60,30,0)");
    g.fillStyle = gr; g.fillRect(x, y, U(r, 3, 7), 110);
  }
  const seam = paint ? "rgba(30,14,6,0.38)" : "rgba(40,40,46,0.3)", hi = paint ? "rgba(255,210,170,0.22)" : "rgba(255,255,255,0.25)";
  for (let i = 0; i <= rows; i++) {
    const y = i * ph;
    g.fillStyle = seam; g.fillRect(0, y - 2, 1024, 3);
    for (let x = 6; x < 1024; x += 16) { g.fillStyle = seam; g.beginPath(); g.arc(x, y + 7, 3.4, 0, 7); g.fill(); g.fillStyle = hi; g.beginPath(); g.arc(x - 1, y + 6, 1.4, 0, 7); g.fill(); }
  }
  for (let i = 0; i < rows; i++) for (let j = 0; j <= cols; j++) {
    const x = j * pw + (i % 2) * pw / 2;
    for (const xx of [x, x - 1024]) {
      g.fillStyle = seam; g.fillRect(xx - 1.5, i * ph, 3, ph);
      for (let y = i * ph + 10; y < (i + 1) * ph - 4; y += 15) { g.fillStyle = seam; g.beginPath(); g.arc(xx + 7, y, 3.2, 0, 7); g.fill(); g.fillStyle = hi; g.beginPath(); g.arc(xx + 6, y - 1, 1.3, 0, 7); g.fill(); }
    }
  }
});
/** the tank's inside wall: dim steel, the same seams, a dark band at the bottom */
export const tankInside = () => ctex("tankInside", 512, 512, (g, r) => {
  g.fillStyle = "#6f747c"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 20; i++) blot(g, U(r, 0, 512), U(r, 0, 512), U(r, 30, 80), "30,30,36", 0.12);
  for (let i = 0; i <= 9; i++) { g.fillStyle = "rgba(30,30,36,0.5)"; g.fillRect(0, (i * 512) / 9 - 1, 512, 2); }
  for (let j = 0; j < 4; j++) { g.fillStyle = "rgba(30,30,36,0.45)"; g.fillRect((j * 512) / 4, 0, 2, 512); }
});
/** molasses surface paint: deep brown with long amber streaks and soft swirls (scrolled along the flow) */
export const molassesTex = () => ctex("molassesHD", 1024, 1024, (g, r) => {
  g.fillStyle = "#553216"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 40; i++) blot(g, U(r, 0, 1024), U(r, 0, 1024), U(r, 60, 180), r() < 0.5 ? "38,20,8" : "130,80,36", 0.25);
  g.lineCap = "round";
  for (let i = 0; i < 70; i++) {
    const x = U(r, -100, 1124), y = U(r, 0, 1024), len = U(r, 80, 260), a = U(r, -0.25, 0.25);
    g.strokeStyle = r() < 0.6 ? "rgba(150,96,48,0.45)" : "rgba(200,146,86,0.32)"; g.lineWidth = U(r, 3, 8);
    g.beginPath(); g.moveTo(x, y);
    g.quadraticCurveTo(x + len * 0.5, y + len * Math.sin(a) + U(r, -30, 30), x + len, y + len * a);
    g.stroke();
    for (const ox of [-1024, 1024]) { g.beginPath(); g.moveTo(x + ox, y); g.quadraticCurveTo(x + ox + len * 0.5, y + len * Math.sin(a), x + ox + len, y + len * a); g.stroke(); }
  }
});
/** the el's riveted lattice girders (dark green-grey) */
export const latticeTex = () => ctex("latticeHD", 512, 128, (g) => {
  g.fillStyle = "#3d4a46"; g.fillRect(0, 0, 512, 128);
  g.fillStyle = "#2a3330"; g.fillRect(0, 0, 512, 14); g.fillRect(0, 114, 512, 14);
  g.strokeStyle = "#556660"; g.lineWidth = 10;
  for (let x = -64; x < 576; x += 64) { g.beginPath(); g.moveTo(x, 14); g.lineTo(x + 64, 114); g.moveTo(x + 64, 14); g.lineTo(x, 114); g.stroke(); }
  g.fillStyle = "rgba(255,255,255,0.25)"; for (let x = 4; x < 512; x += 16) { g.fillRect(x, 5, 3, 3); g.fillRect(x, 119, 3, 3); }
});
/** kitchen wallpaper (soft stripes + small flowers), checker floor, wood panelling, painted cabinet doors */
export const wallpaper = (col = "#f1e2c4") => ctex("wallpaper" + col, 512, 512, (g, r) => {
  g.fillStyle = col; g.fillRect(0, 0, 512, 512);
  for (let x = 0; x < 512; x += 64) { g.fillStyle = "rgba(200,140,110,0.18)"; g.fillRect(x, 0, 18, 512); }
  for (let i = 0; i < 40; i++) { const x = 41 + 64 * Math.floor(i / 5), y = 51 + 102 * (i % 5); g.fillStyle = "#d98e7e"; for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(x + 6 * Math.cos(k * 1.26), y + 6 * Math.sin(k * 1.26), 4, 0, 7); g.fill(); } g.fillStyle = "#f3d27a"; g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); }
});
export const checker = () => ctex("checker", 512, 512, (g, r) => {
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { g.fillStyle = (i + j) % 2 ? jit(r, "#2f3a4e", 0.05) : jit(r, "#efe8d8", 0.03); g.fillRect(i * 64, j * 64, 64, 64); }
  g.fillStyle = "rgba(0,0,0,0.15)"; for (let i = 0; i <= 8; i++) { g.fillRect(i * 64 - 1, 0, 2, 512); g.fillRect(0, i * 64 - 1, 512, 2); }
});
export const panelling = () => ctex("panelling", 512, 512, (g, r) => {
  g.fillStyle = "#7a4a2c"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
    const x = i * 128 + 14, y = j * 256 + 18, w = 100, h = 220;
    g.fillStyle = jit(r, "#8e5a36", 0.06); g.fillRect(x, y, w, h);
    g.strokeStyle = "rgba(40,20,10,0.55)"; g.lineWidth = 4; g.strokeRect(x, y, w, h);
    g.strokeStyle = "rgba(255,220,180,0.25)"; g.lineWidth = 2; g.strokeRect(x + 4, y + 4, w - 8, h - 8);
    for (let k = 0; k < 6; k++) { g.strokeStyle = "rgba(60,30,15,0.18)"; g.lineWidth = 2; g.beginPath(); g.moveTo(x + U(r, 8, w - 8), y + 6); g.lineTo(x + U(r, 8, w - 8), y + h - 6); g.stroke(); }
  }
});
export const plaster = (col: string) => ctex("plaster" + col, 512, 512, (g, r) => {
  g.fillStyle = col; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 24; i++) blot(g, U(r, 0, 512), U(r, 0, 512), U(r, 40, 120), r() < 0.5 ? "255,255,255" : "120,100,80", 0.06);
});
/** the snowy view out of the kitchen window: rooftops with snow, chimney smoke, pale winter sky */
export const snowView = () => ctex("snowView", 512, 512, (g, r) => {
  const sky = g.createLinearGradient(0, 0, 0, 512); sky.addColorStop(0, "#9fbfe6"); sky.addColorStop(1, "#dfe9f4");
  g.fillStyle = sky; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 7; i++) {
    const x = i * 80 - 20 + U(r, -10, 10), w = U(r, 70, 100), h = U(r, 180, 300);
    g.fillStyle = jit(r, "#a8513a", 0.1); g.fillRect(x, 512 - h, w, h);
    g.fillStyle = "#f4f7fb"; g.fillRect(x - 4, 512 - h - 12, w + 8, 16);
    g.fillStyle = "rgba(240,210,140,0.85)"; for (let k = 0; k < 3; k++) g.fillRect(x + 12 + k * 26, 512 - h + 40, 12, 18);
  }
  for (let i = 0; i < 90; i++) { g.fillStyle = "rgba(255,255,255,0.9)"; g.beginPath(); g.arc(U(r, 0, 512), U(r, 0, 512), U(r, 1.5, 4), 0, 7); g.fill(); }
});
/** courtroom window: tall arched panes with a pale sky */
export const courtWindow = () => ctex("courtWindow", 256, 512, (g) => {
  const sky = g.createLinearGradient(0, 0, 0, 512); sky.addColorStop(0, "#cfe2f4"); sky.addColorStop(1, "#eef3f8");
  g.fillStyle = sky; g.fillRect(0, 0, 256, 512);
  g.strokeStyle = "#efe6d4"; g.lineWidth = 10;
  for (let x = 64; x < 256; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke(); }
  for (let y = 85; y < 512; y += 85) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
  g.strokeStyle = "#6a4a30"; g.lineWidth = 16; g.strokeRect(0, 0, 256, 512);
});
export { THREE };
