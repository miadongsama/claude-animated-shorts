// The molasses short as one three.js scene: winter sky, Boston harbour, the wharf, Commercial Street with its elevated
// railway, the North End rows, the molasses tank (bare steel -> painted brown -> groaning -> bursting into petals), the
// flood surface (a curling crest that spreads from the tank, then sets solid in the freezing night), the shed that gets
// flattened, the steamship and its hose, gas lamps, and two interiors far off-stage: a kitchen and a courtroom.
// update(id, f, camera) poses everything for shot `id` at frame f (pure function of id + f).
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { staticFile, getInputProps } from "remotion";
import { Batch, Strand, boxGeo, V, lam, buildNorthEnd, shedBuilding, addBarrel, addCrate, Kit, Ray, kitClone } from "./build";
import { ctex, cobbleHD, stoneHD, planksHD, waterNear, waterFar, cloudHD, roofHD } from "./paint";
import { tankPlates, tankInside, molassesTex, latticeTex, wallpaper, checker, panelling, plaster, snowView, courtWindow, shedPlanks } from "./paint2";
import { Pen, fxPlans } from "./toon";
import { LIGHTS, LOOK, LightPreset } from "./lights";
import { TONE, CHAR, LFB, twoTone, untone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stage } from "./cast";
import {
  FPS, SHOTS, ShotDef, V3, TANK, TR, TH, ROOF_H, ST_Z0, ST_Z1, EL_Z0, EL_Z1, EL_Y0, EL_Y1, COLS_Z, COLS_X, WHARF_Z, WATER_Y, FRONT_Z, SHED,
  KITCHEN, COURT, SHIP, camAt, floodY, curl, lump, baseD, frontR, crestH, sOf, colTilt, shedK, paintK, PAINT_F0, PAINT_F1, PAINT_TH0, PAINT_TH1, snowK, THAW_F1, BURST_F, FOREGROUND, smooth, clamp01, easeOut,
} from "./story";

// ---------------- assets ----------------
const KENNEY = ["lantern", "cart", "tree_default", "plant_bushDetailed"];
let kitP: Promise<Kit> | null = null;
export const loadKit = () => {
  if (!kitP) {
    const loader = new GLTFLoader();
    kitP = Promise.all(KENNEY.map((n) => loader.loadAsync(staticFile(`bridge/kenney/${n}.glb`)).then((g) => [n, g.scene] as const).catch(() => [n, null] as const)))
      .then((list) => Object.fromEntries(list.filter((e) => e[1]).map(([n, s]) => [n, s!])) as Kit);
  }
  return kitP;
};

/** every lens position of the film looking at its subject (outdoor shots only): houses in the way are left out */
const sightLines = (): Ray[] => {
  const out: Ray[] = [];
  for (const s of SHOTS) {
    if (s.place !== "out") continue;
    for (let f = s.a - 8; f < s.b + 8; f += 2) {
      const c = camAt(s.id, Math.max(0, Math.min(f, 2099))), o = V(...c.pos), look = V(...c.look);
      const fw = look.clone().sub(o), len = Math.max(0.5, fw.length() - 1.8); // stop short of the subject: a look point on a facade must not delete that facade
      fw.normalize();
      const rt = fw.clone().cross(V(0, 1, 0)).normalize(), up = rt.clone().cross(fw);
      const ty = Math.tan((c.fov * Math.PI) / 360), tx = ty * (9 / 16);
      for (const [sx, sy] of [[0, 0], [-0.6, 0], [0.6, 0], [0, 0.6], [0, -0.4]])
        out.push({ o, d: fw.clone().addScaledVector(rt, sx * tx).addScaledVector(up, sy * ty), len, core: sx === 0 && sy === 0 });
    }
  }
  return out;
};

/** per-shot sun override (camera-relative azimuth / elevation) */
// a January sun low in the south-east: shots looking west along Commercial Street take it from behind-left (so the el
// deck's shadow falls north, off the action), tank shots looking north take it from behind (high enough to clear the deck)
const SUN_SHOT: Record<number, { az?: number; el?: number }> = {
  1: { az: -125, el: 36 }, 2: { az: 115, el: 30 }, 5: { az: 140, el: 50 }, 6: { az: 140, el: 52 }, 7: { az: 130, el: 46 }, 8: { az: 150, el: 56 },
  9: { az: -120, el: 40 }, 13: { az: -125, el: 38 }, 15: { az: 120, el: 30 }, 18: { az: 140, el: 60 }, 19: { az: 140, el: 60 },
};
const NP = 12;                                     // tank wall panels (petals when it bursts)
const quadUp = (x0: number, x1: number, z0: number, z1: number, u: number, v: number, y = 0) => {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([x0, y, z1, x1, y, z1, x1, y, z0, x0, y, z1, x1, y, z0, x0, y, z0], 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, u, 0, u, v, 0, 0, u, v, 0, v], 2));
  return g;
};
const UNIT = new THREE.BoxGeometry(1, 1, 1);
const _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _x = new THREE.Vector3(1, 0, 0);
/** unit box stretched from a to b with cross-section (w across horizontally, h up) */
const beamM = (a: THREE.Vector3, b: THREE.Vector3, w: number, h: number) => {
  const d = _p.subVectors(b, a), len = d.length();
  _q.setFromUnitVectors(_x, d.clone().normalize());
  return _m.compose(a.clone().add(b).multiplyScalar(0.5), _q, _s.set(len, h, w)).clone();
};

// flood grid: polar around the tank, so the crest runs along the rings (smooth silhouette); ring-major, so the rings past
// the front can be dropped with the draw range
const FDR = 0.4, FNR = 300, FNA = 360;
type Mats = Record<string, THREE.Material>;

export class World {
  root = new THREE.Group();
  private out = new THREE.Group(); private kitchen = new THREE.Group(); private court = new THREE.Group();
  private pool = new Pool();
  private actors: Actor[] = [];
  private fxs: Fx[] = [];
  private hemi: THREE.HemisphereLight; private sun: THREE.DirectionalLight;
  private sky: THREE.Mesh; private skyMat: THREE.ShaderMaterial;
  private fog = new THREE.Fog("#c4d8ef", 30, 330);
  private WU: Record<string, THREE.IUniform>;
  private sunCache = new Map<number, THREE.Vector3>();
  private cloudMaps: Record<"day" | "night", THREE.Texture[]>;
  private clouds: THREE.Mesh[] = [];
  private moon: THREE.Sprite;
  private fgs: { o: THREE.Object3D; a: number; b: number }[] = [];
  // tank
  private panels: THREE.Mesh[] = []; private panelC: number[] = [];
  private steel: THREE.Material; private brown: THREE.Material;
  private roof: THREE.Mesh; private roofMat: THREE.Material; private water6: THREE.Mesh; private paintOver: THREE.Mesh; private paintGeo = new Map<number, THREE.BufferGeometry>();
  private wall = new THREE.Group();
  // el
  private cols: THREE.InstancedMesh; private cross: THREE.InstancedMesh; private girders: THREE.InstancedMesh; private slabs: THREE.InstancedMesh; private rails: THREE.InstancedMesh;
  // buildings that move
  private shed: { group: THREE.Group; snow: THREE.Group; eave: { y: number; z: number; x0: number; x1: number } };
  private freight: { group: THREE.Group; snow: THREE.Group; eave: { y: number; z: number; x0: number; x1: number } };
  private icicles = new THREE.Group();
  private roofSnow: THREE.Group;
  private hose: Strand;
  private lampGlass: THREE.MeshLambertMaterial;
  // flood
  private flood: THREE.Mesh; private fGeo: THREE.BufferGeometry; private fMat: THREE.MeshPhongMaterial; private floodKey = "";
  // kitchen props
  private kItems: Record<string, THREE.Object3D> = {};
  private ribbon: Strand; private molStrand: Strand;
  private frustum = new THREE.Frustum();
  private m4 = new THREE.Matrix4(); private v = new THREE.Vector3(); private sph = new THREE.Sphere();

