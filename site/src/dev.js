// ============================================================================
// development tools: only in dev.html (npm run build:dev), never in index.html
// ============================================================================
//   F    fly the camera along the scripted path (FLY in main.js), one minute through the whole world
//   B    the same flight as a benchmark: the resolution stays fixed, every frame is timed, the result is shown at the end
//   F, B or 1-6 during a flight stop it
{
  const LOGN = 1 << 16, logFrame = new Float32Array(LOGN), logGpu = new Float32Array(LOGN);
  let flying = false, bench = false, last = 0, nFrame = 0, nGpu = 0;
  const stop = () => { flying = bench = false; dynT = 0; };
  const report = () => {
    const st = (a, n) => { const s = Array.from(a.subarray(0, n)).sort((x, y) => x - y); let sum = 0; for (const v of s) sum += v; return { n, avg: sum / n, p99: s[min(n - 1, floor(n * 0.99))], max: s[n - 1] }; };
    const fm = (o) => `avg ${o.avg.toFixed(2)}  p99 ${o.p99.toFixed(2)}  max ${o.max.toFixed(2)} ms`;
    const f = st(logFrame, nFrame);
    info.textContent = `Fly-through ${W}x${H}, ${f.n} frames\nframe  ${fm(f)}\nGPU    ${nGpu ? fm(st(logGpu, nGpu)) : 'timestamp-query unavailable'}`;
  };
  // frame() moves the free camera and then calls render(): step in between and put the camera on the path instead
  const draw = render;
  render = () => {
    if (flying) {
      const dtr = F[LAST] - last; last = F[LAST];
      F[FLT] += min(dtr / 1000, 0.1); flyAt();
      if (bench) { if (nFrame < LOGN) logFrame[nFrame++] = dtr; if (F[GPU] > 0 && nGpu < LOGN) logGpu[nGpu++] = F[GPU]; }
      if (F[FLT] >= FLYT) { if (bench) report(); stop(); }
    }
    draw();
  };
  addEventListener('keydown', (e) => {
    if (menu || e.repeat) return;
    if (e.code === 'KeyF' || e.code === 'KeyB') {
      if (flying) stop();
      else {
        flying = true; bench = e.code === 'KeyB'; F[FLT] = 0; last = F[LAST]; nFrame = nGpu = 0;
        // a benchmark hides the stats line and holds the resolution: dynT at -Infinity keeps frame() from tuning it
        if (bench) { hud = false; info.textContent = ''; dynT = -Infinity; }
      }
    } else if (/Digit[1-6]/.test(e.code)) stop();
  });
  // FG STUDIO: 給自動化驗證用的入口（從瀏覽器的主控台讀狀態、轉鏡頭、開啟物件），只在 dev.html 裡
  window.dev = { F, lookAt, activate, pick, closeWin, visit, SPAWN, COMP, COMPS, CH, LAY, P0,
    // 站在出生點，從進站的方向往右轉 a（弧度），抬頭 p
    turn: (a, p = -0.12) => { const [x, z] = around(a, 10); lookAt(P0[0], P0[1], P0[2], x, P0[1] + 10 * Math.tan(p), z); F[VX] = F[VY] = F[VZ] = 0; },
    // 每個物件：從出生點看過去的直線上有沒有岩石擋住
    seen: () => BOXES.map((B) => { const o = B.o, ty = o.y + 0.8, dx = o.x - P0[0], dy = ty - P0[1], dz = o.z - P0[2], l = hypot(dx, dy, dz); for (let t = 0.6; t < l - 0.8; t += 0.3) if (rock(P0[0] + dx / l * t, P0[1] + dy / l * t, P0[2] + dz / l * t) > 0) return false; return true; }),
    state: () => ({ hot, win, front, menu, opened: [...opened], chFrac: [...chFrac], chLevel: [...chLevel], W, H }) };
}
