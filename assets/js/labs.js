/* zhengxs.com — computed figures.
   Four small instruments: a Luneburg ray tracer, a cloak grid, a geodesic
   surface, and a single-photon double slit. All physics is computed live. */
(() => {
  "use strict";

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const TAU = Math.PI * 2;

  function fit(canvas) {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }

  function observe(canvas, cb) {
    if ("ResizeObserver" in window) {
      const ro = new ResizeObserver(() => cb());
      ro.observe(canvas);
    } else {
      window.addEventListener("resize", cb);
    }
  }

  function visibility(el, onChange) {
    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => onChange(e.isIntersecting)),
      { threshold: 0.02 }
    );
    io.observe(el);
  }

  /* ======================================================================
     1. Luneburg lens, hero
     ====================================================================== */
  function initLens() {
    const canvas = document.querySelector("[data-lens]");
    if (!canvas) return;
    const readout = document.querySelector("[data-lens-readout]");
    const hero = canvas.closest(".hero");
    let view = null;
    let rays = [];
    let paths = [];
    let maxOpl = 0;
    let targetTilt = 0;
    let tilt = 0;
    let builtTilt = 99;
    let phase = 0;
    let last = 0;
    let visible = true;
    let running = false;

    const N = 43;
    const H = 0.007;

    function nGrad(x, y) {
      const r2 = x * x + y * y;
      if (r2 >= 1) return [1, 0, 0];
      const n = Math.sqrt(Math.max(2 - r2, 1e-9));
      return [n, -x / n, -y / n];
    }

    function trace(b, th) {
      const ca = Math.cos(th);
      const sa = Math.sin(th);
      let x = -1.4;
      let y = b;
      let vx = ca;
      let vy = sa;
      const pts = [];
      const opl = [];
      let s = 0;
      // phase offset for a tilted incoming plane wave
      let op = -b * sa;
      for (let i = 0; i < 760; i++) {
        const [n1, gx1, gy1] = nGrad(x, y);
        const d1x = (gx1 - (gx1 * vx + gy1 * vy) * vx) / n1;
        const d1y = (gy1 - (gx1 * vx + gy1 * vy) * vy) / n1;

        const x2 = x + H * 0.5 * vx;
        const y2 = y + H * 0.5 * vy;
        const vx2 = vx + H * 0.5 * d1x;
        const vy2 = vy + H * 0.5 * d1y;
        const [n2, gx2, gy2] = nGrad(x2, y2);
        const d2x = (gx2 - (gx2 * vx2 + gy2 * vy2) * vx2) / n2;
        const d2y = (gy2 - (gx2 * vx2 + gy2 * vy2) * vy2) / n2;

        const x3 = x + H * 0.5 * vx2;
        const y3 = y + H * 0.5 * vy2;
        const vx3 = vx + H * 0.5 * d2x;
        const vy3 = vy + H * 0.5 * d2y;
        const [n3, gx3, gy3] = nGrad(x3, y3);
        const d3x = (gx3 - (gx3 * vx3 + gy3 * vy3) * vx3) / n3;
        const d3y = (gy3 - (gx3 * vx3 + gy3 * vy3) * vy3) / n3;

        const x4 = x + H * vx3;
        const y4 = y + H * vy3;
        const vx4 = vx + H * d3x;
        const vy4 = vy + H * d3y;
        const [n4, gx4, gy4] = nGrad(x4, y4);
        const d4x = (gx4 - (gx4 * vx4 + gy4 * vy4) * vx4) / n4;
        const d4y = (gy4 - (gx4 * vx4 + gy4 * vy4) * vy4) / n4;

        const nx = x + (H / 6) * (vx + 2 * vx2 + 2 * vx3 + vx4);
        const ny = y + (H / 6) * (vy + 2 * vy2 + 2 * vy3 + vy4);
        const nvx = vx + (H / 6) * (d1x + 2 * d2x + 2 * d3x + d4x);
        const nvy = vy + (H / 6) * (d1y + 2 * d2y + 2 * d3y + d4y);

        s = Math.hypot(nx - x, ny - y);
        op += s * nGrad(x, y)[0] * 0.5 + s * nGrad(nx, ny)[0] * 0.5;
        x = nx;
        y = ny;
        vx = nvx;
        vy = nvy;
        if (i % 2 === 0) {
          pts.push([x, y]);
          opl.push(op);
        }
        const r = Math.hypot(x, y);
        if (x > 1.46 || r > 2.1 || (i > 10 && Math.abs(x + 1.4) < 0.02 && i > 30)) break;
      }
      return { pts, opl };
    }

    function build(th) {
      rays = [];
      maxOpl = 0;
      for (let i = 0; i < N; i++) {
        const b = -0.9 + (1.8 * i) / (N - 1);
        const ray = trace(b, th);
        if (ray.pts.length > 2) {
          rays.push(ray);
          const lastOpl = ray.opl[ray.opl.length - 1] + b * Math.sin(th);
          if (lastOpl > maxOpl) maxOpl = lastOpl;
        }
      }
      builtTilt = th;
      paths = [];
      const { w, h } = view;
      const mobile = w < 640;
      const R = mobile ? Math.min(w * 0.38, h * 0.26) : Math.min(w * 0.32, h * 0.34);
      const cx = mobile ? w * 0.57 : w * 0.52;
      const cy = mobile ? h * 0.5 : h * 0.49;
      for (const ray of rays) {
        const p = new Path2D();
        ray.pts.forEach(([x, y], idx) => {
          const sx = cx + x * R;
          const sy = cy - y * R;
          if (idx === 0) p.moveTo(sx, sy);
          else p.lineTo(sx, sy);
        });
        paths.push(p);
      }
      view.R = R;
      view.cx = cx;
      view.cy = cy;
    }

    function pointAt(ray, op) {
      const arr = ray.opl;
      if (!arr.length) return null;
      let lo = 0;
      let hi = arr.length - 1;
      if (op <= arr[0]) return ray.pts[0];
      if (op >= arr[hi]) return ray.pts[hi];
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (arr[mid] < op) lo = mid;
        else hi = mid;
      }
      const t = (op - arr[lo]) / (arr[hi] - arr[lo] || 1);
      return [
        lerp(ray.pts[lo][0], ray.pts[hi][0], t),
        lerp(ray.pts[lo][1], ray.pts[hi][1], t),
      ];
    }

    function drawWave() {
      const { ctx, w, h, R, cx, cy } = view;
      if (!rays.length) return;
      const op = phase;
      ctx.globalCompositeOperation = "lighter";
      for (const ray of rays) {
        const offset = ray.pts[0][1] * Math.sin(tilt) * 0 + 0; /* phase offset baked */
        for (let k = 0; k < 3; k++) {
          const target = op - k * 0.055 - offset;
          const p = pointAt(ray, target);
          if (!p) continue;
          const sx = cx + p[0] * R;
          const sy = cy - p[1] * R;
          ctx.beginPath();
          ctx.arc(sx, sy, k === 0 ? 1.5 : 1.1, 0, TAU);
          ctx.fillStyle = `rgba(205,240,255,${0.55 - k * 0.16})`;
          ctx.fill();
        }
      }
      ctx.globalCompositeOperation = "source-over";
    }

    function draw() {
      if (!view) return;
      const { ctx, w, h, R, cx, cy } = view;
      ctx.clearRect(0, 0, w, h);

      // polar measuring grid
      ctx.save();
      ctx.strokeStyle = "rgba(170, 212, 238, 0.09)";
      ctx.lineWidth = 1;
      for (let k = 1; k <= 6; k++) {
        ctx.beginPath();
        ctx.arc(cx, cy, (R * k) / 4, 0, TAU);
        ctx.stroke();
      }
      for (let k = 0; k < 24; k++) {
        const a = (k / 24) * TAU;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * R * 1.5, cy + Math.sin(a) * R * 1.5);
        ctx.lineTo(cx + Math.cos(a) * R * 0.16, cy + Math.sin(a) * R * 0.16);
        ctx.stroke();
      }
      ctx.restore();

      // optical axis
      ctx.save();
      ctx.setLineDash([2, 7]);
      ctx.strokeStyle = "rgba(190, 224, 244, 0.18)";
      ctx.beginPath();
      ctx.moveTo(cx - R * 1.42, cy);
      ctx.lineTo(cx + R * 1.42, cy);
      ctx.stroke();
      ctx.restore();

      // lens body
      const grad = ctx.createRadialGradient(cx, cy, R * 0.05, cx, cy, R);
      grad.addColorStop(0, "rgba(70, 142, 188, 0.16)");
      grad.addColorStop(0.65, "rgba(59, 114, 150, 0.075)");
      grad.addColorStop(1, "rgba(40, 80, 110, 0.02)");
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, TAU);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, TAU);
      ctx.strokeStyle = "rgba(185, 226, 248, 0.5)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.5, 0, TAU);
      ctx.strokeStyle = "rgba(185, 226, 248, 0.14)";
      ctx.stroke();

      // rays
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = "rgba(176, 213, 235, 0.20)";
      ctx.lineWidth = 1;
      for (const p of paths) ctx.stroke(p);
      // a brighter interior pass
      ctx.strokeStyle = "rgba(186, 226, 248, 0.13)";
      for (const p of paths) ctx.stroke(p);
      ctx.restore();

      // focus
      const fx = cx + Math.cos(tilt) * R;
      const fy = cy - Math.sin(tilt) * R;
      const fg = ctx.createRadialGradient(fx, fy, 0, fx, fy, 42);
      fg.addColorStop(0, "rgba(255, 125, 72, 0.8)");
      fg.addColorStop(0.25, "rgba(255, 106, 61, 0.3)");
      fg.addColorStop(1, "rgba(255, 106, 61, 0)");
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.arc(fx, fy, 42, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(fx, fy, 2.1, 0, TAU);
      ctx.fillStyle = "rgba(255, 196, 168, 0.95)";
      ctx.fill();

      // wavefront
      drawWave();

      // rim ticks
      ctx.save();
      ctx.strokeStyle = "rgba(195, 228, 246, 0.3)";
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * TAU;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * R * 1.02, cy + Math.sin(a) * R * 1.02);
        ctx.lineTo(cx + Math.cos(a) * R * 1.045, cy + Math.sin(a) * R * 1.045);
        ctx.stroke();
      }
      ctx.restore();
    }

    function frame(t) {
      if (!visible || !view) {
        running = false;
        return;
      }
      running = true;
      const dt = Math.min(0.05, last ? (t - last) / 1000 : 0.016);
      last = t;
      tilt += (targetTilt - tilt) * 0.055;
      if (Math.abs(tilt - builtTilt) > 0.0035) {
        build(tilt);
        if (readout) {
          const deg = (tilt * 180) / Math.PI;
          readout.textContent = `θ = ${deg >= 0 ? "+" : "−"}${Math.abs(deg).toFixed(1)}°`;
        }
      }
      if (!reduced) {
        phase += dt * 0.62;
        if (phase > maxOpl + 0.4) phase = 0;
      }
      draw();
      if (!reduced) window.requestAnimationFrame(frame);
    }

    function resize() {
      view = fit(canvas);
      build(reduced ? 0 : tilt);
      if (reduced) {
        phase = 0.9;
        draw();
      }
    }

    observe(canvas, resize);
    visibility(canvas, (v) => {
      visible = v;
      if (v && !reduced && !running) {
        last = 0;
        window.requestAnimationFrame(frame);
      }
    });

    if (hero) {
      hero.addEventListener(
        "pointermove",
        (e) => {
          if (e.pointerType !== "mouse") return;
          const rect = hero.getBoundingClientRect();
          const x = (e.clientX - rect.left) / rect.width;
          targetTilt = clamp((x - 0.52) * 0.19, -0.095, 0.095);
        },
        { passive: true }
      );
      hero.addEventListener("pointerleave", () => {
        targetTilt = 0;
      });
    }

    resize();
    if (reduced) {
      phase = 0.9;
      draw();
    } else {
      window.requestAnimationFrame(frame);
    }
  }

  /* ======================================================================
     2. transformation-optics cloak grid
     ====================================================================== */
  function initCloak() {
    const canvas = document.querySelector("[data-cloak]");
    if (!canvas) return;
    const range = document.querySelector("[data-cloak-range]");
    const out = document.querySelector("[data-cloak-readout]");
    let strength = range ? parseFloat(range.value) : 0.72;
    let view = null;
    let pending = false;

    function paint() {
      pending = false;
      if (!view) return;
      const { ctx, w, h } = view;
      ctx.clearRect(0, 0, w, h);
      const cx = w * 0.5;
      const cy = h * 0.5;
      const S = Math.min(w * 0.42, h * 0.42);
      const a = 0.44 * strength;
      const a2 = Math.max(a, 0.0001);

      const map = (x, y) => {
        const r = Math.hypot(x, y);
        if (r >= 1 || a < 0.01) return [x, y, false];
        if (r < 0.008) return [null, null, true];
        const rp = a + (1 - a) * r;
        return [(x / r) * rp, (y / r) * rp, false];
      };

      // subtle field
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, S * 1.35);
      g.addColorStop(0, "rgba(42, 79, 105, 0.28)");
      g.addColorStop(0.6, "rgba(20, 38, 51, 0.16)");
      g.addColorStop(1, "rgba(8, 9, 11, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, w, h);
      ctx.clip();
      const lines = 25;
      for (let i = 0; i < lines; i++) {
        const t = -1.5 + (3 * i) / (lines - 1);
        for (let axis = 0; axis < 2; axis++) {
          let started = false;
          ctx.beginPath();
          for (let j = 0; j <= 280; j++) {
            const u = -1.5 + (3 * j) / 280;
            const x = axis === 0 ? u : t;
            const y = axis === 0 ? t : u;
            const [X, Y, cut] = map(x, y);
            if (cut) {
              started = false;
              continue;
            }
            const sx = cx + X * S;
            const sy = cy - Y * S;
            if (!started) {
              ctx.moveTo(sx, sy);
              started = true;
            } else ctx.lineTo(sx, sy);
          }
          const major = Math.abs(t) < 0.001;
          ctx.strokeStyle = major
            ? "rgba(193, 228, 248, 0.42)"
            : "rgba(193, 228, 248, 0.18)";
          ctx.lineWidth = major ? 1.1 : 0.7;
          ctx.stroke();
        }
      }
      ctx.restore();

      // rings
      ctx.beginPath();
      ctx.arc(cx, cy, S, 0, TAU);
      ctx.strokeStyle = "rgba(193, 228, 248, 0.40)";
      ctx.lineWidth = 1;
      ctx.stroke();
      if (a > 0.02) {
        ctx.beginPath();
        ctx.setLineDash([4, 5]);
        ctx.arc(cx, cy, a * S, 0, TAU);
        ctx.strokeStyle = "rgba(255, 106, 61, 0.9)";
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.beginPath();
      ctx.arc(cx, cy, 2.1, 0, TAU);
      ctx.fillStyle = "rgba(255, 106, 61, 0.95)";
      ctx.fill();

      // edge ticks
      ctx.strokeStyle = "rgba(193, 228, 248, 0.3)";
      for (let k = 0; k < 8; k++) {
        const ang = (k / 8) * TAU;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ang) * S * 1.02, cy + Math.sin(ang) * S * 1.02);
        ctx.lineTo(cx + Math.cos(ang) * S * 1.05, cy + Math.sin(ang) * S * 1.05);
        ctx.stroke();
      }
    }

    function update() {
      if (out) out.textContent = `${Math.round(strength * 100)}%`;
      if (range) range.style.setProperty("--p", `${strength * 100}%`);
      if (!pending) {
        pending = true;
        window.requestAnimationFrame(paint);
      }
    }

    function resize() {
      view = fit(canvas);
      paint();
    }

    observe(canvas, resize);
    if (range) {
      range.addEventListener("input", () => {
        strength = parseFloat(range.value);
        update();
      });
      update();
    }
    const reset = document.querySelector("[data-cloak-reset]");
    if (reset) {
      reset.addEventListener("click", () => {
        strength = 0.72;
        if (range) range.value = "0.72";
        update();
      });
    }
    resize();
  }

  /* ======================================================================
     3. geodesic surface — the Luneburg sphere
     ====================================================================== */
  function initSurface() {
    const canvas = document.querySelector("[data-surface]");
    if (!canvas) return;
    let view = null;
    let yaw = -0.55;
    let pitch = 0.38;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let lastInteract = 0;
    let visible = true;
    let running = false;
    let last = 0;

    const project = (lat, lon, cx, cy, R) => {
      const x = Math.cos(lat) * Math.cos(lon);
      const y = Math.cos(lat) * Math.sin(lon);
      const z = Math.sin(lat);
      const cyaw = Math.cos(yaw);
      const syaw = Math.sin(yaw);
      let X = cyaw * x + syaw * z;
      let Z = -syaw * x + cyaw * z;
      const cp = Math.cos(pitch);
      const sp = Math.sin(pitch);
      const Y = cp * y - sp * Z;
      Z = sp * y + cp * Z;
      return [cx + X * R, cy - Z * R, Y];
    };

    function draw() {
      if (!view) return;
      const { ctx, w, h } = view;
      const cx = w * 0.5;
      const cy = h * 0.5;
      const R = Math.min(w * 0.35, h * 0.42);
      ctx.clearRect(0, 0, w, h);

      const glow = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R * 1.5);
      glow.addColorStop(0, "rgba(30, 69, 95, 0.32)");
      glow.addColorStop(0.6, "rgba(12, 27, 38, 0.16)");
      glow.addColorStop(1, "rgba(8, 9, 11, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      const back = [];
      const front = [];

      const addLine = (pts, color, width, frontA, backA) => {
        let run = [];
        let frontFlag = null;
        const flush = () => {
          if (run.length < 2) return;
          const seg = { pts: run.slice(), front: frontFlag, color, width, frontA, backA };
          (frontFlag ? front : back).push(seg);
          run = [];
        };
        for (const p of pts) {
          const f = p[2] >= 0;
          if (frontFlag === null) frontFlag = f;
          if (f !== frontFlag) {
            flush();
            frontFlag = f;
          }
          run.push(p);
        }
        flush();
      };

      // meridians
      for (let k = 0; k < 18; k++) {
        const lon = (k / 18) * TAU;
        const pts = [];
        for (let i = 0; i <= 64; i++) pts.push(project(-Math.PI / 2 + (Math.PI * i) / 64, lon, cx, cy, R));
        addLine(pts, "191, 224, 244", 0.7, 0.20, 0.055);
      }
      // parallels
      for (let k = 1; k < 10; k++) {
        const lat = -Math.PI / 2 + (Math.PI * k) / 10;
        const pts = [];
        for (let i = 0; i <= 96; i++) pts.push(project(lat, (i / 96) * TAU, cx, cy, R));
        addLine(pts, "191, 224, 244", k === 5 ? 1 : 0.7, k === 5 ? 0.34 : 0.16, 0.045);
      }
      // geodesics as great circles
      for (let k = 0; k < 5; k++) {
        const ang = (Math.PI * k) / 5 + 0.35;
        const pts = [];
        for (let i = 0; i <= 120; i++) {
          const t = (i / 120) * TAU;
          const x = Math.cos(t);
          const y = Math.sin(t) * Math.cos(ang);
          const z = Math.sin(t) * Math.sin(ang);
          const cyaw = Math.cos(yaw);
          const syaw = Math.sin(yaw);
          let X = cyaw * x + syaw * z;
          let Z = -syaw * x + cyaw * z;
          const cp = Math.cos(pitch);
          const sp = Math.sin(pitch);
          const Y = cp * y - sp * Z;
          Z = sp * y + cp * Z;
          pts.push([cx + X * R, cy - Z * R, Y]);
        }
        addLine(pts, "255, 106, 61", 1.15, 0.78, 0.18);
      }

      // rim
      const rim = [];
      for (let i = 0; i <= 160; i++) rim.push(project(0, (i / 160) * TAU, cx, cy, R));
      addLine(rim, "191, 224, 244", 1.2, 0.5, 0.5);

      const paint = (segs) => {
        for (const s of segs) {
          ctx.beginPath();
          s.pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
          ctx.strokeStyle = `rgba(${s.color}, ${s.front ? s.frontA : s.backA})`;
          ctx.lineWidth = s.width;
          ctx.stroke();
        }
      };
      paint(back);
      paint(front);

      // pole
      const pole = project(Math.PI / 2, 0, cx, cy, R);
      ctx.beginPath();
      ctx.arc(pole[0], pole[1], 2.4, 0, TAU);
      ctx.fillStyle = "rgba(255, 106, 61, 0.95)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(pole[0], pole[1], 8, 0, TAU);
      ctx.strokeStyle = "rgba(255, 106, 61, 0.22)";
      ctx.stroke();
    }

    function frame(t) {
      if (!visible) {
        running = false;
        return;
      }
      running = true;
      const dt = Math.min(0.05, last ? (t - last) / 1000 : 0.016);
      last = t;
      if (!dragging && !reduced && t - lastInteract > 2200) yaw += dt * 0.16;
      draw();
      if (!reduced) window.requestAnimationFrame(frame);
    }

    function resize() {
      view = fit(canvas);
      draw();
    }

    observe(canvas, resize);
    visibility(canvas, (v) => {
      visible = v;
      if (v && !reduced && !running) {
        last = 0;
        window.requestAnimationFrame(frame);
      }
    });

    canvas.addEventListener("pointerdown", (e) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      lastInteract = performance.now();
      canvas.setPointerCapture?.(e.pointerId);
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      yaw += (e.clientX - lastX) * 0.008;
      pitch = clamp(pitch - (e.clientY - lastY) * 0.005, -1.05, 1.05);
      lastX = e.clientX;
      lastY = e.clientY;
      lastInteract = performance.now();
      if (reduced) draw();
    });
    const stop = () => {
      dragging = false;
      lastInteract = performance.now();
    };
    canvas.addEventListener("pointerup", stop);
    canvas.addEventListener("pointercancel", stop);

    resize();
    if (reduced) draw();
    else window.requestAnimationFrame(frame);
  }

  /* ======================================================================
     4. single-photon double slit
     ====================================================================== */
  function initPhotons() {
    const canvas = document.querySelector("[data-photons]");
    if (!canvas) return;
    const countEl = document.querySelector("[data-photon-count]");
    const visEl = document.querySelector("[data-photon-vis]");
    const fireBtn = document.querySelector("[data-photon-fire]");
    const resetBtn = document.querySelector("[data-photon-reset]");
    const modeBtn = document.querySelector("[data-photon-mode]");
    const modeLabel = document.querySelector("[data-photon-mode-label]");
    let mode = "fringe";
    let dots = [];
    let queue = 0;
    let view = null;
    let visible = true;
    let running = false;

    const D = 5.6;
    const envelope = (u) => Math.exp(-Math.pow(u / 0.62, 2));
    const fringe = (u) => envelope(u) * Math.pow(Math.cos(Math.PI * D * u), 2);
    const which = (u) =>
      0.5 * Math.exp(-Math.pow((u - 0.18) / 0.15, 2)) +
      0.5 * Math.exp(-Math.pow((u + 0.18) / 0.15, 2));
    const shape = (u) => (mode === "fringe" ? fringe(u) : which(u));

    let maxI = 0;
    for (let i = 0; i < 500; i++) {
      const u = -1 + (2 * i) / 499;
      maxI = Math.max(maxI, shape(u));
    }

    function sampleU() {
      for (let k = 0; k < 40; k++) {
        const u = Math.random() * 2 - 1;
        if (Math.random() * maxI < shape(u)) return u;
      }
      return 0;
    }

    function add(n) {
      for (let i = 0; i < n; i++) {
        if (dots.length > 5200) dots.shift();
        dots.push({
          u: sampleU(),
          jitter: Math.random(),
          a: 0.35 + Math.random() * 0.55,
          r: 0.6 + Math.random() * 1.3,
        });
      }
      updateReadout();
    }

    function updateReadout() {
      if (countEl) countEl.textContent = String(dots.length);
      if (visEl) {
        let mn = 1;
        for (let i = 0; i < 500; i++) {
          const u = -1 + (2 * i) / 499;
          mn = Math.min(mn, shape(u));
        }
        const v = (maxI - mn) / (maxI + mn || 1);
        visEl.textContent = v.toFixed(2);
      }
    }

    function draw() {
      if (!view) return;
      const { ctx, w, h } = view;
      ctx.clearRect(0, 0, w, h);
      const y0 = h * 0.5;
      const top = h * 0.08;
      const bot = h * 0.92;
      const sx = w * 0.08;
      const bx = w * 0.36;
      const screen = w * 0.76;
      const spread = w * 0.16;
      const gap = h * 0.11;

      // source
      const sg = ctx.createRadialGradient(sx, y0, 0, sx, y0, 42);
      sg.addColorStop(0, "rgba(255, 106, 61, 0.45)");
      sg.addColorStop(1, "rgba(255, 106, 61, 0)");
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(sx, y0, 42, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(sx, y0, 3, 0, TAU);
      ctx.fillStyle = "rgba(255, 150, 110, 0.95)";
      ctx.fill();

      // beam cone
      ctx.beginPath();
      ctx.moveTo(sx, y0 - 6);
      ctx.lineTo(bx, y0 - gap / 2);
      ctx.lineTo(bx, y0 + gap / 2);
      ctx.lineTo(sx, y0 + 6);
      ctx.closePath();
      ctx.fillStyle = "rgba(190, 228, 248, 0.035)";
      ctx.fill();

      // barrier
      ctx.fillStyle = "rgba(205, 230, 245, 0.5)";
      ctx.fillRect(bx - 1, top, 2, y0 - gap / 2 - top);
      ctx.fillRect(bx - 1, y0 + gap / 2, 2, bot - (y0 + gap / 2));
      // slit sparkle
      for (const yy of [y0 - gap / 2, y0 + gap / 2]) {
        ctx.beginPath();
        ctx.arc(bx, yy, 2.2, 0, TAU);
        ctx.fillStyle = "rgba(255, 150, 110, 0.9)";
        ctx.fill();
      }

      // wavefronts near the slits
      for (const yy of [y0 - gap / 2, y0 + gap / 2]) {
        for (let k = 1; k <= 6; k++) {
          ctx.beginPath();
          ctx.arc(bx, yy, k * w * 0.032, -Math.PI / 2.4, Math.PI / 2.4);
          ctx.strokeStyle = `rgba(125, 220, 246, ${0.10 - k * 0.012})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }

      // screen
      ctx.fillStyle = "rgba(205, 230, 245, 0.18)";
      ctx.fillRect(screen - 1, top, 2, bot - top);

      // theory curve
      ctx.beginPath();
      for (let i = 0; i <= 360; i++) {
        const u = -1 + (2 * i) / 360;
        const I = shape(u) / maxI;
        const x = screen + I * spread;
        const y = y0 - u * (bot - top) * 0.46;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = mode === "fringe" ? "rgba(255, 106, 61, 0.75)" : "rgba(255, 106, 61, 0.55)";
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // photons
      for (const d of dots) {
        const y = y0 - d.u * (bot - top) * 0.46;
        const x = screen + 8 + d.jitter * spread * 0.72;
        ctx.beginPath();
        ctx.arc(x, y, d.r, 0, TAU);
        ctx.fillStyle = `rgba(212, 238, 250, ${d.a})`;
        ctx.fill();
      }

      // axis ticks
      ctx.strokeStyle = "rgba(205, 230, 245, 0.2)";
      for (let k = -4; k <= 4; k++) {
        const y = y0 - (k / 4) * (bot - top) * 0.46;
        ctx.beginPath();
        ctx.moveTo(screen - 4, y);
        ctx.lineTo(screen + 4, y);
        ctx.stroke();
      }
    }

    function frame() {
      if (!visible) {
        running = false;
        return;
      }
      running = true;
      if (queue > 0) {
        const n = Math.min(queue, 18);
        add(n);
        queue -= n;
      }
      draw();
      if (queue > 0) window.requestAnimationFrame(frame);
      else running = false;
    }

    function resize() {
      view = fit(canvas);
      draw();
    }

    function fill(n) {
      queue += n;
      if (!running) window.requestAnimationFrame(frame);
    }

    observe(canvas, resize);
    visibility(canvas, (v) => {
      visible = v;
      if (v && !running) window.requestAnimationFrame(frame);
    });

    if (fireBtn) fireBtn.addEventListener("click", () => fill(500));
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        dots = [];
        queue = 0;
        updateReadout();
        draw();
      });
    }
    if (modeBtn) {
      modeBtn.addEventListener("click", () => {
        mode = mode === "fringe" ? "which" : "fringe";
        if (modeLabel) modeLabel.textContent = mode === "fringe" ? "OFF" : "ON";
        dots = [];
        queue = 0;
        maxI = 0;
        for (let i = 0; i < 500; i++) {
          const u = -1 + (2 * i) / 499;
          maxI = Math.max(maxI, shape(u));
        }
        updateReadout();
        fill(reduced ? 900 : 650);
        draw();
      });
    }

    resize();
    updateReadout();
    fill(reduced ? 900 : 600);
    if (reduced) {
      add(900);
      queue = 0;
      draw();
    }
  }

  /* ------------------------------------------------------------------ boot */
  const boot = () => {
    initLens();
    initCloak();
    initSurface();
    initPhotons();
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
