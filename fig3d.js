/* 3D figure: a body model with joint angles (forward kinematics) and a Three.js renderer.
   Coordinates: x = the figure's left, y = up, z = forward. Lengths in cm (figure about 175 cm).
   Angles in degrees. Positive means: flexion forward (shoulder, hip, spine, head nod),
   abduction away from the body, knee and elbow bending, ankle pointing the toes (0 = foot at a right angle). */

export const BODY = {
  ankleH: 7.5, shin: 41.5, thigh: 42, hipHalf: 9,          // hip joints 91 cm above the floor
  lumbar: 13, thorax: 26, shoulderDrop: 4, shoulderHalf: 18, neck: 9, headR: 11,
  upperArm: 29, forearm: 25, hand: 18,
  heel: 5.5, footLen: 24, ballAt: 18,
  head: { r: 11 }
};

/* Every angle key, with its range of motion (active, degrees). The checks use these. */
export const LIMITS = {
  pitch: [-180, 180], roll: [-180, 180], yaw: [-180, 180], pelvisTurn: [-45, 45],
  spineBend: [-30, 45], spineSide: [-35, 35], spineTwist: [-50, 50],
  headNod: [-45, 45], headTurn: [-75, 75], headTilt: [-40, 40],
  shoulderLift: [-10, 30],
  lShFlex: [-60, 190], lShAbd: [-55, 180], lShRot: [-90, 90], lElbow: [-5, 150], lWrist: [-95, 90],
  rShFlex: [-60, 190], rShAbd: [-55, 180], rShRot: [-90, 90], rElbow: [-5, 150], rWrist: [-95, 90],
  lHipFlex: [-20, 135], lHipAbd: [-30, 50], lHipRot: [-45, 50], lKnee: [-3, 150], lAnkle: [-40, 90],
  rHipFlex: [-20, 135], rHipAbd: [-30, 50], rHipRot: [-45, 50], rKnee: [-3, 150], rAnkle: [-40, 90]
};
export const ZERO = Object.fromEntries(Object.keys(LIMITS).map(k => [k, 0]));

