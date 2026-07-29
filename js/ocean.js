/* ============================================================
    DEEPDREAMS — LIVING OCEAN BACKGROUND
    A real-time deep-sea scene painted on a single full-screen
    canvas, fixed behind the content layer.

      · Volumetric light fans (god rays) from the surface,
        dimming as the sunlight dies with depth.
      · A small school of colourful fish, boids-lite flocking,
        homing to the upper-right lit water. Touch / pointer-down
        scatters them (flee force + panic); as the panic decays the
        school steers home and decelerates gently on arrival.
      · Marine snow — three parallax layers, scroll-streaked for
        the sell of "water streaming past you."
      · Glowing bioluminescent jellyfish that surface at the
        bottom of the page, each on its own slow schedule.

    Scroll = descent. The scene is fed `oceanScroll(y)` from
    app.js (piped through Lenis so the dive is smoothed), and the
    whole column eases toward its target depth: the corner light
    dims, the god rays recede, the school dives below the screen,
    the abyss darkens, and the jellyfish bloom.

    Time-stepped against wall-clock dt (not frame count), so the
    physics read identically on any refresh rate. Pauses when the
    tab is hidden. Skipped for reduced-motion (one static frame).
    ============================================================ */
function initOcean() {
  const canvas = document.getElementById("ocean");
  if (!canvas) {
    console.error("Ocean canvas #ocean not found!");
    return;
  }

  const REDUCED = matchMedia("(prefers-reduced-motion:reduce)").matches;
  const MOBILE  = matchMedia("(max-width:767px)").matches;
  const ctx = canvas.getContext("2d", { alpha: true });
  const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  let W = 0, H = 0;

  function resize() {
    W = innerWidth; H = innerHeight;
    canvas.width  = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width  = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    /* invalidate cached gradients so they rebuild at new size */
    rays.forEach(r => { r.grad = null; });
    fish.forEach(f => { f.grad = null; });
    jellies.forEach(j => { j.halo = null; j.bell = null; });
  }

  const rnd  = (a, b) => a + Math.random() * (b - a);
  const TAU  = Math.PI * 2;
  const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;

  /* ---------- descent state, fed by scroll ----------
     depthT : 0 = surface → 1 = abyss          (eased into curDepth)
     liftT  : scroll progress, drives the school's home Y so the
              school dives below the screen as you scroll down   */
  let depthT = 0, curDepth = 0;
  let liftT  = 0, curLift  = 0;
  let stir   = 1, stirT    = 1;          /* current from your motion */
  let shift  = 0;                        /* raw scroll delta, spent
                                            over the next frames     */
  let lastY = 0, lastMs = performance.now();

  window.oceanScroll = y => {
    const max = document.documentElement.scrollHeight - innerHeight;
    const p   = max > 0 ? Math.min(Math.max(y / max, 0), 1) : 0;
    depthT = clamp((p - 0.04) / 0.78, 0, 1);
    liftT  = p;
    const dy  = y - lastY;
    shift += dy;
    const now = performance.now(), dt = Math.max(now - lastMs, 1);
    stirT = Math.min(1 + Math.abs(dy) / dt * 1.7, 2.4);
    lastY = y; lastMs = now;
  };
  window.oceanResize = resize;

  /* ---------- touch / click: the school darts away ----------
     A pointer-down inside the fright radius applies an outward
     flee force on each fish (proximity-weighted) and raises its
     panic. As panic decays the seek behaviour re-dominates and
     the fish steer home. */
  const startle = (px, py) => {
    const R = Math.min(W, H) * 0.42;
    fish.forEach(f => {
      const dx = f.x - px, dy = f.y - py, d = Math.hypot(dx, dy);
      if (d < R && d > 0.5) {
        const proximity = 1 - d / R;
        /* flee impulse — a dart, not a bullet */
        const force = proximity * 3.6;
        f.vx += (dx / d) * force;
        f.vy += (dy / d) * force;
        f.panic = Math.max(f.panic, 0.5 + proximity * 0.4);
      } else {
        f.panic = Math.max(f.panic, 0.18);  /* the rest flinch gently */
      }
    });
  };
  addEventListener("pointerdown", e => startle(e.clientX, e.clientY), { passive: true });

  /* ---------- god rays — fanning down-left from the surface light ---------- */
  const RAY_N = MOBILE ? 4 : 7;
  const rays = Array.from({ length: RAY_N }, (_, i) => ({
    angle : (108 + i * (46 / RAY_N) + rnd(-3, 3)) * Math.PI / 180,
    width : rnd(0.05, 0.10),
    swayF : rnd(0.05, 0.12), swayP : rnd(0, TAU),
    pulseF: rnd(0.07, 0.16), pulseP: rnd(0, TAU),
    alpha : rnd(0.05, 0.10),
    grad  : null
  }));

  /* ---------- marine snow ---------- */
  const SNOW_N = MOBILE ? 26 : 60;
  const snow = Array.from({ length: SNOW_N }, () => ({
    x: rnd(0, 1), y: rnd(0, 1), z: rnd(0.25, 1),
    vy: rnd(0.00012, 0.00042), swayF: rnd(0.2, 0.7), swayP: rnd(0, TAU), r: rnd(0.7, 2.1)
  }));

  /* ---------- the school — small, colourful, alive ---------- */
  const PALETTE = [
    ["#FF9A5C", "#FFD9A8"],  /* coral orange  */
    ["#E8C56A", "#FFF0C4"],  /* studio gold    */
    ["#4FD1C5", "#BFF5EE"],  /* teal           */
    ["#6BB6FF", "#CDE6FF"],  /* glint blue     */
    ["#FF8FA3", "#FFD6DE"]   /* soft coral     */
  ];
  const FISH_N = MOBILE ? 6 : 9;
  const fish = Array.from({ length: FISH_N }, (_, i) => ({
    x: 0, y: 0, vx: rnd(-0.3, 0.3), vy: rnd(-0.2, 0.2),
    len    : rnd(13, 24) * (MOBILE ? 0.82 : 1),
    depth  : rnd(0.55, 1),
    body   : PALETTE[i % PALETTE.length][0],
    belly  : PALETTE[i % PALETTE.length][1],
    tailP  : rnd(0, TAU), tailF: rnd(5, 7.5),
    w1: rnd(0.14, 0.30), w2: rnd(0.05, 0.12),
    p1: rnd(0, TAU),     p2: rnd(0, TAU),
    placed: false, grad: null, panic: 0
  }));

  /* the school gathers in the lit water, upper right.
     scroll down carries its home DOWN past the bottom of the
     screen — the fish visibly dive — and back up again when you
     return. `t` is declared before this is ever called.        */
  const anchor = (t) => ({
    x: W * (MOBILE ? 0.72 : 0.80) + Math.sin(t * 0.050) * W * 0.05,
    y: H * (MOBILE ? 0.16 : 0.21) + Math.cos(t * 0.038) * H * 0.04 + curLift * H * 1.05
  });

  function drawFish(f, t) {
    const a = Math.atan2(f.vy, f.vx);
    /* diving away: fish recede — smaller & dimmer with depth */
    const recede = 1 - curDepth * 0.45;
    const s = Math.max(2, f.len * f.depth * recede);

    ctx.save();
    ctx.translate(f.x, f.y);

    /* bioluminescence: as sunlight dies each fish carries its own
       soft halo, brighter the deeper you go */
    if (curDepth > 0.18) {
      const glow = (curDepth - 0.18) / 0.82;
      const gr = Math.max(4, s * (2.6 + Math.sin(t * 1.7 + f.tailP) * 0.35));
      const gg = ctx.createRadialGradient(0, 0, 0, 0, 0, gr);
      gg.addColorStop(0,    `rgba(140,220,255,${(0.22 * glow).toFixed(3)})`);
      gg.addColorStop(0.55, `rgba(90,167,255,${(0.09  * glow).toFixed(3)})`);
      gg.addColorStop(1,    "rgba(90,167,255,0)");
      ctx.fillStyle = gg;
      ctx.beginPath(); ctx.arc(0, 0, gr, 0, TAU); ctx.fill();
    }

    ctx.rotate(a);
    if (Math.cos(a) < 0) ctx.scale(1, -1);
    /* dim with depth but never vanish — their glow keeps them alive */
    ctx.globalAlpha = (0.5 + f.depth * 0.42) * (1 - curDepth * 0.34);

    /* panic = faster tail beat */
    const wag = Math.sin(t * f.tailF * (1 + f.panic * 1.3) + f.tailP) * 0.55;

    /* tail fin */
    ctx.save();
    ctx.translate(-s * 0.48, 0);
    ctx.rotate(wag * 0.6);
    ctx.fillStyle = f.body;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-s * 0.34, -s * 0.20);
    ctx.quadraticCurveTo(-s * 0.22, 0, -s * 0.34, s * 0.20);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    /* body — two-tone gradient, belly lighter (cached per fish & size) */
    if (!f.grad) {
      const g = ctx.createLinearGradient(0, -s * 0.18, 0, s * 0.18);
      g.addColorStop(0,    f.body);
      g.addColorStop(0.62, f.body);
      g.addColorStop(1,    f.belly);
      f.grad = g;
    }
    ctx.fillStyle = f.grad;
    ctx.beginPath();
    ctx.moveTo(s * 0.52, 0);
    ctx.quadraticCurveTo(s * 0.18, -s * 0.30, -s * 0.30, -s * 0.12);
    ctx.quadraticCurveTo(-s * 0.50, 0, -s * 0.30, s * 0.12);
    ctx.quadraticCurveTo(s * 0.18, s * 0.30, s * 0.52, 0);
    ctx.closePath();
    ctx.fill();

    /* pectoral fin */
    ctx.save();
    ctx.translate(s * 0.05, s * 0.10);
    ctx.rotate(0.5 + wag * 0.3);
    ctx.fillStyle = f.belly;
    ctx.globalAlpha *= 0.8;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-s * 0.16, s * 0.12);
    ctx.quadraticCurveTo(-s * 0.04, s * 0.14, 0.02, 0);
    ctx.closePath(); ctx.fill();
    ctx.restore();

    /* eye */
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.beginPath(); ctx.arc(s * 0.34, -s * 0.05, s * 0.052, 0, TAU); ctx.fill();
    ctx.fillStyle = "#0A0F1C";
    ctx.beginPath(); ctx.arc(s * 0.35, -s * 0.05, s * 0.028, 0, TAU); ctx.fill();

    ctx.restore();
  }

  /* ---------- jellyfish — the deep's own light ----------
     Absent from the top half of the site entirely. Past 50% scroll they
     start rising out of the bottom edge, each on its own slow schedule, and
     the whole school is up and lit by 75%. Scroll back up within that half
     and they do NOT fade away — they simply stop swimming, sink to the
     bottom edge and hold station there, glowing, until the 50% gate closes
     over them. See J_GATE / J_RAMP below. */
  const JELLY_N = MOBILE ? 3 : 5;
  const JELLY_TINTS = [
    [150, 210, 255],  /* ice blue    */
    [190, 160, 255],  /* violet      */
    [140, 235, 220],  /* aqua-green  */
    [255, 170, 200],  /* rose        */
    [170, 190, 255]   /* periwinkle  */
  ];

  /* --- jellyfish physics, normalized to viewport height, per 60fps step ---
     A jellyfish swims by jet propulsion: the bell contracts, forces water
     out of the cavity and drives a thrust burst; the bell then relaxes and
     the animal glides, sinking slowly because it is a shade heavier than
     seawater. At their scale water is thick, so drag is heavy and every
     motion is smooth and over-damped — no twitching, no linear sliding.
     Thrust is taken from the CONTRACTION RATE of the bell, which is why the
     bob is locked to the visible squeeze instead of floating free of it. */
  const J_DRAG    = 0.940;   /* per-step velocity retention (viscosity)      */
  const J_SPRING  = 0.0022;  /* buoyant station-keeping toward home depth    */
  const J_SINK    = 0.00005; /* slight negative buoyancy during the glide    */
  const J_THRUST  = 0.00016; /* peak jet thrust at full bell contraction     */
  const J_XDRAG   = 0.955;   /* lateral viscosity                            */
  const J_XSPRING = 0.0011;  /* the lane it slowly drifts back toward        */

  /* --- where in the page they are allowed to exist ---
     Nothing at the top of the site. The first jelly begins to rise out of the
     bottom edge at 50% scroll, the last begins at 63%, and each takes J_RAMP
     (12%) of the page to surface — so the whole school is fully up and fully
     lit by 75%. J_GATE is a hard floor applied on top of the arrival ratchet:
     above it on the page they are simply not drawn, so returning to the top
     always leaves a clean ocean no matter how far down the visitor has been. */
  const J_GATE  = 0.50;   /* hard cut-off: no jellyfish exist before this      */
  const J_FADE  = 0.06;   /* the scroll band the gate closes over              */
  const J_RAMP  = 0.12;   /* scroll distance from a jelly's entry to surfaced  */
  const smooth = (x) => x * x * (3 - 2 * x);

  const jellies = Array.from({ length: JELLY_N }, (_, i) => ({
    fx     : rnd(0.12, 0.88),                /* lane across the screen */
    baseY  : rnd(0.55, 0.82),               /* risen station, in view */
    park   : rnd(0.94, 1.03),               /* resting station at the bottom edge */
    /* staggered across 50% → 63% of the page; +J_RAMP lands the last at 75% */
    entry  : J_GATE + i * (0.13 / Math.max(JELLY_N - 1, 1)),
    r      : rnd(28, 44) * (MOBILE ? 0.85 : 1),
    tent   : 6 + (i % 3),
    tint   : JELLY_TINTS[i % JELLY_TINTS.length],
    pulseF : rnd(0.75, 1.15), pulseP: rnd(0, TAU),
    swayF  : rnd(0.12, 0.20), swayP: rnd(0, TAU),
    driftF : rnd(0.08, 0.14), driftP: rnd(0, TAU),
    vis    : 0.0,   /* arrival, one-way: only ever climbs inside the band */
    gate   : 0.0,   /* 0 above the 50% line, 1 below it */
    alpha  : 0.0,   /* what actually gets drawn: vis * gate */
    rise   : 0.0,   /* 0 = parked at the bottom, 1 = fully surfaced */
    y      : 0, vy : 0,      /* normalized depth + velocity (fraction of H) */
    lane   : 0, vx : 0,      /* normalized lane  + velocity (fraction of W) */
    tilt   : 0,              /* banks into its own drift */
    seeded : false,
    halo   : null, bell: null
  }));

  /* Integrate one jelly. Kept separate from drawing so the motion is a
     real simulation with its own state, not a function of the clock. */
  function stepJelly(j, dt) {
    if (!j.seeded) { j.y = j.park; j.lane = j.fx; j.seeded = true; }

    /* Home depth follows TRUE scroll progress (curLift: 0 top → 1 bottom).
       Past this jelly's entry point it climbs to its in-view station; scroll
       back up and home returns to the bottom edge, so the jelly swims down
       and waits there rather than dissolving. */
    j.rise = clamp((curLift - j.entry) / J_RAMP, 0, 1);
    const homeY = j.park + (j.baseY - j.park) * smooth(j.rise);

    /* Arrival ratchets upward only — a jelly brightens as it surfaces and then
       never dims again on its own. Scroll back up inside the band and it sinks
       to the bottom edge and waits there, still glowing, instead of dissolving.
       The gate is the one thing that can take it away: it closes over the 6%
       of page just above the 50% line, so the top half of the site is always
       empty water however far down the visitor has already been. */
    const target = clamp((curLift - j.entry) / J_RAMP, 0, 1);
    if (target > j.vis) j.vis += (target - j.vis) * 0.06 * dt;

    j.gate  = smooth(clamp((curLift - (J_GATE - J_FADE)) / J_FADE, 0, 1));
    j.alpha = j.vis * j.gate;
    if (j.alpha < 0.02) return;

    /* jet propulsion: thrust only while the bell is squeezing shut */
    const phase = t * j.pulseF * TAU + j.pulseP;
    j.contract = Math.max(0, -Math.cos(phase));

    /* vertical: thrust up, weight down, buoyant spring toward station */
    const ay = (homeY - j.y) * J_SPRING + J_SINK - J_THRUST * j.contract;
    j.vy = (j.vy + ay * dt) * Math.pow(J_DRAG, dt);
    j.y += j.vy * dt;

    /* lateral: the slow current pushes, the lane gently pulls back */
    const current = Math.sin(t * j.swayF * TAU + j.swayP) * 0.00030
                  + Math.sin(t * j.swayF * TAU * 1.7 + j.swayP) * 0.00012
                  + Math.sin(t * j.driftF * TAU + j.driftP) * 0.00016;
    const ax = current + (j.fx - j.lane) * J_XSPRING;
    j.vx = (j.vx + ax * dt) * Math.pow(J_XDRAG, dt);
    j.lane += j.vx * dt;

    /* it banks into the direction it is drifting */
    const tiltTarget = clamp(j.vx * 26, -0.30, 0.30);
    j.tilt += (tiltTarget - j.tilt) * Math.min(0.05 * dt, 1);

    /* soft walls: it can settle at the bottom edge but never sink out of
       the world, and never climb into the surface light */
    const floor = j.park + 0.05;
    if (j.y > floor) { j.y = floor; if (j.vy > 0) j.vy *= 0.40; }
    if (j.y < 0.12)  { j.y = 0.12; if (j.vy < 0) j.vy *= 0.40; }
  }

  function drawJelly(j, t) {
    if (j.alpha < 0.02) return;

    const pulse = Math.sin(t * j.pulseF * TAU + j.pulseP);
    const bellW = Math.max(4, j.r * (1    + pulse * 0.16));
    const bellH = Math.max(4, j.r * (0.82 - pulse * 0.18));

    const x = j.lane * W;
    const y = j.y * H;

    const [R, G, B] = j.tint;
    /* parked in the deep reads dimmer than risen and near — but never gone */
    const a = j.alpha * (0.70 + j.rise * 0.30) * (0.62 + curDepth * 0.33);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(j.tilt);

    /* halo */
    const hr = Math.max(6, bellW * 3.1 + pulse * 4);
    const hg = ctx.createRadialGradient(0, 0, 0, 0, 0, hr);
    hg.addColorStop(0,   `rgba(${R},${G},${B},${(a * 0.35).toFixed(3)})`);
    hg.addColorStop(0.6, `rgba(${R},${G},${B},${(a * 0.10).toFixed(3)})`);
    hg.addColorStop(1,   `rgba(${R},${G},${B},0)`);
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.arc(0, 0, hr, 0, TAU); ctx.fill();

    /* tentacles — they trail the bell. Swimming up streams them straight
       and long behind it; hovering lets them go slack and curl. */
    const stream = clamp(-j.vy * 45, -0.20, 0.80);
    const slack  = 1 - clamp(stream, 0, 1) * 0.7;
    ctx.lineWidth = 1.1;
    for (let k = 0; k < j.tent; k++) {
      const off = (k / (j.tent - 1) - 0.5) * bellW * 1.5;
      const len = bellH * (2.6 + (k % 2) * 0.9) * (1 + stream);
      ctx.strokeStyle = `rgba(${R},${G},${B},${(a * 0.5).toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(off, bellH * 0.35);
      const seg = 4;
      for (let m = 1; m <= seg; m++) {
        const p = m / seg;
        ctx.lineTo(
          off + Math.sin(t * 1.3 + k * 1.7 + p * 3.2) * 6 * p * slack,
          bellH * 0.35 + len * p
        );
      }
      ctx.stroke();
    }

    /* bell — translucent dome, brighter rim */
    const bg = ctx.createRadialGradient(0, -bellH * 0.25, 0, 0, 0, bellW * 1.15);
    bg.addColorStop(0,   `rgba(${Math.min(R+50,255)},${Math.min(G+40,255)},${Math.min(B+30,255)},${(a * 0.8).toFixed(3)})`);
    bg.addColorStop(0.7, `rgba(${R},${G},${B},${(a * 0.45).toFixed(3)})`);
    bg.addColorStop(1,   `rgba(${R},${G},${B},${(a * 0.12).toFixed(3)})`);
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.ellipse(0, 0, bellW, bellH, 0, Math.PI, 0);
    ctx.quadraticCurveTo( bellW * 0.80, bellH * 0.50,  bellW * 0.45, bellH * 0.42);
    ctx.quadraticCurveTo( 0,            bellH * 0.18, -bellW * 0.45, bellH * 0.42);
    ctx.quadraticCurveTo(-bellW * 0.80, bellH * 0.50, -bellW,        0);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  /* ---------- the frame ----------
     Diagnostic sentinel: a per-frame counter written to the canvas's
     data-fc attribute so the page can be probed for "is the loop
     actually running" without any evaluate() side effects.          */
  let fcCount = 0;
  const FC_SENT = document.getElementById("ocean");

  let t = 0, last = performance.now(), running = true, rayDrift = 0;
  /* revolution governs overall speed; reduced-motion quiets it.   */
  let revolution = 1;
  /* rafId tracks the pending frame so the visibility handler can
     safely resume without double-arming the loop.                    */
  let rafId = null, toId = null;
  /* Hybrid driver: rAF when the browser gives it to us (best timing,
     paused on tab-hidden)}, but a setTimeout watchdog arms in parallel
     so a throttled / cancelled rAF (common in embedded webviews) cannot
     freeze the ocean. Whichever fires first drives the frame; the loser
     is a no-op and we re-arm from the winner. */
  const arm = () => {
    if (rafId == null) rafId = requestAnimationFrame(frame);
    if (toId  == null) toId  = setTimeout(frame, 16);
  };
  const cancelArm = () => {
    if (rafId != null) cancelAnimationFrame(rafId);
    if (toId  != null) clearTimeout(toId);
    rafId = null; toId = null;
  };

  function paintStaticFrame() {
    /* a single, gentle frame for reduced-motion users */
    curDepth = depthT; curLift = liftT; stir = 1;
    frame(performance.now(), true);
  }

  function frame(now, single) {
    if (!running && !single) return;
    /* now may be undefined when setTimeout drives the frame; rAF passes
       a high-resolution timestamp but lacks it.                         */
    if (now == null) now = performance.now();
    const dt = Math.min((now - last) / 16.7, 3);
    last = now;

    /* water inertia: everything eases toward its target */
    curDepth += (depthT - curDepth) * 0.045;
    curLift  += (liftT  - curLift ) * 0.090;   /* home follows scroll briskly */
    stirT    += (1 - stirT) * 0.04;            /* the current dies down */
    stir     += (stirT - stir) * 0.12;
    t += dt * 0.016 * stir * revolution;

    /* spend the pending scroll delta this frame — the water column
       streams past you 1:1 with your scroll */
    const spent = shift * 0.22;                 /* eased, but immediate */
    shift -= spent;
    const flowSnow = spent * 0.90;              /* nearest layer: fastest */
    const flowFish = spent * 0.55;              /* the school, mid-water  */
    const flowRays = spent * 0.28;              /* the light, far above   */
    rayDrift += flowRays;

    ctx.clearRect(0, 0, W, H);

    const A = anchor(t);
    const light = 1 - curDepth * 0.80;          /* sunlight dies with depth */

    /* --- depth wash: surface blue → abyss near-black --- */
    const surfR = 0.10 + curDepth * 0.42, surfG = 0.30 - curDepth * 0.18, surfB = 0.50 - curDepth * 0.22;
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0,   `rgba(${30 + curDepth*4|0},${79 - curDepth*30|0},${127 - curDepth*60|0},${0.55 - curDepth*0.45})`);
    bg.addColorStop(0.5, `rgba(${Math.round(7 + surfR*40)},${Math.round(12 + surfG*40)},${Math.round(24 + surfB*60)},0.0)`);
    bg.addColorStop(1,   `rgba(1,3,10,${0.50 + curDepth * 0.35})`);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    /* --- corner glow: the surface light source --- */
    const gl = ctx.createRadialGradient(W * 0.9, -H * 0.08, 0, W * 0.9, -H * 0.08, H * 0.75);
    const breathe = (0.8 + Math.sin(t * 0.5) * 0.2) * light;
    gl.addColorStop(0,    `rgba(140,195,255,${(0.16 * breathe).toFixed(3)})`);
    gl.addColorStop(0.45, `rgba(90,150,230,${(0.06 * breathe).toFixed(3)})`);
    gl.addColorStop(1,    "rgba(90,150,230,0)");
    ctx.fillStyle = gl;
    ctx.fillRect(0, 0, W, H);

    /* --- god rays (gradients cached per size; pulse via globalAlpha) --- */
    ctx.globalCompositeOperation = "lighter";
    rayDrift *= 0.995;                            /* rays live far away — barely release */
    const ox = W * 0.92, oy = -H * 0.06 - Math.max(rayDrift, 0) * 0.40, L = H * 1.5;
    const sizeKey = W * 100000 + H;
    rays.forEach(r => {
      if (!r.grad) {
        const g = ctx.createLinearGradient(ox, oy, ox + Math.cos(r.angle) * L, oy + Math.sin(r.angle) * L);
        g.addColorStop(0,    `rgba(150,200,255,${r.alpha})`);
        g.addColorStop(0.55, `rgba(120,175,245,${(r.alpha * 0.45).toFixed(3)})`);
        g.addColorStop(1,    "rgba(120,175,245,0)");
        r.grad = g;
      }
      const sway = Math.sin(t * r.swayF * TAU + r.swayP) * 0.035;
      const a1 = r.angle + sway - r.width / 2;
      const a2 = r.angle + sway + r.width / 2;
      ctx.globalAlpha = (0.55 + 0.45 * Math.sin(t * r.pulseF * TAU + r.pulseP)) * light;
      ctx.fillStyle = r.grad;
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox + Math.cos(a1) * L, oy + Math.sin(a1) * L);
      ctx.lineTo(ox + Math.cos(a2) * L, oy + Math.sin(a2) * L);
      ctx.closePath();
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    /* --- marine snow — streams past you 1:1 with your scroll ---
        this nearest layer moving fastest is what sells the descent */
    snow.forEach(p => {
      p.y += p.vy * dt * 16.7 * p.z * stir;
      p.y -= flowSnow * p.z / H;                 /* your dive, per particle */
      p.y = ((p.y % 1.04) + 1.04) % 1.04;        /* wrap both directions */
      const x = p.x * W + Math.sin(t * p.swayF + p.swayP) * 14 * p.z;
      const y = p.y * H;
      /* scroll speed stretches the flakes into streaks — motion blur */
      const streak = Math.min(Math.abs(spent) * p.z * 0.8, 26);
      ctx.globalAlpha = (0.10 + p.z * 0.22) * (1 - curDepth * 0.3);
      ctx.fillStyle = "#CFE2FF";
      if (streak > 2.5) {
        ctx.beginPath();
        ctx.ellipse(x, y, Math.max(0.5, p.r * p.z * 0.8), p.r * p.z + streak / 2, 0, 0, TAU);
        ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, p.r * p.z), 0, TAU); ctx.fill();
      }
    });
    ctx.globalAlpha = 1;

    /* --- the school: wander around the anchor, gently separated.
        scroll pushes every fish DOWN with the water (mid-water
        parallax); they recede (smaller, dimmer) the deeper you go.
        Boids-lite: seek(anchor) + separate(neighbours) + wander. --- */
    fish.forEach((f, i) => {
      if (!f.placed) { f.x = A.x + rnd(-80, 80); f.y = A.y + rnd(-50, 50); f.placed = true; }
      /* scrolling DOWN carries their bodies down with the water at once;
         scrolling UP never drags them — they swim home themselves, so
         returning fish always rise up from below, the way you came  */
      if (flowFish > 0) f.y += flowFish * (0.5 + f.depth * 0.3);

      const tx = A.x + Math.sin(t * f.w1 + f.p1) * W * 0.075 * f.depth
                    + Math.sin(t * f.w2 + f.p2) * 26;
      const ty = A.y + Math.cos(t * f.w1 * 0.8 + f.p2) * H * 0.055 * f.depth
                    + Math.cos(t * f.w2 * 1.3  + f.p1) * 18;

      /* panic decays; while panicked, homing weakens (they flee first) */
      f.panic *= Math.pow(0.985, dt);
      /* urgency grows with distance from home — far away they cruise
         back in ~2s, decelerating gently as the distance closes    */
      const distHome = Math.hypot(tx - f.x, ty - f.y);
      const urgency  = Math.min(distHome / (H * 0.5), 1);
      const home      = (0.0011 + urgency * 0.0035) * (1 - Math.min(f.panic, 0.85));
      f.vx += (tx - f.x) * home * dt;
      f.vy += (ty - f.y) * home * dt;

      /* separation: short-range repulsion keeps them off each other */
      for (let k = i + 1; k < fish.length; k++) {
        const o = fish[k], dx = f.x - o.x, dy = f.y - o.y, d2 = dx * dx + dy * dy;
        if (d2 < 500 && d2 > 0.01) {
          const push = 0.014 / Math.sqrt(d2) * dt;
          f.vx += dx * push; f.vy += dy * push;
          o.vx -= dx * push; o.vy -= dy * push;
        }
      }

      /* clamp speed: min so they never freeze, max scaled by urgency+panic */
      const sp = Math.hypot(f.vx, f.vy);
      const maxSp = (1.15 + urgency * 3.4) * f.depth * stir + f.panic * 2.2;
      const minSp = 0.18;
      if (sp > maxSp)      { f.vx *= maxSp / sp; f.vy *= maxSp / sp; }
      else if (sp < minSp && sp > 0) { f.vx *= minSp / sp; f.vy *= minSp / sp; }

      f.x += f.vx * dt * 1.6 * (stir + f.panic * 0.7);
      f.y += f.vy * dt * 1.6 * (stir + f.panic * 0.7);
      drawFish(f, t);
    });

    /* --- bioluminescent jellyfish: simulated, then drawn. They rise from
           the deep near the bottom of the page and, on the way back up,
           sink to the bottom edge and hold there instead of fading out. --- */
    jellies.forEach(j => { stepJelly(j, dt); drawJelly(j, t); });

    /* diagnostic: bump the frame counter (read-only from outside) */
    if (FC_SENT) FC_SENT.setAttribute("data-fc", String(++fcCount));

    if (single) return;          /* reduced-motion: one painted frame */
    cancelArm();
    if (running) arm();
  }

  /* ---------- lifecycle ---------- */
  resize();
  addEventListener("resize", resize);

  /* Seed the descent with the current scroll so the scene starts in
     the right depth even on a full page-reload at partway down.    */
  window.oceanScroll(window.scrollY || 0);

  if (REDUCED) {
    /* Even reduced-motion users still get a LIVE ocean — just calmer.
       A single painted frame reads as "static / broken" to visitors
       (exactly the bug we're avoiding), so we keep the loop alive but
       slow the time base to a quiet drift.                            */
    revolution = 0.15;
  }

  arm();                                  /* start the loop */

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { running = false; cancelArm(); }
    else if (!running)  { running = true; last = performance.now(); arm(); }
  });

  console.log("🌊 Living Ocean Canvas & Glowing Jellyfish active!");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => { try { initOcean(); } catch(e){ console.error("Ocean init failed:", e); } });
} else {
  try { initOcean(); } catch(e){ console.error("Ocean init failed:", e); }
}