  constructor(kit: Kit) {
    const R = this.root, M: Mats = {};
    R.add(this.out, this.kitchen, this.court);
    // ---- sky + light ----
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { c0: { value: new THREE.Color() }, c1: { value: new THREE.Color() }, c2: { value: new THREE.Color() },
        c3: { value: new THREE.Color() }, c4: { value: new THREE.Color() }, e: { value: new THREE.Vector4() } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform vec3 c0, c1, c2, c3, c4; uniform vec4 e; varying vec3 vP;
        void main(){ float el = asin(clamp(normalize(vP).y, -1.0, 1.0));
          vec3 c = mix(c0, c1, smoothstep(0.0, e.x, el)); c = mix(c, c2, smoothstep(e.x, e.y, el));
          c = mix(c, c3, smoothstep(e.y, e.z, el)); c = mix(c, c4, smoothstep(e.z, e.w, el));
          gl_FragColor = vec4(c, 1.0); }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1100, 48, 24), this.skyMat);
    this.sky.renderOrder = -1; this.sky.frustumCulled = false; this.sky.layers.set(NOINK);
    R.add(this.sky);
    this.hemi = new THREE.HemisphereLight("#cfe6ff", "#6c5c8c", 1.1);
    this.sun = new THREE.DirectionalLight("#fff0d6", 2.6);
    this.sun.castShadow = true;
    { const sm = ((getInputProps() as { post?: { shadow?: number } }).post?.shadow) ?? 2048; this.sun.shadow.mapSize.set(sm, sm); }
    R.add(this.hemi, this.sun, this.sun.target);
    this.cloudMaps = { day: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.day.cloud)), night: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.night.cloud)) };
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3, d = 620 + (i % 3) * 60;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.cloudMaps.day[i % 4], color: new THREE.Color(1.1, 1.1, 1.1), transparent: true, depthWrite: false, fog: false }));
      const w = 130 + (i % 4) * 30;
      m.position.set(Math.cos(a) * d, 110 + (i % 4) * 36, Math.sin(a) * d); m.scale.set(w, w / 2, 1);
      m.layers.set(NOINK); this.clouds.push(m); R.add(m);
    }
    this.moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: ctex("moon", 128, 128, (g) => {
      const gr = g.createRadialGradient(64, 64, 50, 64, 64, 64); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128); g.fillStyle = "rgba(170,180,210,0.5)"; g.beginPath(); g.arc(50, 56, 12, 0, 7); g.arc(78, 76, 8, 0, 7); g.fill();
    }), color: new THREE.Color(2.2, 2.3, 2.6), fog: false, depthWrite: false }));
    this.moon.layers.set(NOINK); this.moon.frustumCulled = false; R.add(this.moon);

    // ---- ground: harbour, wharf, street, sidewalks, snow banks ----
    const b = new Batch();
    M.cobble = lam("cobbleHD", () => ({ map: cobbleHD() }));
    M.wharf = lam("wharfHD", () => ({ map: stoneHD("wharfHD", ["#b9b2a6", "#aea69a", "#c2bbaf", "#a69e92"], "#8c8478") }));
    M.walk = lam("walkHD", () => ({ map: stoneHD("walkHD", ["#c9c4bb", "#bfb9af", "#d1ccc3", "#b7b1a6"], "#9a948a") }));
    M.ground = lam("groundN", () => ({ color: "#8f8a80" }));
    M.snow = lam("snowBank", () => ({ color: "#e9edf3" }));
    M.dock = lam("dockWall", () => ({ map: shedPlanks("dockHD", "#6e5a48", 10) }));
    b.add(quadUp(-900, 900, ST_Z0, ST_Z1, 450, 7), M.cobble);
    b.add(quadUp(-900, 900, WHARF_Z, ST_Z0 - 1, 300, 8.7, 0), M.wharf);
    b.add(boxGeo(V(-900, 0, ST_Z0 - 1), V(900, 0.14, ST_Z0), 2), M.walk);
    b.add(boxGeo(V(-900, 0, ST_Z1), V(900, 0.14, FRONT_Z + 0.3), 2), M.walk);
    b.add(quadUp(-900, 900, FRONT_Z + 0.3, 400, 200, 80), M.ground);
    // dock face at the wharf edge, down to the water
    { const g = new THREE.BufferGeometry(), y0 = WATER_Y - 1;
      g.setAttribute("position", new THREE.Float32BufferAttribute([900, y0, WHARF_Z, -900, y0, WHARF_Z, -900, 0, WHARF_Z, 900, y0, WHARF_Z, -900, 0, WHARF_Z, 900, 0, WHARF_Z], 3));
      g.setAttribute("normal", new THREE.Float32BufferAttribute(Array(6).fill([0, 0, -1]).flat(), 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 450, 0, 450, 1, 0, 0, 450, 1, 0, 1], 2));
      b.add(g, M.dock); }
    // kerbside snow banks (rounded mounds, dirty white), gaps at crossings
    const mound = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    for (const zb of [ST_Z0 - 0.35, ST_Z1 + 0.45]) for (let x = -140; x < 140; x += 3.1) {
      if (((x + 300) % 37) < 4) continue;
      b.add(mound, M.snow, new THREE.Matrix4().compose(V(x, 0.12, zb), new THREE.Quaternion(), V(1.9 + 0.4 * Math.sin(x), 0.45 + 0.12 * Math.sin(x * 1.7), 0.55)));
    }
    // tank foundation ring, the floor inside
    M.concrete = lam("concrete", () => ({ color: "#b8b4aa" }));
    b.add(new THREE.CylinderGeometry(TR + 0.7, TR + 0.85, 0.45, 64).translate(0, 0.225, 0), M.concrete, new THREE.Matrix4().makeTranslation(TANK[0], 0, TANK[2]));
    b.add(new THREE.CircleGeometry(TR - 0.05, 64).rotateX(-Math.PI / 2), lam("tankFloor", () => ({ color: "#4e5056" })), new THREE.Matrix4().makeTranslation(TANK[0], 0.47, TANK[2]));
    // gas lamps along both kerbs
    this.lampGlass = new THREE.MeshLambertMaterial({ color: "#f3e7c4", emissive: new THREE.Color(0, 0, 0) });
    const post = lam("lampPost", () => ({ color: "#2c3a34" }));
    for (const zl of [ST_Z0 - 0.6, ST_Z1 + 0.5]) for (let x = -130; x <= 130; x += 18) { // ... 32, 50, 68, 86, 104: clear of the distillery and saloon doors
      b.add(new THREE.CylinderGeometry(0.07, 0.11, 3.6, 8).translate(0, 1.8, 0), post, new THREE.Matrix4().makeTranslation(x, 0.14, zl));
      b.add(boxGeo(V(x - 0.24, 3.65, zl - 0.24), V(x + 0.24, 3.75, zl + 0.24)), post);
      b.add(new THREE.ConeGeometry(0.34, 0.3, 4).rotateY(Math.PI / 4).translate(0, 4.47, 0), post, new THREE.Matrix4().makeTranslation(x, 0, zl));
      b.add(boxGeo(V(x - 0.2, 3.75, zl - 0.2), V(x + 0.2, 4.32, zl + 0.2)), this.lampGlass);
    }
    // the steamship at the wharf
    this.buildShip(b);
    b.build(this.out);
    const town = buildNorthEnd(this.out, kit, sightLines());
    this.roofSnow = town.snow;

    // ---- harbour water ----
    const wNear = waterNear(), wFar = waterFar();
    for (const t of [wNear, wFar]) { t.colorSpace = THREE.NoColorSpace; t.anisotropy = 16; t.needsUpdate = true; }
    this.WU = {
      wNearC: { value: new THREE.Color() }, wMidC: { value: new THREE.Color() }, wFarC: { value: new THREE.Color() },
      wCrest: { value: new THREE.Color() }, wTrough: { value: new THREE.Color() }, wGlint: { value: new THREE.Color() },
      wShade: { value: new THREE.Vector3(0.5, 0.56, 0.72) }, wNearTex: { value: wNear }, wFarTex: { value: wFar }, wTime: { value: 0 },
    };
    const waterM = new THREE.MeshLambertMaterial({ color: 0xffffff });
    waterM.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, this.WU);
      sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vWP;")
        .replace("#include <project_vertex>", "#include <project_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", WATER_DECL).replace("#include <map_fragment>", WATER_COL)
        .replace("#include <lights_fragment_begin>", "float sunVis = 1.0;\n" + LFB)
        .replace("#include <lights_fragment_end>", "#include <lights_fragment_end>\n  reflectedLight.directDiffuse = diffuseColor.rgb * mix(wShade, vec3(1.0), sunVis);\n  reflectedLight.indirectDiffuse = vec3(0.0);");
    };
    waterM.customProgramCacheKey = () => "harbour1";
    const wm = new THREE.Mesh(quadUp(-900, 900, -900, WHARF_Z, 1, 1, WATER_Y), waterM);
    wm.receiveShadow = true; this.out.add(wm);

    // ---- the tank ----
    this.steel = lam("tankSteel", () => ({ map: tankPlates(false), side: THREE.DoubleSide }));
    this.brown = lam("tankBrown", () => ({ map: tankPlates(true), side: THREE.DoubleSide }));
    for (const t of [tankPlates(false), tankPlates(true)]) { t.repeat.set(1, 1); t.anisotropy = 16; }
    for (let i = 0; i < NP; i++) {
      const th0 = (i / NP) * Math.PI * 2, dth = (Math.PI * 2) / NP;
      const g = new THREE.CylinderGeometry(TR, TR, TH, 8, 1, true, th0, dth).translate(0, TH / 2 + 0.45, 0);
      const uv = g.attributes.uv as THREE.BufferAttribute; // u across one panel = 1/NP of the plates texture x 4 -> 3 m plates
      for (let k = 0; k < uv.count; k++) uv.setX(k, ((uv.getX(k) + i) / NP) * 9.6);
      const m = new THREE.Mesh(g, this.steel);
      m.castShadow = true; m.receiveShadow = true; m.matrixAutoUpdate = false;
      m.position.set(TANK[0], 0, TANK[2]); m.updateMatrix();
      this.panels.push(m); this.panelC.push(th0 + dth / 2); this.wall.add(m);
    }
    this.out.add(this.wall);
    this.roofMat = lam("tankRoof", () => ({ map: roofHD("#7d828a", true) }));
    this.roof = new THREE.Mesh(new THREE.ConeGeometry(TR + 0.3, ROOF_H, 64, 1, true), this.roofMat);
    this.roof.castShadow = true; this.roof.receiveShadow = true;
    this.out.add(this.roof);
    this.water6 = new THREE.Mesh(new THREE.CircleGeometry(TR - 0.1, 48).rotateX(-Math.PI / 2), twoTone(new THREE.MeshPhongMaterial({ color: "#7fa6c6", specular: "#ffffff", shininess: 80 })));
    this.water6.position.set(TANK[0], 0.5, TANK[2]); this.water6.scale.set(1.7 / (TR - 0.1), 1, 1.3 / (TR - 0.1)); this.out.add(this.water6);
    this.paintOver = new THREE.Mesh(new THREE.BufferGeometry(), this.brown);
    this.paintOver.castShadow = false; this.paintOver.receiveShadow = true; this.out.add(this.paintOver);

    // ---- the elevated railway (posed every frame: its columns buckle when the wave hits) ----
    const lat = lam("lattice", () => ({ map: latticeTex(), color: "#8a8f8a" }));
    const colM = lam("elCol", () => ({ color: "#2a3330" })), slabM = lam("elSlab", () => ({ map: planksHD() })), railM = twoTone(new THREE.MeshPhongMaterial({ color: "#5a5c62", specular: "#bbbbbb", shininess: 60 }));
    const inst = (m: THREE.Material, n: number) => { const im = new THREE.InstancedMesh(UNIT, m, n); im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; this.out.add(im); return im; };
    this.cols = inst(colM, COLS_X.length * 2);
    this.cross = inst(lat, COLS_X.length);
    this.girders = inst(lat, (COLS_X.length - 1) * 2);
    this.slabs = inst(slabM, COLS_X.length - 1);
    this.rails = inst(railM, (COLS_X.length - 1) * 4);

    // ---- the freight house by the tank (icicles), the shed inland (flattened) ----
    this.freight = shedBuilding(20, 36, -15, -6, 5.4, "#8a6e52", "z1");
    this.out.add(this.freight.group);
    this.shed = shedBuilding(SHED.x0, SHED.x1, SHED.z0, SHED.z1, SHED.h, "#9a7b5a", "z0");
    this.out.add(this.shed.group);
    const ice = new Batch(), iceM = twoTone(new THREE.MeshPhongMaterial({ color: "#dff2ff", specular: "#ffffff", shininess: 90 }));
    for (let i = 0; i < 26; i++) {
      const x = 20.6 + i * 0.58 + 0.12 * Math.sin(i * 7.1), len = 0.25 + 0.5 * Math.abs(Math.sin(i * 3.7));
      ice.add(new THREE.ConeGeometry(0.05 + 0.02 * Math.sin(i), len, 6).rotateX(Math.PI).translate(0, -len / 2, 0), iceM, new THREE.Matrix4().makeTranslation(x, 0, 0));
    }
    ice.build(this.icicles, false);
    this.icicles.position.set(0, this.freight.eave.y, this.freight.eave.z);
    this.out.add(this.icicles);
    // the hose from the ship to the tank roof (shot 7)
    this.hose = new Strand(26, 0.32, 0.32, lam("hose", () => ({ color: "#3b3132" })), 1);
    this.out.add(this.hose.mesh);

    // ---- the flood ----
    const nv = FNR * (FNA + 1);
    this.fGeo = new THREE.BufferGeometry();
    this.fGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(nv * 3), 3));
    this.fGeo.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(nv * 3), 3));
    this.fGeo.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(nv * 2), 2));
    this.fGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(nv * 3).fill(1), 3));
    const idx = new Uint32Array((FNR - 1) * FNA * 6);
    let ii = 0;
    for (let i = 0; i < FNR - 1; i++) for (let j = 0; j < FNA; j++) {
      const a = i * (FNA + 1) + j, c = a + 1, d = a + FNA + 1, e = d + 1;
      idx[ii++] = a; idx[ii++] = d; idx[ii++] = c; idx[ii++] = c; idx[ii++] = d; idx[ii++] = e; // counter-clockwise from above: normals up
    }
    this.fGeo.setIndex(new THREE.BufferAttribute(idx, 1));
    const mt = molassesTex(); mt.anisotropy = 16;
    this.fMat = twoTone(new THREE.MeshPhongMaterial({ color: "#ffffff", map: mt, specular: "#9c7454", shininess: 30, vertexColors: true, emissive: new THREE.Color("#120a05"), side: THREE.DoubleSide }), 0.3);
    this.flood = new THREE.Mesh(this.fGeo, this.fMat);
    this.flood.frustumCulled = false; this.flood.receiveShadow = true; this.flood.castShadow = false;
    this.out.add(this.flood);

    // ---- interiors ----
    this.buildKitchen();
    this.buildCourt();
    this.ribbon = new Strand(24, 0.017, 0.017, new THREE.MeshBasicMaterial({ color: "#f6a92e" }), 1, false);
    this.molStrand = new Strand(20, 0.022, 0.022, twoTone(new THREE.MeshPhongMaterial({ color: "#5a2c10", emissive: new THREE.Color("#200c02"), specular: "#ffd0a0", shininess: 60 })), 1, false);
    this.kitchen.add(this.ribbon.mesh, this.molStrand.mesh);

    for (const fg of FOREGROUND) {
      const o = kitClone(kit, fg.kit, fg.s ?? 1);
      if (!o) continue;
      o.position.set(...fg.pos); o.rotation.y = fg.yaw ?? 0; o.visible = false;
      this.fgs.push({ o, a: fg.a, b: fg.b }); this.out.add(o);
    }
  }

  private buildShip(b: Batch) {
    const { x0, x1, z, w } = SHIP, wl = WATER_Y, top = wl + 5.0, bow = x0 - 7;
    const hull = lam("hull", () => ({ color: "#2b2729" })), red = lam("hullRed", () => ({ color: "#9c3a2e" })), deck = lam("deck", () => ({ map: planksHD() }));
    const white = lam("shipWhite", () => ({ color: "#eeeae0" })), funnel = lam("funnel", () => ({ color: "#2a2628" })), band = lam("funnelBand", () => ({ color: "#c0353a" }));
    b.add(boxGeo(V(x0, wl - 0.5, z - w / 2), V(x1, top, z + w / 2)), hull);
    b.add(boxGeo(V(x0, wl - 0.5, z - w / 2 - 0.02), V(x1, wl + 0.4, z + w / 2 + 0.02)), red);
    // bow wedge
    const g = new THREE.BufferGeometry(), y0 = wl - 0.5, y1 = top;
    const P = [[x0, y0, z - w / 2], [x0, y0, z + w / 2], [bow, y0, z], [x0, y1, z - w / 2], [x0, y1, z + w / 2], [bow, y1 + 0.8, z]];
    const tri = (a: number, c: number, d: number) => [...P[a], ...P[c], ...P[d]];
    g.setAttribute("position", new THREE.Float32BufferAttribute([...tri(0, 3, 2), ...tri(3, 5, 2), ...tri(1, 2, 4), ...tri(4, 2, 5), ...tri(3, 4, 5)], 3));
    g.computeVertexNormals();
    b.add(g, hull);
    b.add(boxGeo(V(x0, top - 0.02, z - w / 2 + 0.2), V(x1, top + 0.02, z + w / 2 - 0.2), 3), deck);
    b.add(boxGeo(V(x1 - 16, top, z - 3.4), V(x1 - 4, top + 3.0, z + 3.4), 2), white);
    b.add(boxGeo(V(x1 - 13, top + 3.0, z - 2.4), V(x1 - 6, top + 5.2, z + 2.4), 2), white);
    b.add(new THREE.CylinderGeometry(1.25, 1.35, 7.5, 20).translate(0, 3.75, 0), funnel, new THREE.Matrix4().makeTranslation(x1 - 20, top + 1.5, z));
    b.add(new THREE.CylinderGeometry(1.27, 1.27, 1.1, 20).translate(0, 0.55, 0), band, new THREE.Matrix4().makeTranslation(x1 - 20, top + 6.6, z));
    const mast = lam("mast", () => ({ color: "#7a5a3c" }));
    for (const mx of [x0 + 6, x1 - 30]) b.add(new THREE.CylinderGeometry(0.16, 0.22, 16, 8).translate(0, 8, 0), mast, new THREE.Matrix4().makeTranslation(mx, top, z));
    for (let i = 0; i < 9; i++) b.add(new THREE.CylinderGeometry(0.18, 0.18, 0.5, 10).rotateX(Math.PI / 2), white, new THREE.Matrix4().makeTranslation(x1 - 15 + i * 1.2, top + 1.5, z - 3.41));
  }

  private buildKitchen() {
    const K = KITCHEN, b = new Batch(), g = this.kitchen;
    const wallM = lam("kWall", () => ({ map: wallpaper() })), floorM = lam("kFloor", () => ({ map: checker() })), wood = lam("kWood", () => ({ map: shedPlanks("kTableHD", "#b07a4a", 6) }));
    const cab = lam("kCab", () => ({ map: plaster("#a9cbb8") })), white = lam("kWhite", () => ({ color: "#f2efe8" })), chrome = twoTone(new THREE.MeshPhongMaterial({ color: "#c9ccd2", specular: "#ffffff", shininess: 90 }));
    const W = 3.4, D = 2.6, H = 3.0;
    b.add(quadUp(K[0] - W, K[0] + W, K[2] - D, K[2] + D + 2, 6, 4.6), floorM);
    b.add(boxGeo(V(K[0] - W, 0, K[2] - D - 0.2), V(K[0] + W, H, K[2] - D), 0), wallM);
    b.add(boxGeo(V(K[0] - W - 0.2, H, K[2] - D - 0.2), V(K[0] + W + 0.2, H + 0.1, K[2] + D + 2), 0, true), white);
    b.add(boxGeo(V(K[0] - W - 0.2, 0, K[2] - D), V(K[0] - W, H, K[2] + D + 2), 0), wallM);
    b.add(boxGeo(V(K[0] + W, 0, K[2] - D), V(K[0] + W + 0.2, H, K[2] + D + 2), 0), wallM);
    // window with the snowy view (back wall, left of centre)
    b.add(boxGeo(V(K[0] - 1.6, 1.2, K[2] - D + 0.01), V(K[0] - 0.2, 2.5, K[2] - D + 0.03)), lam("kView", () => ({ map: snowView() })));
    for (const [x0, y0, x1, y1] of [[-1.7, 1.12, -0.1, 1.22], [-1.7, 2.5, -0.1, 2.6], [-1.7, 1.12, -1.6, 2.6], [-0.2, 1.12, -0.1, 2.6], [-0.95, 1.2, -0.85, 2.5], [-1.6, 1.8, -0.2, 1.88]] as const)
      b.add(boxGeo(V(K[0] + x0, y0, K[2] - D + 0.02), V(K[0] + x1, y1, K[2] - D + 0.1)), white);
    // cabinets + counter on the back wall right, the fridge on the right wall
    b.add(boxGeo(V(K[0] + 0.3, 0, K[2] - D), V(K[0] + 2.2, 0.9, K[2] - D + 0.62), 0), cab);
    b.add(boxGeo(V(K[0] + 0.25, 0.9, K[2] - D), V(K[0] + 2.25, 0.96, K[2] - D + 0.66)), white);
    b.add(boxGeo(V(K[0] + 0.3, 1.6, K[2] - D), V(K[0] + 2.2, 2.4, K[2] - D + 0.36), 0), cab);
    b.add(boxGeo(V(K[0] + 2.45, 0, K[2] - D + 0.1), V(K[0] + 3.3, 1.85, K[2] - D + 0.85), 0), white);
    b.add(boxGeo(V(K[0] + 2.47, 1.0, K[2] - D + 0.86), V(K[0] + 2.53, 1.5, K[2] - D + 0.92)), chrome);
    // table + two chairs
    b.add(boxGeo(V(K[0] - 0.8, 0.74, K[2] - 0.5), V(K[0] + 0.8, 0.8, K[2] + 0.5), 1), wood);
    for (const [lx, lz] of [[-0.72, -0.42], [0.72, -0.42], [-0.72, 0.42], [0.72, 0.42]]) b.add(boxGeo(V(K[0] + lx - 0.04, 0, K[2] + lz - 0.04), V(K[0] + lx + 0.04, 0.74, K[2] + lz + 0.04)), wood);
    b.add(boxGeo(V(K[0] - 0.75, 0.8, K[2] - 0.45), V(K[0] + 0.75, 0.802, K[2] + 0.45)), lam("cloth", () => ({ map: checker() })));
    b.build(g, true);
    g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.castShadow = false; });
    // movable table items
    const jar = (col: string, key: string) => {
      const grp = new THREE.Group(), gm = twoTone(new THREE.MeshPhongMaterial({ color: col, specular: "#fff1c8", shininess: 80 }));
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.17, 24).translate(0, 0.085, 0), gm);
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.035, 24).translate(0, 0.0175, 0), lam("lid" + key, () => ({ color: "#c9a24e" })));
      lid.position.y = 0.17; lid.name = "lid";
      grp.add(body, lid); grp.name = key; return grp;
    };
    const spoon = new THREE.Group();
    { const sm = twoTone(new THREE.MeshPhongMaterial({ color: "#c9ccd2", specular: "#ffffff", shininess: 90 }));
      spoon.add(new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.22, 8).translate(0, 0.11, 0), sm));
      const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), sm); bowl.scale.set(1, 0.4, 1.4); spoon.add(bowl); }
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.02, 32), lam("plate", () => ({ color: "#f4f1ea" })));
    const toast = new THREE.Mesh(boxGeo(V(-0.07, 0, -0.07), V(0.07, 0.025, 0.07)), lam("toast", () => ({ color: "#d9a35a" })));
    const pancakes = new THREE.Group();
    for (let i = 0; i < 4; i++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.022, 28), lam("pancake", () => ({ color: "#e2b066" }))); p.position.y = 0.012 + i * 0.024; pancakes.add(p); }
    const it = { honey: jar("#e8a23a", "honey"), mjar: jar("#3e1d0c", "mjar"), spoon, plate, toast, pancakes };
    for (const [k, o] of Object.entries(it)) { o.traverse((x) => { const m = x as THREE.Mesh; if (m.isMesh) { m.castShadow = false; m.receiveShadow = true; } }); this.kItems[k] = o; g.add(o); }
  }

  private buildCourt() {
    const C = COURT, b = new Batch(), g = this.court;
    const pan = lam("cPanel", () => ({ map: panelling() })), upper = lam("cPlaster", () => ({ map: plaster("#e8dfcc") })), floor = lam("cFloor", () => ({ map: planksHD() }));
    const bench = lam("cBench", () => ({ map: shedPlanks("benchHD", "#6e4228", 8) })), win = lam("cWin", () => ({ map: courtWindow() })), trim = lam("cTrim", () => ({ color: "#5a3420" }));
    const W = 5, D = 3, H = 4.4;
    b.add(quadUp(C[0] - W, C[0] + W, C[2] - D, C[2] + D + 3, 5, 4), floor);
    for (const [x0, x1, z0, z1] of [[-W, W, -D - 0.2, -D], [-W - 0.2, -W, -D, D + 3], [W, W + 0.2, -D, D + 3]] as const) {
      b.add(boxGeo(V(C[0] + x0, 0, C[2] + z0), V(C[0] + x1, 1.6, C[2] + z1), 0), pan);
      b.add(boxGeo(V(C[0] + x0, 1.6, C[2] + z0), V(C[0] + x1, H, C[2] + z1), 0), upper);
    }
    for (const wx of [-3.2, 3.2]) b.add(boxGeo(V(C[0] + wx - 0.7, 1.9, C[2] - D + 0.01), V(C[0] + wx + 0.7, 4.0, C[2] - D + 0.04)), win);
    b.add(boxGeo(V(C[0] - W - 0.2, H, C[2] - D - 0.2), V(C[0] + W + 0.2, H + 0.1, C[2] + D + 3), 0, true), upper);
    b.add(boxGeo(V(C[0] - W, H - 0.35, C[2] - D), V(C[0] + W, H, C[2] - D + 0.18)), trim);
    b.add(new THREE.CircleGeometry(0.62, 40), lam("seal", () => ({ map: ctex("sealTex", 256, 256, (gg) => { gg.fillStyle = "#c9a24e"; gg.beginPath(); gg.arc(128, 128, 124, 0, 7); gg.fill(); gg.fillStyle = "#2f4a6a"; gg.beginPath(); gg.arc(128, 128, 100, 0, 7); gg.fill(); gg.fillStyle = "#e9dcc0"; gg.beginPath(); gg.moveTo(128, 50); gg.lineTo(150, 110); gg.lineTo(210, 110); gg.lineTo(160, 145); gg.lineTo(180, 205); gg.lineTo(128, 168); gg.lineTo(76, 205); gg.lineTo(96, 145); gg.lineTo(46, 110); gg.lineTo(106, 110); gg.closePath(); gg.fill(); }) })), new THREE.Matrix4().makeTranslation(C[0], 3.05, C[2] - D + 0.02));
    // judge's bench on a dais, the clerk's desk (front left), the easel (right)
    b.add(boxGeo(V(C[0] - 1.8, 0, C[2] - D), V(C[0] + 1.8, 0.45, C[2] - D + 1.8)), floor);
    b.add(boxGeo(V(C[0] - 1.6, 0.45, C[2] - 1.5), V(C[0] + 1.6, 1.6, C[2] - 1.15), 1.5), bench);
    b.add(boxGeo(V(C[0] - 1.7, 1.6, C[2] - 1.6), V(C[0] + 1.7, 1.68, C[2] - 1.05)), trim);
    b.add(boxGeo(V(C[0] - 3.7, 0, C[2] + 0.75), V(C[0] - 2.1, 0.78, C[2] + 1.55), 1.5), bench);
    b.add(boxGeo(V(C[0] - 3.75, 0.78, C[2] + 0.7), V(C[0] - 2.05, 0.82, C[2] + 1.6)), trim);
    for (const s of [-1, 1]) b.add(new THREE.CylinderGeometry(0.03, 0.03, 1.7, 6).translate(0, 0.85, 0), trim, new THREE.Matrix4().makeTranslation(C[0] + 1.6 + s * 0.35, 0, C[2] + 0.35 + (s > 0 ? 0 : 0.25)));
    b.build(g, true);
    g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.castShadow = false; });
    // the plans on the clerk's desk (signature drawn per frame), the picture on the easel
    const plans = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.6), new THREE.MeshBasicMaterial({ map: ctex("plansTex", 900, 600, (gg) => fxPlans(new Pen(gg), 0)), color: 0xe6e6e6 }));
    plans.rotation.x = -Math.PI / 2; plans.position.set(C[0] - 2.9, 0.823, C[2] + 1.15); plans.layers.set(NOINK); plans.name = "plans";
    g.add(plans); this.kItems.plans = plans;
  }

  /** camera-relative sun, frozen per shot */
  private shotSun(id: number, s: ShotDef, L: LightPreset) {
    let v = this.sunCache.get(id);
    if (v) return v;
    let fx = 0, fz = 0;
    for (let f = s.a; f < s.b; f += 3) {
      const c = camAt(id, f), x = c.look[0] - c.pos[0], z = c.look[2] - c.pos[2], n = Math.hypot(x, z) || 1;
      fx += x / n; fz += z / n;
    }
    const n = Math.hypot(fx, fz) || 1; fx /= n; fz /= n;
    const az = THREE.MathUtils.degToRad(s.sunAz ?? SUN_SHOT[id]?.az ?? L.az), el = THREE.MathUtils.degToRad(s.sunEl ?? SUN_SHOT[id]?.el ?? L.el);
    const hx = fx * Math.cos(az) - fz * Math.sin(az), hz = fz * Math.cos(az) + fx * Math.sin(az);
    v = new THREE.Vector3(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).normalize();
    this.sunCache.set(id, v);
    return v;
  }
  private rods: THREE.Mesh[] = [];
  private rodGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 10).rotateZ(-Math.PI / 2);
  private rod(i: number, col: string) {
    while (this.rods.length <= i) { const m = new THREE.Mesh(this.rodGeo, lam("rod" + col, () => ({ color: col }))); m.matrixAutoUpdate = false; m.castShadow = true; this.root.add(m); this.rods.push(m); }
    const m = this.rods[i]; m.material = lam("rod" + col, () => ({ color: col })); return m;
  }
  private propPool: Record<string, THREE.Object3D[]> = { barrel: [], crate: [] };
  private prop(kind: "barrel" | "crate", used: Set<THREE.Object3D>) {
    const list = this.propPool[kind];
    let o = list.find((x) => !used.has(x));
    if (!o) {
      const b = new Batch(), g = new THREE.Group();
      if (kind === "barrel") addBarrel(b, 0, -0.5, 0, 1, 0, false); else addCrate(b, 0, 0, 0, 1);
      b.build(g, true);
      g.traverse((x) => { const m = x as THREE.Mesh; if (m.isMesh) m.matrixAutoUpdate = true; });
      if (kind === "barrel") { const w = new THREE.Group(); g.rotation.z = Math.PI / 2; g.position.y = 0.5; w.add(g); o = w; } else o = g;
      this.root.add(o); list.push(o);
    }
    return o;
  }
  private actor(i: number) { while (this.actors.length <= i) this.actors.push(new Actor(this.root)); return this.actors[i]; }
  private fx(i: number) { while (this.fxs.length <= i) this.fxs.push(new Fx(this.root)); return this.fxs[i]; }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const t = f / FPS, s = SHOTS[id - 1], L = LIGHTS[s.light], ws = s.s(f);
    // ---- camera ----
    const c = camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = s.place === "out" ? 0.2 : 0.05; cam.far = 1500; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const focus = V(...c.look), dist = cam.position.distanceTo(focus);
    cam.layers.enable(NOINK);
    this.out.visible = s.place === "out"; this.kitchen.visible = s.place === "kitchen"; this.court.visible = s.place === "court";
    // ---- light rig ----
    const K = LOOK[s.light], sunDir = this.shotSun(id, s, L);
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    const Rr = THREE.MathUtils.clamp(dist * 1.15 + 7, s.place === "out" ? 12 : 6, 95);
    this.sun.position.copy(focus).addScaledVector(sunDir, 220); this.sun.target.position.copy(focus);
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 20; sc.far = 480; sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias * (Rr / 12);
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(...K.bounce); TONE.uSat.value = K.sat;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad;
    CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);
    // ---- sky, fog, moon, clouds ----
    const su = this.skyMat.uniforms;
    K.sky.c.forEach((h, i) => untone(h, su["c" + i].value));
    const e = K.sky.e.map((deg) => THREE.MathUtils.degToRad(deg));
    su.e.value.set(e[1], e[2], e[3], e[4]);
    this.sky.position.copy(cam.position);
    untone(L.fog, this.fog.color); this.fog.near = L.fogNear; this.fog.far = L.fogFar;
    scene.fog = s.place === "out" ? this.fog : null; scene.background = null;
    this.moon.visible = s.light === "night";
    if (this.moon.visible) {
      const fw = V(c.look[0] - c.pos[0], 0, c.look[2] - c.pos[2]).normalize(), rt = V(-fw.z, 0, fw.x);
      const pitch = Math.atan2(c.look[1] - c.pos[1], Math.hypot(c.look[0] - c.pos[0], c.look[2] - c.pos[2]));
      const el = pitch + THREE.MathUtils.degToRad(c.fov / 2 - 6);
      const dir = fw.clone().multiplyScalar(Math.cos(el)).addScaledVector(rt, 0.22 * Math.cos(el)).add(V(0, Math.sin(el), 0)).normalize();
      this.moon.position.copy(cam.position).addScaledVector(dir, 900); this.moon.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(2.4)));
    }
    for (let i = 0; i < this.clouds.length; i++) {
      const m = this.clouds[i], mat = m.material as THREE.MeshBasicMaterial;
      m.lookAt(cam.position.x, m.position.y, cam.position.z); mat.map = this.cloudMaps[s.light][i % 4];
    }
    const W = this.WU, wc = K.water;
    untone(wc.near, W.wNearC.value); untone(wc.mid, W.wMidC.value); untone(wc.far, W.wFarC.value);
    untone(wc.crest, W.wCrest.value); untone(wc.trough, W.wTrough.value); untone(wc.glint, W.wGlint.value);
    W.wShade.value.set(...wc.shade); W.wTime.value = t;
    this.lampGlass.emissive.setRGB(...(s.light === "night" ? [3.2, 2.3, 1.2] as [number, number, number] : [0, 0, 0] as [number, number, number]));
    for (const g of this.fgs) g.o.visible = f >= g.a && f < g.b && g.a < s.b && g.b > s.a;
    if (s.place === "out") this.poseOut(id, f, ws, s);
    else this.poseInside(id, f);
    // ---- cast + effects ----
    const right = V(0, 0, 0).setFromMatrixColumn(cam.matrixWorld, 0);
    const st = stage(id, f, { pos: cam.position, right, sun: sunDir });
    this.frustum.setFromProjectionMatrix(this.m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    let ai = 0;
    const used: Actor[] = [];
    for (const p of st.places) {
      const sc2 = p.scale ?? 1;
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y + 1.1 * sc2, p.z), 3.5))) continue;
      const a = this.actor(ai++);
      const [w, h, k] = p.size ?? [300, 500, 0.5];
      a.r = this.pool.req(p.key, w, h, k, p.draw);
      a.mesh.visible = true;
      a.mesh.position.set(p.x, p.y, p.z);
      a.mesh.rotation.set(0, p.yaw ?? Math.atan2(cam.position.x - p.x, cam.position.z - p.z), p.roll ?? 0);
      a.mesh.scale.set(p.mirror ? -sc2 : sc2, sc2, sc2);
      a.mesh.castShadow = L.actorShadow;
      used.push(a);
    }
    for (let i = ai; i < this.actors.length; i++) this.actors[i].mesh.visible = false;
    let fi = 0;
    const fused: Fx[] = [];
    for (const p of st.fx) {
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y, p.z), Math.max(p.w, p.h)))) continue;
      const ef = this.fx(fi++);
      ef.r = this.pool.req(p.key, p.cw, p.ch, 1, p.draw);
      ef.use(!!p.soft);
      ef.mesh.visible = true;
      ef.mesh.position.set(p.x, p.y, p.z);
      if (p.flat) ef.mesh.rotation.set(-Math.PI / 2, 0, p.rot ?? 0);
      else if (p.yaw !== undefined) { ef.mesh.rotation.set(0, p.yaw, p.rot ?? 0); }
      else { ef.mesh.quaternion.copy(cam.quaternion); ef.mesh.rotateZ(p.rot ?? 0); }
      ef.mesh.scale.set(p.w, p.h, 1);
      fused.push(ef);
    }
    for (let i = fi; i < this.fxs.length; i++) this.fxs[i].mesh.visible = false;
    // rods (roller poles) and props (rolling barrels, the floating crate)
    let ri = 0;
    for (const r of st.rods) {
      const m = this.rod(ri++, r.col), a = V(...r.a), b2 = V(...r.b);
      m.matrix.copy(beamM(a, b2, r.r * 2, r.r * 2)); m.matrixWorldNeedsUpdate = true; m.visible = true;
    }
    for (const [i, m] of this.rods.entries()) if (i >= ri) m.visible = false;
    const usedP = new Set<THREE.Object3D>();
    for (const pp of st.props) {
      const o = this.prop(pp.kind, usedP);
      o.position.set(...pp.pos); o.rotation.set(0, pp.yaw, pp.roll ?? 0, "YXZ"); o.scale.setScalar(pp.size); o.visible = true;
      usedP.add(o);
    }
    for (const list of Object.values(this.propPool)) for (const o of list) if (!usedP.has(o)) o.visible = false;
    this.pool.flush();
    for (const a of used) a.bind();
    for (const ef of fused) ef.bind();
    return focus;
  }

  private poseOut(id: number, f: number, ws: number, s: ShotDef) {
    const t = f / FPS;
    // snow on the roofs until the thaw (the freight house melts on screen in shot 7)
    const sk = id === 1 ? 0 : snowK(f);
    this.roofSnow.visible = sk > 0.02 && f < THAW_F1;
    for (const bld of [this.freight, this.shed]) {
      const ridge = bld.group.children[0] ? 0 : 0; void ridge;
      bld.snow.visible = sk > 0.02;
      const k = Math.max(0.05, sk), ry = (bld === this.freight ? 5.4 : SHED.h) + (bld === this.freight ? 9 : SHED.z1 - SHED.z0) * 0.32 + 0.15;
      bld.snow.position.set(0, ry * (1 - k), 0); bld.snow.scale.set(1, k, k);
    }
    this.icicles.visible = f < 940 && id !== 1;
    this.icicles.scale.set(1, Math.max(0.15, 0.25 + 0.75 * sk), 1);
    // ---- tank: steel -> brown paint, groan wobble, burst petals, roof ----
    const brownNow = f >= PAINT_F1 || id === 1;
    const showRoof = s.roof !== false;
    const bs = ws; // seconds since the burst in this shot's story time
    const groan = (id === 7 && f > 775) || (id === 8 && f >= 842 && bs < 0) ? 0.004 * Math.sin(t * 17) + 0.002 * Math.sin(t * 41) : 0;
    for (let i = 0; i < NP; i++) {
      const m = this.panels[i], th = this.panelC[i];
      m.material = brownNow ? this.brown : this.steel;
      const tvec = V(Math.cos(th), 0, -Math.sin(th)), n = V(Math.sin(th), 0, Math.cos(th));
      const pivot = V(TANK[0] + TR * n.x, 0.45, TANK[2] + TR * n.z);
      let a = 0, push = 0, lift = 0;
      if (bs > 0) {
        const hr = Math.sin(i * 12.9898) * 43758.5453, rnd = hr - Math.floor(hr);
        // a hinge falling under gravity: slow to start, slamming down at ~1.1-1.6 s; street-side petals go first
        const delay = 0.06 * ((i * 5) % NP) / NP, u = clamp01((bs - delay) / (1.1 + 0.5 * rnd));
        a = (1.5 + 0.04 * rnd) * u * u;            // they end lying nearly flat on the molasses
        push = (1.2 + 2.3 * rnd) * u * u;
        lift = 1.6 * Math.sin(Math.PI * clamp01(u * 1.2)) * rnd;
      }
      const mm = new THREE.Matrix4().makeTranslation(pivot.x + n.x * push, pivot.y + lift, pivot.z + n.z * push)
        .multiply(new THREE.Matrix4().makeRotationAxis(tvec, a))
        .multiply(new THREE.Matrix4().makeScale(1 + groan, 1, 1 + groan).premultiply(new THREE.Matrix4().makeTranslation(0, 0, 0)))
        .multiply(new THREE.Matrix4().makeTranslation(-pivot.x, -pivot.y, -pivot.z))
        .multiply(new THREE.Matrix4().makeTranslation(TANK[0], 0, TANK[2]));
      m.matrix.copy(mm); m.matrixWorldNeedsUpdate = true;
    }
    this.roof.visible = showRoof;
    if (bs > 0) {
      // the roof falls in, cracks and settles tilted, half sunk in the molasses
      const fall = TH + 0.45 + ROOF_H / 2 - 0.35, drop = Math.min(fall, 4.9 * bs * bs), u = drop / fall;
      this.roof.position.set(TANK[0] + 2.5 * u, TH + 0.45 + ROOF_H / 2 - drop, TANK[2] + 1.5 * u);
      this.roof.rotation.set(0.55 * u, 0.3 * u, -0.42 * u);
      (this.roof.material as THREE.Material) = this.roofMat;
    } else { this.roof.position.set(TANK[0], TH + 0.45 + ROOF_H / 2, TANK[2]); this.roof.rotation.set(0, 0, 0); }
    this.water6.visible = id === 4;
    // paint sweeping across the bare steel (shot 5, from the left edge of the view toward the right)
    const pk = paintK(f);
    this.paintOver.visible = id === 5 && f >= PAINT_F0 && f < PAINT_F1 && pk > 0;
    if (this.paintOver.visible) {
      const q = Math.round(pk * 48);
      let g = this.paintGeo.get(q);
      if (!g) {
        const th0 = PAINT_TH0, span = (PAINT_TH1 - PAINT_TH0) * (q / 48);
        g = new THREE.CylinderGeometry(TR + 0.03, TR + 0.03, TH, 24, 1, true, th0 + Math.min(0, span), Math.max(0.001, Math.abs(span))).translate(TANK[0], TH / 2 + 0.45, TANK[2]);
        const uv = g.attributes.uv as THREE.BufferAttribute; for (let k = 0; k < uv.count; k++) uv.setX(k, uv.getX(k) * 9.6 * (Math.abs(span) / (Math.PI * 2)));
        this.paintGeo.set(q, g);
      }
      this.paintOver.geometry = g;
    }
    // ---- el railway: columns tilt when the crest hits ----
    const q0 = new THREE.Quaternion(), mtx = new THREE.Matrix4();
    const tops: THREE.Vector3[][] = COLS_X.map(() => []);
    COLS_X.forEach((x, i) => {
      COLS_Z.forEach((zc, j) => {
        const th = bs > 0 ? colTilt(x, zc, bs) : 0, L = EL_Y0;
        const base = V(x, 0.14, zc), top = base.clone().add(V(0, L * Math.cos(th), L * Math.sin(th)));
        tops[i].push(top);
        this.cols.setMatrixAt(i * 2 + j, mtx.compose(base.clone().add(top).multiplyScalar(0.5), q0.setFromAxisAngle(_x, th), _s.set(0.55, L, 0.55)));
      });
      this.cross.setMatrixAt(i, beamM(tops[i][0], tops[i][1], 0.5, 0.75));
    });
    const onCross = (i: number, z: number) => { const [a, c2] = tops[i]; return a.clone().lerp(c2, (z - COLS_Z[0]) / (COLS_Z[1] - COLS_Z[0])); };
    for (let i = 0; i < COLS_X.length - 1; i++) {
      [EL_Z0, EL_Z1].forEach((z, j) => {
        const a = onCross(i, z).add(V(0, 0.45, 0)), c2 = onCross(i + 1, z).add(V(0, 0.45, 0));
        this.girders.setMatrixAt(i * 2 + j, beamM(a, c2, 0.35, 1.0));
      });
      const a = onCross(i, (EL_Z0 + EL_Z1) / 2).add(V(0, EL_Y1 - EL_Y0 + 0.05, 0)), c2 = onCross(i + 1, (EL_Z0 + EL_Z1) / 2).add(V(0, EL_Y1 - EL_Y0 + 0.05, 0));
      this.slabs.setMatrixAt(i, beamM(a, c2, EL_Z1 - EL_Z0 - 0.3, 0.12));
      [1.2, 2.6, 3.4, 4.8].forEach((z, j) => {
        const ra = onCross(i, z).add(V(0, EL_Y1 - EL_Y0 + 0.2, 0)), rb = onCross(i + 1, z).add(V(0, EL_Y1 - EL_Y0 + 0.2, 0));
        this.rails.setMatrixAt(i * 4 + j, beamM(ra, rb, 0.08, 0.14));
      });
    }
    for (const im of [this.cols, this.cross, this.girders, this.slabs, this.rails]) im.instanceMatrix.needsUpdate = true;
    // ---- the shed gets flattened ----
    const k = bs > 0 ? shedK(bs) : 0;
    this.shed.group.scale.set(1 + 0.08 * k, Math.max(0.12, 1 - 0.88 * k), 1 + 0.15 * k);
    this.shed.group.position.set((SHED.x0 + SHED.x1) / 2 + 0.4 * k, 0, (SHED.z0 + SHED.z1) / 2 + 1.6 * k);
    this.shed.group.rotation.set(0, 0, 0.05 * k);
    // ---- the hose (shot 7) ----
    this.hose.mesh.visible = s.crowd === "ship";
    if (this.hose.mesh.visible) {
      const a = V(-40, WATER_Y + 5.6, SHIP.z + 4.2), c2 = V(TANK[0] - 11.8, TH + 0.9, TANK[2] - 7.0), pts: THREE.Vector3[] = [];
      for (let i = 0; i < 26; i++) { const u = i / 25; pts.push(a.clone().lerp(c2, u).add(V(0, -6 * u * (1 - u) + 0.15 * Math.sin(t * 2 + u * 6), 0))); }
      this.hose.set(pts);
    }
    // ---- the flood ----
    this.flood.visible = bs > 0;
    if (this.flood.visible) this.poseFlood(bs, s.light === "night");
  }

  private poseFlood(sec: number, frozen: boolean) {
    const key = `${sec.toFixed(4)}|${frozen}`;
    if (key === this.floodKey) return;
    this.floodKey = key;
    const pos = this.fGeo.attributes.position.array as Float32Array, uv = this.fGeo.attributes.uv.array as Float32Array;
    const col = this.fGeo.attributes.color.array as Float32Array;
    const flow = frozen ? 7.5 : 0.9 * sec, R = frontR(sec), H = crestH(sec);
    const rings = Math.min(FNR, Math.ceil((R + 0.42 * H + 3) / FDR) + 1);
    for (let i = 0; i < rings; i++) {
      const r = i * FDR;
      const y0 = floodY(r, sec), D = baseD(sec), nearCrest = R - r < 1.6 * H + 4;
      for (let j = 0; j <= FNA; j++) {
        const ph = (j / FNA) * Math.PI * 2, sx = Math.sin(ph), cz = Math.cos(ph);
        const bx = TANK[0] + r * sx, bz = TANK[2] + r * cz;
        // lumpy crest: only the part above the settled depth is scaled
        const yl = y0 > D && nearCrest ? D + (y0 - D) * lump(ph, sec) : y0;
        const c = yl > 0.05 ? curl(yl, sec) : 0, lip = H > 1 && nearCrest ? smooth((yl / H - 0.84) / 0.16) : 0;
        let y = yl > 0.05 ? yl : -0.35, px = bx + sx * c, pz = bz + cz * c;
        if (bz < WHARF_Z) { y = r <= R ? WATER_Y + 0.1 + Math.max(0, Math.min(y0, 3) - 0.6) * smooth((bz - WHARF_Z + 6) / 6) : -5; px = bx; pz = bz; }
        const o = (i * (FNA + 1) + j) * 3;
        pos[o] = px; pos[o + 1] = y + 0.02; pos[o + 2] = pz;
        col[o] = 1 + 0.45 * lip; col[o + 1] = 1 + 0.34 * lip; col[o + 2] = 1 + 0.2 * lip;
        const q2 = (i * (FNA + 1) + j) * 2;
        uv[q2] = (ph * Math.max(r, 3)) / 7; uv[q2 + 1] = (r - flow) / 7;
      }
    }
    this.fGeo.setDrawRange(0, Math.max(0, rings - 1) * FNA * 6);
    for (const k of ["position", "uv", "color"]) this.fGeo.attributes[k].needsUpdate = true;
    this.fGeo.computeVertexNormals();
    this.fMat.color.set(frozen ? "#9a8678" : "#c4ab9a"); // molasses is dark: keep the lit side brown, not caramel
    this.fMat.shininess = frozen ? 18 : 46;
    this.fMat.specular.set(frozen ? "#9fb4d8" : "#9c7454");
  }

  private poseInside(id: number, f: number) {
    const t = f / FPS, K = KITCHEN, it = this.kItems;
    const honey = it.honey, mjar = it.mjar, spoon = it.spoon, plate = it.plate, toast = it.toast, pancakes = it.pancakes;
    for (const o of [honey, mjar, spoon, plate, toast, pancakes]) if (o) o.visible = false;
    this.ribbon.mesh.visible = false; this.molStrand.mesh.visible = false;
    if (id === 12) {
      honey.visible = true; plate.visible = true; toast.visible = true; spoon.visible = true;
      plate.position.set(K[0] + 0.12, 0.81, K[2] - 0.1); toast.position.set(K[0] + 0.12, 0.82, K[2] - 0.1);
      const lid = honey.getObjectByName("lid")!;
      if (f < 1365) {
        honey.position.set(K[0] - 0.28, 0.802, K[2] - 0.05); lid.visible = false;
        // warm honey: a ribbon from the spoon the kid holds over the toast
        const sp = V(K[0] + 0.1, 1.08 + 0.01 * Math.sin(t * 3), K[2] - 0.1);
        spoon.position.copy(sp); spoon.rotation.set(0, 0, 1.0);
        if (f >= 1321) {
          this.ribbon.mesh.visible = true;
          const pts: THREE.Vector3[] = [];
          for (let i = 0; i < 24; i++) { const u = i / 23; pts.push(V(sp.x - 0.012 + 0.004 * Math.sin(t * 3 + u * 4) * u, sp.y - 0.015 - u * (sp.y - 0.84), sp.z + 0.003 * Math.cos(t * 2.5 + u * 3) * u)); }
          this.ribbon.set(pts);
        }
      } else {
        // cold honey from the fridge: the spoon stands up in it; pulled, the whole jar comes along
        const lift = f >= 1405 ? 0.22 * smooth((f - 1405) / 14) : 0;
        honey.position.set(K[0] - 0.18, 0.802 + lift, K[2] - 0.12); lid.visible = false;
        spoon.position.set(K[0] - 0.18, 0.802 + 0.09 + lift, K[2] - 0.12); spoon.rotation.set(0, 0, 0.06);
      }
    }
    if (id === 20) {
      mjar.visible = true; plate.visible = true; pancakes.visible = true;
      plate.position.set(K[0] + 0.22, 0.81, K[2] + 0.06); pancakes.position.set(K[0] + 0.22, 0.82, K[2] + 0.06);
      const lid = mjar.getObjectByName("lid")!;
      if (f < 2030) {
        // tipped jar, a slow thin strand of molasses onto the pancakes
        // tipped toward the stack: the mouth hangs over the pancakes
        mjar.position.set(K[0] + 0.06, 1.04, K[2] + 0.06); mjar.rotation.set(0, 0, -2.0); lid.visible = false;
        this.molStrand.mesh.visible = true;
        const lip = V(K[0] + 0.215, 0.965, K[2] + 0.06), pts: THREE.Vector3[] = [];
        for (let i = 0; i < 20; i++) { const u = i / 19; pts.push(V(lip.x + 0.004 * Math.sin(t * 2 + u * 5), lip.y - u * (lip.y - 0.915), lip.z)); }
        this.molStrand.set(pts);
      } else {
        // upright, the lid slammed back on (LID_F), slid away
        const slide = f > 2056 ? 0.2 * smooth((f - 2056) / 16) : 0;
        mjar.position.set(K[0] + 0.05 - slide, 0.802, K[2] - 0.05); mjar.rotation.set(0, 0, 0);
        lid.visible = f >= 2042; lid.position.y = 0.17 + (f < 2046 ? 0.06 * (2046 - f) / 4 : 0);
      }
    }
    if (id === 16 || id === 17) {
      const plans = it.plans as THREE.Mesh;
      plans.visible = true;
      const kk = id === 17 ? clamp01((f - 1788) / 26) : 0, q = Math.round(kk * 30);
      (plans.material as THREE.MeshBasicMaterial).map = ctex("plansTex" + q, 900, 600, (gg) => fxPlans(new Pen(gg), q / 30));
    }
  }
}