/* ---------- small 3x3 rotation helpers ---------- */
const D = Math.PI / 180;
const mul = (A, B) => A.map((r, i) => [0, 1, 2].map(j => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
const app = (A, v) => [A[0][0] * v[0] + A[0][1] * v[1] + A[0][2] * v[2], A[1][0] * v[0] + A[1][1] * v[1] + A[1][2] * v[2], A[2][0] * v[0] + A[2][1] * v[1] + A[2][2] * v[2]];
const Rx = a => { const c = Math.cos(a * D), s = Math.sin(a * D); return [[1, 0, 0], [0, c, -s], [0, s, c]]; };
const Ry = a => { const c = Math.cos(a * D), s = Math.sin(a * D); return [[c, 0, s], [0, 1, 0], [-s, 0, c]]; };
const Rz = a => { const c = Math.cos(a * D), s = Math.sin(a * D); return [[c, -s, 0], [s, c, 0], [0, 0, 1]]; };
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
export const I3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

/* Forward kinematics: joint angles -> 3D points and segment frames.
   Root is the pelvis centre between the hip joints. */
export function solve(a0, root = [0, BODY.ankleH + BODY.shin + BODY.thigh, 0]) {
  const a = Object.assign({}, ZERO, a0), B = BODY, P = {}, F = {};
  // trunk orientation: yaw, then lean forward (pitch), then tip sideways (roll, + toward the figure's left)
  const R0 = mul(mul(Ry(a.yaw), Rx(a.pitch)), Rz(-a.roll));
  const pos = add(root, [a.tx || 0, a.ty || 0, a.tz || 0]);
  P.pelvis = pos; F.pelvis = mul(R0, Ry(a.pelvisTurn));
  // spine in two parts, each taking half of the bend, side bend and twist
  const half = mul(mul(Ry(a.spineTwist / 2), Rx(a.spineBend / 2)), Rz(-a.spineSide / 2));
  F.lumbar = mul(R0, half);
  P.waist = add(pos, app(F.lumbar, [0, B.lumbar, 0]));
  F.thorax = mul(F.lumbar, half);
  P.chest = add(P.waist, app(F.thorax, [0, B.thorax * .55, 0]));
  P.neck = add(P.waist, app(F.thorax, [0, B.thorax, 0]));
  F.head = mul(mul(mul(F.thorax, Ry(a.headTurn)), Rx(a.headNod)), Rz(-a.headTilt));
  P.head = add(add(P.neck, app(F.thorax, [0, B.neck * .55, 0])), app(F.head, [0, B.headR * .95, 0]));
  P.headTop = add(P.head, app(F.head, [0, B.headR, 0]));
  P.face = add(P.head, app(F.head, [0, 0, B.headR]));
  // arms
  for (const s of ["l", "r"]) {
    const sg = s === "l" ? 1 : -1;
    const sh = add(P.neck, app(F.thorax, [sg * B.shoulderHalf, -B.shoulderDrop + a.shoulderLift * .12, 0]));
    const Fa = mul(mul(mul(F.thorax, Rx(-a[s + "ShFlex"])), Rz(sg * a[s + "ShAbd"])), Ry(sg * a[s + "ShRot"]));
    const el = add(sh, app(Fa, [0, -B.upperArm, 0]));
    const Ff = mul(Fa, Rx(-a[s + "Elbow"]));
    const wr = add(el, app(Ff, [0, -B.forearm, 0]));
    const Fh = mul(Ff, Rx(-a[s + "Wrist"]));
    P[s + "Shoulder"] = sh; P[s + "Elbow"] = el; P[s + "Wrist"] = wr; P[s + "Hand"] = add(wr, app(Fh, [0, -B.hand, 0]));
    F[s + "UpperArm"] = Fa; F[s + "Forearm"] = Ff; F[s + "Hand"] = Fh;
  }
  // legs
  for (const s of ["l", "r"]) {
    const sg = s === "l" ? 1 : -1;
    const hip = add(pos, app(F.pelvis, [sg * B.hipHalf, 0, 0]));
    const Ft = mul(mul(mul(F.pelvis, Rx(-a[s + "HipFlex"])), Rz(sg * a[s + "HipAbd"])), Ry(-sg * a[s + "HipRot"]));
    const kn = add(hip, app(Ft, [0, -B.thigh, 0]));
    const Fs = mul(Ft, Rx(a[s + "Knee"]));
    const an = add(kn, app(Fs, [0, -B.shin, 0]));
    const Ff = mul(Fs, Rx(a[s + "Ankle"]));
    P[s + "Hip"] = hip; P[s + "Knee"] = kn; P[s + "Ankle"] = an;
    P[s + "Heel"] = add(an, app(Ff, [0, -B.ankleH, -B.heel]));
    P[s + "Ball"] = add(an, app(Ff, [0, -B.ankleH, B.ballAt - B.heel]));
    P[s + "Toe"] = add(an, app(Ff, [0, -B.ankleH * .7, B.footLen - B.heel]));
    F[s + "Thigh"] = Ft; F[s + "Shin"] = Fs; F[s + "Foot"] = Ff;
  }
  return { P, F, a };
}

/* Put the lowest body point on the floor (y = 0). */
export function ground(sol) {
  let low = Infinity;
  for (const k in sol.P) low = Math.min(low, sol.P[k][1]);
  for (const k in sol.P) sol.P[k] = [sol.P[k][0], sol.P[k][1] - low, sol.P[k][2]];
  return sol;
}

/* ---------- Three.js renderer ---------- */
export const COLORS = { skin: 0xC68E68, top: 0xE0708A, legs: 0x5A3260, hair: 0x3B2418, eye: 0x2A160C, lip: 0xB4485E, floor: 0xEFE6E9 };

/* Torso cross-sections from the hips (h = 0 at the hip joints) up to the neck, in cm:
   [height, half width, half depth, forward offset]. Gives hips, glutes, waist, bust and shoulder line. */
const TORSO = [
  [-10, 6, 4.5, -1], [-7, 14, 9.5, -1.5], [-3, 17, 11, -2], [3, 16, 10.5, -1], [9, 13.8, 9.2, 0], [14, 12.8, 8.8, 0],
  [20, 13.6, 9.4, .2], [25, 14.8, 9.8, .6], [30, 15.2, 11.4, 2], [34, 15.8, 10.4, 1.2], [37, 17.4, 8.6, -.4],
  [39.2, 12.5, 6.6, -1], [40.8, 5.6, 5, -.6]];
const lerp3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const blendR = (A, B, k) => { // blend two rotations and re-orthonormalise (columns are the axes)
  const col = (M, j) => [M[0][j], M[1][j], M[2][j]], n = v => { const L = Math.hypot(...v) || 1; return v.map(x => x / L); };
  const y = n(lerp3(col(A, 1), col(B, 1), k)), z0 = lerp3(col(A, 2), col(B, 2), k);
  const x = n([y[1] * z0[2] - y[2] * z0[1], y[2] * z0[0] - y[0] * z0[2], y[0] * z0[1] - y[1] * z0[0]]);
  const z = [x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]];
  return [[x[0], y[0], z[0]], [x[1], y[1], z[1]], [x[2], y[2], z[2]]];
};
/* centre and frame of the torso at height h above the hip joints */
function torsoAt(sol, h) {
  const { P, F } = sol, L = BODY.lumbar;
  if (h <= 0) return [add(P.pelvis, app(F.pelvis, [0, h, 0])), F.pelvis];
  if (h <= L) { const k = h / L; return [lerp3(P.pelvis, P.waist, k), blendR(F.pelvis, F.lumbar, Math.min(1, k * 1.6))]; }
  const k = Math.min(1, (h - L) / 8);
  return [add(P.waist, app(F.thorax, [0, h - L, 0])), blendR(F.lumbar, F.thorax, k)];
}

export class Figure3D {
  constructor(THREE) {
    this.T = THREE;
    const T = THREE, scene = this.scene = new T.Scene();
    scene.add(new T.HemisphereLight(0xfff6f0, 0x9a7f8a, 2.1));
    const key = new T.DirectionalLight(0xffffff, 2.4); key.position.set(-140, 260, 260); scene.add(key);
    const rim = new T.DirectionalLight(0xffe4ec, .55); rim.position.set(-200, 120, -150); scene.add(rim);
    const M = c => new T.MeshStandardMaterial({ color: c, roughness: .62, metalness: 0 });
    this.mat = { skin: M(COLORS.skin), top: M(COLORS.top), legs: M(COLORS.legs), hair: M(COLORS.hair), eye: M(COLORS.eye), lip: M(COLORS.lip) };
    this.body = new T.Group(); scene.add(this.body);
    this.parts = {};
    const unitSphere = new T.SphereGeometry(1, 32, 20);
    const sph = (name, mat) => { const m = new T.Mesh(unitSphere, mat); this.body.add(m); this.parts[name] = m; return m; };
    // a limb segment: tapered cylinder plus a sphere at each end, rebuilt only in transform
    const cyl = new T.CylinderGeometry(1, 1, 1, 28, 1, true);
    const seg = (name, mat) => { const m = new T.Mesh(cyl, mat); this.body.add(m); this.parts[name] = m; return m; };
    for (const s of ["l", "r"]) {
      seg(s + "Thigh", this.mat.legs); seg(s + "Shin", this.mat.legs); sph(s + "KneeJ", this.mat.legs); sph(s + "HipJ", this.mat.legs);
      sph(s + "Foot", this.mat.skin); sph(s + "AnkleJ", this.mat.skin);
      seg(s + "UpperArm", this.mat.skin); seg(s + "Forearm", this.mat.skin); sph(s + "ShoulderJ", this.mat.skin); sph(s + "ElbowJ", this.mat.skin); sph(s + "WristJ", this.mat.skin);
      sph(s + "Hand", this.mat.skin); sph(s + "Eye", this.mat.eye);
    }
    // torso as two smooth tubes: leggings up to the waist, the top above it
    const tube = (name, mat, rows) => {
      const S = 36, g = new T.BufferGeometry(), pos = new Float32Array(rows.length * S * 3), idx = [];
      for (let r = 0; r < rows.length - 1; r++) for (let i = 0; i < S; i++) {
        const a = r * S + i, b = r * S + (i + 1) % S, c = a + S, d = b + S; idx.push(a, c, b, b, c, d);
      }
      g.setIndex(idx); g.setAttribute("position", new T.BufferAttribute(pos, 3));
      const m = new T.Mesh(g, mat); m.userData = { rows, S }; this.body.add(m); this.parts[name] = m; return m;
    };
    tube("hips", this.mat.legs, TORSO.filter(r => r[0] <= 11).concat([[11.5, 13.4, 9, 0]]));
    tube("top", this.mat.top, [[10, 13.5, 9.1, 0]].concat(TORSO.filter(r => r[0] > 10)));
    seg("neck", this.mat.skin);
    sph("head", this.mat.skin); sph("hair", this.mat.hair); sph("bun", this.mat.hair); sph("nose", this.mat.skin); sph("lips", this.mat.lip);
    sph("lEar", this.mat.skin); sph("rEar", this.mat.skin);
    const floor = new T.Mesh(new T.CircleGeometry(60, 48), new T.MeshStandardMaterial({ color: COLORS.floor, roughness: 1 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -.05; scene.add(floor); this.floor = floor;
  }
  /* place an ellipsoid at p, radii r (x,y,z in the frame R) */
  _ell(name, p, r, R) {
    const m = this.parts[name]; m.position.set(p[0], p[1], p[2]);
    m.setRotationFromMatrix(this._m4(R || I3)); m.scale.set(r[0], r[1], r[2]);
  }
  _m4(R) { const M = new this.T.Matrix4(); M.set(R[0][0], R[0][1], R[0][2], 0, R[1][0], R[1][1], R[1][2], 0, R[2][0], R[2][1], R[2][2], 0, 0, 0, 0, 1); return M; }
  /* tapered segment from A (radius ra) to B (radius rb); drawn as a cylinder whose ends meet joint spheres */
  _seg(name, A, B, ra, rb, R) {
    const T = this.T, m = this.parts[name];
    const len = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]);
    if (!m.userData.taper || m.userData.taper[0] !== ra || m.userData.taper[1] !== rb) {
      m.geometry = new T.CylinderGeometry(rb, ra, 1, 28, 1, true); m.userData.taper = [ra, rb];
    }
    m.position.set((A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2);
    // the frame's y axis points from B to A (segments hang along -y), so flip it to point A -> B
    const R2 = R ? [[R[0][0], -R[0][1], R[0][2]], [R[1][0], -R[1][1], R[1][2]], [R[2][0], -R[2][1], R[2][2]]] : null;
    if (R2) m.setRotationFromMatrix(this._m4(R2));
    else { const d = new T.Vector3(B[0] - A[0], B[1] - A[1], B[2] - A[2]).normalize(); m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d); }
    m.scale.set(1, len, 1);
  }
  pose(sol) {
    const { P, F } = sol, e = (n, p, r, R) => this._ell(n, p, r, R), mid = (a, b, k = .5) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
    // legs (leggings) and bare feet
    for (const s of ["l", "r"]) {
      this._seg(s + "Thigh", P[s + "Hip"], P[s + "Knee"], 7.6, 5.2);
      this._seg(s + "Shin", P[s + "Knee"], P[s + "Ankle"], 5.0, 3.2);
      e(s + "HipJ", P[s + "Hip"], [7.6, 7.6, 7.6]); e(s + "KneeJ", P[s + "Knee"], [5.2, 5.2, 5.2]); e(s + "AnkleJ", P[s + "Ankle"], [3.3, 3.3, 3.3]);
      const fc = mid(P[s + "Heel"], P[s + "Toe"]); e(s + "Foot", add(fc, [0, 2.6, 0]), [4.2, 3.0, 12.6], F[s + "Foot"]);
      // arms
      this._seg(s + "UpperArm", P[s + "Shoulder"], P[s + "Elbow"], 4.6, 3.5);
      this._seg(s + "Forearm", P[s + "Elbow"], P[s + "Wrist"], 3.5, 2.4);
      e(s + "ShoulderJ", P[s + "Shoulder"], [5.2, 5.2, 5.2]); e(s + "ElbowJ", P[s + "Elbow"], [3.5, 3.5, 3.5]); e(s + "WristJ", P[s + "Wrist"], [2.4, 2.4, 2.4]);
      e(s + "Hand", mid(P[s + "Wrist"], P[s + "Hand"], .45), [2.5, 7.6, 4.6], F[s + "Hand"]);
    }
    // torso: elliptical rings along the spine
    for (const name of ["hips", "top"]) {
      const m = this.parts[name], { rows, S } = m.userData, pos = m.geometry.attributes.position.array;
      rows.forEach(([h, w, dp, zo], r) => {
        const [c, R] = torsoAt(sol, h);
        for (let i = 0; i < S; i++) {
          const t = i / S * Math.PI * 2, v = app(R, [Math.sin(t) * w, 0, Math.cos(t) * dp + zo]);
          pos.set([c[0] + v[0], c[1] + v[1], c[2] + v[2]], (r * S + i) * 3);
        }
      });
      m.geometry.attributes.position.needsUpdate = true; m.geometry.computeVertexNormals(); m.geometry.computeBoundingSphere();
    }
    this._seg("neck", add(P.neck, app(F.thorax, [0, -3, 0])), mid(P.neck, P.head, .7), 4.4, 4.0);
    // head
    const H = P.head, Fh = F.head;
    e("head", H, [9.2, 11.2, 10.2], Fh);
    e("hair", add(H, app(Fh, [0, 1.6, -1.6])), [9.8, 11.2, 10.0], Fh);
    e("bun", add(H, app(Fh, [0, 9.5, -8])), [4.6, 4.6, 4.6], Fh);
    e("lEye", add(H, app(Fh, [3.3, 1.2, 9.3])), [1.1, 1.3, .7], Fh);
    e("rEye", add(H, app(Fh, [-3.3, 1.2, 9.3])), [1.1, 1.3, .7], Fh);
    e("nose", add(H, app(Fh, [0, -1.6, 10.2])), [1.3, 2.0, 1.4], Fh);
    e("lips", add(H, app(Fh, [0, -5.6, 9.0])), [2.4, .8, .8], Fh);
    e("lEar", add(H, app(Fh, [9.1, 0, 0])), [1.2, 2.6, 1.8], Fh);
    e("rEar", add(H, app(Fh, [-9.1, 0, 0])), [1.2, 2.6, 1.8], Fh);
  }
}
