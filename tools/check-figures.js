#!/usr/bin/env node
/* Figure checks: measures every exercise animation and saves a picture sheet.
   Run:  node tools/check-figures.js [--sheet out.png] [--style char|doodle|toon|stick] [ids,comma,separated]
   Needs Playwright with Chromium (require('playwright')).
   Units are the figure's 100x100 box; standing height is about 85 units (1 unit is about 2 cm).
   Each check samples 120 moments per loop. Exit code 1 when there are findings that are not
   listed under ALLOW with a reason. */
const fs = require("fs"), path = require("path");
const { chromium } = require("playwright");

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const SHEET = opt("--sheet", null), STYLE = opt("--style", "char");
const ONLY = args[0] ? args[0].split(",") : null;

/* Deliberate exceptions, per exercise and check, each with a reason. */
const ALLOW = {
  "sunsal:slide": "The flow is shortened: going from the fold into the lunge, hands and feet move forward in one beat. Planting them would push the plank off the edge of the picture.",
  "pigeon:slide": "The hands walk forward to fold down and walk back to sit up; each step lifts the hand.",
};

const GROUND = 96.5;        // floor line in the drawing
const SAMPLES = 120;

(async () => {
  const src = path.join(__dirname, "..", "index.html");
  const lines = fs.readFileSync(src, "utf8").split("\n");
  const at = lines.findIndex(l => l.startsWith("  destroy(){figures.delete(this)}"));
  if (at < 0) throw new Error("Could not find the Figure class in index.html");
  lines.splice(at + 2, 0, "window.__fig={Figure,EX,FRONT};");
  const tmp = path.join(require("os").tmpdir(), "haruku-figcheck.html");
  fs.writeFileSync(tmp, lines.join("\n"));

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.addInitScript(s => { localStorage.setItem("hy:figStyle", JSON.stringify(s)); }, STYLE);
  await page.goto("file://" + tmp);
  await page.waitForFunction(() => window.__fig);

  const report = await page.evaluate(({ ONLY, GROUND, SAMPLES }) => {
    const { Figure, EX, FRONT } = window.__fig;
    const out = [];
    const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const mid = (a, b, k = .5) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
    // reference bone lengths from the plain standing pose (mountain, first frame)
    const S = EX.find(e => e.id === "mountain").frames[0];
    const REF = { "upper arm": d(S.n, S.le), "forearm": d(S.le, S.lh), "thigh": d(S.p, S.lk), "shin": d(S.lk, S.lf), "torso": d(S.n, S.p), "neck": d(S.n, S.h) };
    // bones as drawn: the realistic style places shoulders and hips apart in front views (fig.joints)
    const bones = (q, j) => ({
      "upper arm": [d(j.shL, j.le), d(j.shR, j.re)], "forearm": [d(j.le, j.lh), d(j.re, j.rh)],
      "thigh": [d(j.hpL, j.lk), d(j.hpR, j.rk)], "shin": [d(j.lk, j.lf), d(j.rk, j.rf)],
      "torso": [d(q.n, q.p)], "neck": [d(q.n, q.h)]
    });
    // centre of mass from segment masses (% of body weight)
    const com = q => {
      const c = q.c || mid(q.n, q.p), seg = [
        [q.h, 8], [mid(mid(q.n, q.p), c), 50],
        [mid(q.n, q.le), 2.8], [mid(q.n, q.re), 2.8], [mid(q.le, q.lh), 1.6], [mid(q.re, q.rh), 1.6], [q.lh, .6], [q.rh, .6],
        [mid(q.p, q.lk), 10], [mid(q.p, q.rk), 10], [mid(q.lk, q.lf), 4.65], [mid(q.rk, q.rf), 4.65], [q.lf, 1.45], [q.rf, 1.45]];
      const m = seg.reduce((s, x) => s + x[1], 0);
      return [seg.reduce((s, x) => s + x[0][0] * x[1], 0) / m, seg.reduce((s, x) => s + x[0][1] * x[1], 0) / m];
    };
    // name a drawn element by finding it in the realistic figure's parts (fig.c)
    const partName = (fig, el) => {
      for (const k in fig.c || {}) { const v = fig.c[k];
        if (v === el) return k;
        if (v && typeof v === "object" && !(v instanceof Element)) for (const s in v) if (v[s] === el) return `${k} ${s}`; }
      return "part of the body";
    };
    const kneeBend = (hip, knee, ankle) => { // signed bend in degrees; negative = bent backwards
      const v1 = [knee[0] - hip[0], knee[1] - hip[1]], v2 = [ankle[0] - knee[0], ankle[1] - knee[1]];
      return Math.atan2(v1[0] * v2[1] - v1[1] * v2[0], v1[0] * v2[0] + v1[1] * v2[1]) * 180 / Math.PI;
    };
    for (const ex of EX) {
      if (ONLY && !ONLY.includes(ex.id)) continue;
      const fig = new Figure(ex, { animate: false }); fig.animate = false;
      document.body.appendChild(fig.svg);
      const front = FRONT.has(ex.id), find = {}, note = (k, msg, t) => { if (!find[k]) find[k] = { msg, t: +t.toFixed(2), n: 0, last: -1 }; if (find[k].last !== t) { find[k].n++; find[k].last = t; } };
      let prev = null;
      const slide = {};
      for (let i = 0; i < SAMPLES; i++) {
        const t = i * ex.dur / SAMPLES, q = fig.pose(t);
        fig.draw(t);
        // 1. drawn body in the floor, or floating above it
        let low = -1, lowEl = null;
        for (const grp of fig.svg.querySelectorAll(":scope > g")) {
          if (grp.style.display === "none" || grp.getAttribute("fill") === "none" && grp.getAttribute("stroke")) continue;
          for (const el of grp.querySelectorAll("path,circle,ellipse")) {
            if (el.getAttribute("d") === "M0 0") continue;
            let b; try { b = el.getBBox(); } catch (e) { continue; }
            if (!b.width && !b.height) continue;
            const y = b.y + b.height; if (y > low) { low = y; lowEl = el; }
          }
        }
        if (low > GROUND + 1.2) note("floor", `${partName(fig, lowEl)} is drawn ${(low - GROUND).toFixed(1)} below the floor`, t);
        if (low < GROUND - 2.5) note("float", `nothing touches the floor (lowest point ${(GROUND - low).toFixed(1)} above it)`, t);
        // 2. bones longer than in the standing pose (shorter is fine: it can point toward the viewer)
        const j = fig.joints || { shL: q.n, shR: q.n, hpL: q.p, hpR: q.p, le: q.le, re: q.re, lh: q.lh, rh: q.rh, lk: q.lk, rk: q.rk, lf: q.lf, rf: q.rf };
        const b = bones(q, j);
        for (const k in b) for (const L of b[k]) if (L > REF[k] * 1.18) note("bone:" + k, `${k} is ${Math.round((L / REF[k] - 1) * 100)}% longer than when standing`, t);
        // 3. knees bending backwards (side views only)
        if (!front) for (const [h, k, a, side] of [[q.p, q.lk, q.lf, "near"], [q.p, q.rk, q.rf, "far"]]) {
          const bend = kneeBend(h, k, a); if (bend < -12) note("knee:" + side, `${side} knee bends backwards by ${Math.round(-bend)}°`, t);
        }
        // 4. sliding: a hand, knee or foot resting on the floor that moves sideways.
        //    A move that rises or drops at least half as much as it travels is a lift or a landing, not a slide.
        for (const k of ["lh", "rh", "lk", "rk", "lf", "rf"]) {
          const on = q[k][1] > GROUND - 5.5;
          const level = prev && Math.abs(q[k][1] - prev[k][1]) < .5 * Math.abs(q[k][0] - prev[k][0]);
          if (prev && on && prev[k][1] > GROUND - 5.5 && level) { slide[k] = (slide[k] || 0) + Math.abs(q[k][0] - prev[k][0]); if (slide[k] > 2.5) note("slide:" + k, `${({ lh: "near hand", rh: "far hand", lk: "near knee", rk: "far knee", lf: "near foot", rf: "far foot" })[k]} slides ${slide[k].toFixed(1)} along the floor`, t); }
          else if (!on || !level) slide[k] = 0;
        }
        // 5. balance when only the feet carry the weight
        const onFloor = k => q[k][1] > GROUND - 6;
        if (onFloor("lf") || onFloor("rf")) {
          const others = ["lh", "rh", "lk", "rk"].some(onFloor) || q.p[1] > GROUND - 14;
          if (!others) {
            const feet = ["lf", "rf"].filter(onFloor).map(k => q[k][0]);
            const lo = Math.min(...feet) - (front ? 3 : 2.5), hi = Math.max(...feet) + (front ? 3 : 8.5), x = com(q)[0];
            if (x < lo - 1 || x > hi + 1) note("balance", `centre of mass is ${(x < lo ? lo - x : x - hi).toFixed(1)} outside the feet`, t);
          }
        }
        prev = q;
      }
      fig.svg.remove(); fig.destroy();
      out.push({ id: ex.id, name: ex.name, find });
    }
    return out;
  }, { ONLY, GROUND, SAMPLES });

  let open = 0, allowed = 0;
  for (const r of report) {
    const keys = Object.keys(r.find);
    if (!keys.length) { console.log(`ok    ${r.id}`); continue; }
    for (const k of keys) {
      const f = r.find[k], ak = `${r.id}:${k.split(":")[0]}`;
      if (ALLOW[ak] || ALLOW[`${r.id}:${k}`]) { allowed++; console.log(`allow ${r.id}  ${f.msg}  (${ALLOW[ak] || ALLOW[`${r.id}:${k}`]})`); continue; }
      open++; console.log(`FIND  ${r.id}  ${f.msg}  (first at ${f.t}s, ${f.n}/${SAMPLES} samples)`);
    }
  }
  console.log(`\n${report.length} exercises, ${open} findings, ${allowed} allowed`);

  if (SHEET) {
    await page.evaluate(({ ONLY }) => {
      const { Figure, EX } = window.__fig;
      document.body.innerHTML = ""; document.body.style.cssText = "background:#fff;margin:0;display:flex;flex-wrap:wrap;gap:4px;padding:6px";
      for (const ex of EX) {
        if (ONLY && !ONLY.includes(ex.id)) continue;
        const n = ex.frames.length;
        for (let i = 0; i < n; i++) {
          if (i > 0 && JSON.stringify(ex.frames[i]) === JSON.stringify(ex.frames[i - 1])) continue;
          const box = document.createElement("div"); box.style.cssText = "width:150px;height:170px;border:1px solid #ddd;font:10px sans-serif;text-align:center";
          const fg = new Figure(ex, { animate: false }); fg.animate = false; fg.svg.style.cssText = "width:150px;height:150px"; fg.draw(i * ex.dur / n + 1e-6);
          box.appendChild(fg.svg); box.append(`${ex.id} #${i}`); document.body.appendChild(box);
        }
      }
    }, { ONLY });
    await page.screenshot({ path: SHEET, fullPage: true });
    console.log(`picture sheet: ${SHEET}`);
  }
  await browser.close();
  process.exit(open ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