const WATER_DECL = `#include <common>
varying vec3 vWP;
uniform vec3 wNearC, wMidC, wFarC, wCrest, wTrough, wGlint, wShade;
uniform sampler2D wNearTex, wFarTex;
uniform float wTime;`;
const WATER_COL = `
  vec3 wV = vWP - cameraPosition;
  float wd = length(wV);
  float wDep = asin(clamp(-wV.y / wd, 0.0, 1.0));
  float wf = 1.0 - smoothstep(0.0, 0.42, wDep);
  vec3 wc = mix(mix(wNearC, wMidC, smoothstep(0.0, 0.55, wf)), wFarC, smoothstep(0.55, 1.0, wf));
  vec2 wp = vWP.xz + vec2(0.2 * wTime, 0.1 * wTime);
  vec4 mk = mix(texture2D(wNearTex, wp / 8.0), texture2D(wFarTex, wp / 40.0 + 0.37), smoothstep(25.0, 90.0, wd));
  wc = mix(wc, wTrough, mk.g * 0.6);
  wc = mix(wc, wCrest, mk.r * 0.7);
  wc = mix(wc, wGlint, mk.b * (0.3 + 0.5 * wf));
  diffuseColor.rgb = wc;`;
export { addBarrel, addCrate, BURST_F, sOf };
