(() => {
  // ---------------- Safe DOM helpers ----------------
  const $ = (id) => document.getElementById(id);
  const must = (id) => {
    const el = $(id);
    if (!el) console.warn(`[Missing DOM id] #${id}`);
    return el;
  };
  const on = (el, evt, fn, opts) => { if (el) el.addEventListener(evt, fn, opts); };

  // ---------------- DOM ----------------
  const canvas = must("gameCanvas");
  const ctx = canvas.getContext("2d");

  const menu = must("menu");
  const playBtn = must("playBtn");
  const homeBtn = must("homeBtn");
  const hud = must("hud");
  const overlayEl = must("overlayText");

  const modeSelect = must("modeSelect");
  const p1NameInput = must("p1Name");
  const p2NameInput = must("p2Name");
  const p2NameWrap = must("p2NameWrap");
  const diffWrap = must("diffWrap");
  const difficultySelect = must("difficulty");
  const matchTimeSelect = must("matchTime");

  const hudP1 = must("hudP1");
  const hudP2 = must("hudP2");
  const scoreText = must("scoreText");
  const modeText = must("modeText");
  const diffText = must("diffText");
  const timeText = must("timeText");

  const resultModal = must("resultModal");
  const resultTitle = must("resultTitle");
  const resultScore = must("resultScore");
  const resultLine = must("resultLine");
  const againBtn = must("againBtn");
  const homeBtn2 = must("homeBtn2");

  const mobileControls = must("mobileControls");
  const joy1Base = must("joy1Base");
  const joy1Knob = must("joy1Knob");
  const joy2Wrap = must("joy2Wrap");
  const joy2Base = must("joy2Base");
  const joy2Knob = must("joy2Knob");

  const W = canvas.width;
  const H = canvas.height;

  // Overlay must NOT block clicks
  if (overlayEl) overlayEl.style.pointerEvents = "none";

  // ---------------- Inject CSS for penalty dots (optional) ----------------
  (function injectPenaltyCSS(){
    const css = `
      .penHudLine{ width:100%; display:none; margin-top:8px; }
      .penRow{
        display:flex; align-items:center; justify-content:center; gap:10px;
        padding:6px 10px;
        border-radius:999px;
        background: rgba(0,0,0,.22);
        border: 1px solid rgba(255,255,255,.10);
        backdrop-filter: blur(6px);
        font-size:12px;
        opacity:.98;
      }
      .penName{ font-weight:900; letter-spacing:.5px; opacity:.95; }
      .dots{ display:flex; gap:6px; align-items:center; }
      .dot{
        width:10px; height:10px; border-radius:999px;
        border:1px solid rgba(255,255,255,.22);
        background: rgba(255,255,255,.12);
        box-shadow: 0 4px 10px rgba(0,0,0,.22);
      }
      .dot.goal{ background: rgba(57,212,122,.95); border-color: rgba(57,212,122,.95); }
      .dot.miss{ background: rgba(255,45,45,.90); border-color: rgba(255,45,45,.90); }
      .dot.pending{ background: rgba(255,255,255,.12); border-color: rgba(255,255,255,.18); }
      .dot.extra{ width:8px; height:8px; opacity:.9; }
      .penLabel{ opacity:.85; white-space:nowrap; }
    `;
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
  })();

  // ---------------- Difficulty configs (NERF GK) ----------------
  // Portieri NON OP:
  // - meno velocità
  // - più errori
  // - dive meno frequente
  // - reaction umana
  // - rigori più “50/50”
  const DIFF = {
    easy: {
      botSpeed: 2.9, botKick: 9.5,  error: 0.30, predict: 0.18,
      gkBaseSpeed: 2.7, gkReact: 0.18, gkMistake: 0.22, gkDiveAggro: 0.55, penWrong: 0.43
    },
    medium: {
      botSpeed: 4.8, botKick: 12.2, error: 0.14, predict: 0.28,
      gkBaseSpeed: 3.2, gkReact: 0.14, gkMistake: 0.16, gkDiveAggro: 0.63, penWrong: 0.33
    },
    hard: {
      botSpeed: 6.6, botKick: 14.3, error: 0.05, predict: 0.38,
      gkBaseSpeed: 3.85, gkReact: 0.12, gkMistake: 0.11, gkDiveAggro: 0.74, penWrong: 0.22
    },
  };

  // ---------------- Sizes ----------------
  const PLAYER_R = 26;
  const GOALIE_R = 18;         // richiesto
  const BALL_R   = 11;

  // ---------------- Field / goal ----------------
  const goalHalf = 128;        // leggermente più grande per segnare meglio
  const postR = 10;
  const goalL = { x: 0, y1: H/2-goalHalf, y2: H/2+goalHalf, posts: [{x:0,y:H/2-goalHalf},{x:0,y:H/2+goalHalf}] };
  const goalR = { x: W, y1: H/2-goalHalf, y2: H/2+goalHalf, posts: [{x:W,y:H/2-goalHalf},{x:W,y:H/2+goalHalf}] };

  const boxH = 270, boxW = 135;
  const boxL = { x: 0, y: H/2 - boxH/2, w: boxW, h: boxH };
  const boxR = { x: W - boxW, y: H/2 - boxH/2, w: boxW, h: boxH };

  // ---------------- Trick shot walls boost ----------------
  const WALL_TRICK_BOOST = 1.14;
  const MAX_BALL_SPEED = 24.0;
  const BOUNCE_CD = 0.10;

  // ---------------- Dive tuning (NERF) ----------------
  const DIVE_TIME = 0.16;
  const DIVE_COOLDOWN_MIN = 0.85;
  const DIVE_COOLDOWN_MAX = 1.45;
  const DIVE_BURST = 1.45;      // più basso = meno OP
  const DIVE_RECOVERY = 0.13;   // dopo tuffo: micro “stun” così può sbagliare

  // ---------------- Game state ----------------
  let running = false;
  let pausedByMenu = true;
  let inCountdown = false;
  let countdownTimer = null;

  let gameMode = "bot";
  let difficulty = "medium";
  let matchSeconds = 90;
  let remaining = 90;

  let scoreLeft = 0;
  let scoreRight = 0;

  // ---------------- Penalties ----------------
  const pen = {
    active: false,
    shotsPerSide: 5,
    leftTaken: 0, rightTaken: 0,
    leftGoals: 0, rightGoals: 0,
    leftSeq: [], rightSeq: [],
    turn: "left",
    shotLive: false,
    shotTimer: 0,
    uiLock: 0,
  };

  // ---------------- Entities ----------------
  const P1 = { name:"P1", x:240, y:H/2, r:PLAYER_R, speed:5.35, color:"#1a66ff", lastDirX:1, lastDirY:0 };
  const P2 = { name:"P2", x:W-240, y:H/2, r:PLAYER_R, speed:5.35, color:"#ff9f1a", lastDirX:-1, lastDirY:0 };

  const GK_L = makeGoalie(true, "#25e6ff");
  const GK_R = makeGoalie(false,"#ff2d2d");

  const ball = { x:W/2, y:H/2, r:BALL_R, vx:0, vy:0, trail:[], bounceCd:0 };

  function makeGoalie(isLeft, color){
    return {
      isLeft,
      x: isLeft ? 84 : W-84,
      y: H/2,
      r: GOALIE_R,
      color,
      mistakeT: 0,
      reactT: 0,
      diveT: 0,
      diveCd: 0,
      diveY: H/2,
      recoveryT: 0,
      diveTrail: [],
      ai: {
        speedMul: 1,
        reactMul: 1,
        mistakeMul: 1,
        slack: 1,
        aggro: 1,
        penWrong: 0.33,
        penCommit: 0.62,
        style: 0, // - safe, + aggressive
      },
      pen: { planY:null, planX:null, react:0, committed:false },
    };
  }

  // ---------------- Utils ----------------
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const dist = (ax,ay,bx,by)=>Math.hypot(bx-ax,by-ay);
  const lerp = (a,b,t)=>a + (b-a)*t;
  const rand = (a,b)=>a + Math.random()*(b-a);

  function setOverlay(text, on=true){
    if (!overlayEl) return;
    overlayEl.textContent = text;
    overlayEl.style.opacity = on ? 1 : 0;
  }
  function setScoreUI(){ if (scoreText) scoreText.textContent = `${scoreLeft} - ${scoreRight}`; }
  function setTimeUI(){
    if (!timeText) return;
    if (pen.active) { timeText.textContent = "PENALTIES"; return; }
    const m = Math.floor(remaining / 60);
    const s = Math.floor(remaining % 60);
    timeText.textContent = `TIME ${m}:${String(s).padStart(2,"0")}`;
  }

  function getBallSpeed(){ return Math.hypot(ball.vx, ball.vy); }
  function clampBallSpeed(){
    const s = getBallSpeed();
    if (s > MAX_BALL_SPEED) {
      const k = MAX_BALL_SPEED / (s || 1);
      ball.vx *= k; ball.vy *= k;
    }
  }

  // ---------------- INPUT ----------------
  const keys = Object.create(null);

  window.addEventListener("keydown", (e) => {
    const k = e.key;
    if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," "].includes(k)) e.preventDefault();
  }, { passive: false });

  document.addEventListener("keydown", (e) => { keys[e.key.toLowerCase()] = true; });
  document.addEventListener("keyup",   (e) => { keys[e.key.toLowerCase()] = false; });

  // ---------------- Mobile joystick ----------------
  const joy = {
    p1: { active:false, id:null, vx:0, vy:0, cx:0, cy:0 },
    p2: { active:false, id:null, vx:0, vy:0, cx:0, cy:0 },
  };

  function setKnob(knob, vx, vy) {
    const max = 40;
    knob.style.transform = `translate(calc(-50% + ${vx*max}px), calc(-50% + ${vy*max}px))`;
  }

  function bindJoystick(base, knob, stateKey) {
    const st = joy[stateKey];
    if (!base || !knob) return;

    base.addEventListener("pointerdown", (e) => {
      st.active = true; st.id = e.pointerId;
      base.setPointerCapture(e.pointerId);
      const r = base.getBoundingClientRect();
      st.cx = r.left + r.width/2; st.cy = r.top + r.height/2;
      move(e);
    });
    base.addEventListener("pointermove", move);
    base.addEventListener("pointerup", end);
    base.addEventListener("pointercancel", end);

    function move(e){
      if (!st.active || st.id !== e.pointerId) return;
      const dx = e.clientX - st.cx;
      const dy = e.clientY - st.cy;
      const d = Math.hypot(dx,dy) || 1;
      const maxD = 55;
      const nd = Math.min(d, maxD);
      st.vx = (dx/d) * (nd/maxD);
      st.vy = (dy/d) * (nd/maxD);
      setKnob(knob, st.vx, st.vy);
    }
    function end(e){
      if (st.id !== e.pointerId) return;
      st.active = false; st.id = null; st.vx = 0; st.vy = 0;
      setKnob(knob, 0, 0);
    }
  }

  bindJoystick(joy1Base, joy1Knob, "p1");
  bindJoystick(joy2Base, joy2Knob, "p2");

  const isTouchDevice = () => ("ontouchstart" in window || navigator.maxTouchPoints > 0);

  // ---------------- Penalty HUD ----------------
  let penHudWrap, penRowL, penRowR, penDotsL, penDotsR;
  function ensurePenaltyHud(){
    if (penHudWrap || !hud) return;
    const midBox = hud.querySelector(".hudBox.mid");
    if (!midBox) return;

    penHudWrap = document.createElement("div");
    penHudWrap.className = "penHudLine";

    penRowL = document.createElement("div"); penRowL.className = "penRow";
    penRowR = document.createElement("div"); penRowR.className = "penRow"; penRowR.style.marginTop = "6px";

    const nameL = document.createElement("span"); nameL.className = "penName"; nameL.id = "penNameL";
    const nameR = document.createElement("span"); nameR.className = "penName"; nameR.id = "penNameR";

    const label1 = document.createElement("span"); label1.className = "penLabel"; label1.textContent = "PEN";
    const label2 = document.createElement("span"); label2.className = "penLabel"; label2.textContent = "PEN";

    penDotsL = document.createElement("div"); penDotsL.className = "dots"; penDotsL.id = "penDotsL";
    penDotsR = document.createElement("div"); penDotsR.className = "dots"; penDotsR.id = "penDotsR";

    penRowL.appendChild(nameL); penRowL.appendChild(penDotsL); penRowL.appendChild(label1);
    penRowR.appendChild(nameR); penRowR.appendChild(penDotsR); penRowR.appendChild(label2);

    penHudWrap.appendChild(penRowL);
    penHudWrap.appendChild(penRowR);
    midBox.appendChild(penHudWrap);
  }
  function mkDot(state, extra=false){
    const s = document.createElement("span");
    s.className = "dot " + (state === "goal" ? "goal" : state === "miss" ? "miss" : "pending");
    if (extra) s.classList.add("extra");
    return s;
  }
  function renderPenaltyDots(){
    ensurePenaltyHud();
    if (!penHudWrap) return;

    if (!pen.active) { penHudWrap.style.display = "none"; return; }
    penHudWrap.style.display = "block";

    const nameL = penRowL.querySelector("#penNameL");
    const nameR = penRowR.querySelector("#penNameR");
    if (nameL) nameL.textContent = (P1.name || "P1").toUpperCase();
    if (nameR) nameR.textContent = (P2.name || "P2").toUpperCase();

    penDotsL.innerHTML = "";
    penDotsR.innerHTML = "";

    const base = pen.shotsPerSide;
    const extraCount = Math.max(0, Math.max(pen.leftSeq.length, pen.rightSeq.length) - base);

    for (let i=0;i<base;i++){
      const v = pen.leftSeq[i];
      penDotsL.appendChild(mkDot(v===true?"goal":v===false?"miss":"pending"));
    }
    for (let i=0;i<extraCount;i++){
      const v = pen.leftSeq[base+i];
      penDotsL.appendChild(mkDot(v===true?"goal":v===false?"miss":"pending", true));
    }

    for (let i=0;i<base;i++){
      const v = pen.rightSeq[i];
      penDotsR.appendChild(mkDot(v===true?"goal":v===false?"miss":"pending"));
    }
    for (let i=0;i<extraCount;i++){
      const v = pen.rightSeq[base+i];
      penDotsR.appendChild(mkDot(v===true?"goal":v===false?"miss":"pending", true));
    }
  }

  // ---------------- Bounds ----------------
  function goalieBounds(gk){
    const b = gk.isLeft ? boxL : boxR;
    return {
      minX: b.x + gk.r + 6,
      maxX: b.x + b.w - gk.r - 6,
      minY: b.y + gk.r + 6,
      maxY: b.y + b.h - gk.r - 6,
    };
  }

  // ---------------- Goalies brains (different) ----------------
  function initGoalieBrains(){
    const cfg = DIFF[difficulty] || DIFF.medium;

    function roll(gk){
      const style = rand(-1, 1); // - safe, + aggressive

      // Nerf: range più umana
      const speedMul   = rand(0.88, 1.06);
      const reactMul   = rand(0.92, 1.18);
      const mistakeMul = rand(0.95, 1.40);
      const slack      = rand(1.05, 1.55);
      const aggro      = rand(0.90, 1.10) * (1 + 0.08*Math.max(0, style));

      const penWrong   = clamp(cfg.penWrong * rand(0.90, 1.25) * (1 + 0.10*Math.max(0, style)), 0.10, 0.55);
      const penCommit  = clamp(0.58 + 0.10*style + rand(-0.10, 0.10), 0.40, 0.80);

      gk.ai.speedMul = speedMul;
      gk.ai.reactMul = reactMul;
      gk.ai.mistakeMul = mistakeMul;
      gk.ai.slack = slack;
      gk.ai.aggro = aggro;
      gk.ai.penWrong = penWrong;
      gk.ai.penCommit = penCommit;
      gk.ai.style = style;
    }

    roll(GK_L);
    roll(GK_R);
    if (Math.abs(GK_L.ai.style - GK_R.ai.style) < 0.25) GK_R.ai.style += (Math.random()<0.5?-1:1)*0.33;
  }

  // ---------------- Reset ----------------
  function resetGoalieState(gk){
    gk.mistakeT = 0;
    gk.reactT = 0;
    gk.diveT = 0;
    gk.diveCd = 0;
    gk.diveY = H/2;
    gk.recoveryT = 0;
    gk.diveTrail = [];
    gk.pen.planX = gk.pen.planY = null;
    gk.pen.react = 0;
    gk.pen.committed = false;
  }

  function resetRound(){
    P1.x=240; P1.y=H/2;
    P2.x=W-240; P2.y=H/2;

    GK_L.x = 84; GK_L.y = H/2;
    GK_R.x = W-84; GK_R.y = H/2;

    resetGoalieState(GK_L);
    resetGoalieState(GK_R);

    ball.x=W/2; ball.y=H/2;
    ball.vx=0; ball.vy=0;
    ball.trail=[];
    ball.bounceCd=0;
  }

  // ---------------- Collisions ----------------
  function resolveBallCircle(circle, kickStrength){
    const dx = ball.x - circle.x;
    const dy = ball.y - circle.y;
    const d  = Math.hypot(dx,dy);
    const minD = ball.r + circle.r;
    if (d === 0 || d >= minD) return false;

    const nx = dx/d, ny = dy/d;
    const overlap = minD - d;
    ball.x += nx * overlap;
    ball.y += ny * overlap;

    const cur = getBallSpeed();
    const s = kickStrength + cur * 0.16; // leggermente meno “sparata infinita”
    ball.vx = nx * s;
    ball.vy = ny * s;

    clampBallSpeed();
    return true;
  }

  function resolvePost(p){
    const dx = ball.x - p.x;
    const dy = ball.y - p.y;
    const d  = Math.hypot(dx,dy);
    const minD = ball.r + postR;
    if (d === 0 || d >= minD) return false;

    const nx = dx/d, ny = dy/d;
    const overlap = minD - d;
    ball.x += nx * overlap;
    ball.y += ny * overlap;

    const vn = ball.vx*nx + ball.vy*ny;
    ball.vx = ball.vx - 2*vn*nx;
    ball.vy = ball.vy - 2*vn*ny;

    ball.vx *= 0.96;
    ball.vy *= 0.96;

    clampBallSpeed();
    return true;
  }

  function applyWallTrickBoost(){
    if (ball.bounceCd > 0) return;
    const s = getBallSpeed();
    const ns = Math.min(MAX_BALL_SPEED, s * WALL_TRICK_BOOST);
    const k = ns / (s || 1);
    ball.vx *= k; ball.vy *= k;
    ball.bounceCd = BOUNCE_CD;
  }

  function ballWalls(){
    let bounced = false;

    if (ball.y - ball.r < 0) { ball.y = ball.r; ball.vy = Math.abs(ball.vy)*0.98; bounced = true; }
    if (ball.y + ball.r > H) { ball.y = H - ball.r; ball.vy = -Math.abs(ball.vy)*0.98; bounced = true; }

    if (ball.x - ball.r < 0) {
      const inMouth = (ball.y >= goalL.y1 && ball.y <= goalL.y2);
      if (!inMouth) { ball.x = ball.r; ball.vx = Math.abs(ball.vx)*0.98; bounced = true; }
    }
    if (ball.x + ball.r > W) {
      const inMouth = (ball.y >= goalR.y1 && ball.y <= goalR.y2);
      if (!inMouth) { ball.x = W - ball.r; ball.vx = -Math.abs(ball.vx)*0.98; bounced = true; }
    }

    if (bounced) applyWallTrickBoost();
    clampBallSpeed();
  }

  // ---------------- Countdown ----------------
  function startCountdown(sec){
    if (countdownTimer) clearInterval(countdownTimer);
    inCountdown = true;

    let t = sec;
    setOverlay(String(t), true);

    countdownTimer = setInterval(() => {
      t--;
      if (t > 0) setOverlay(String(t), true);
      else if (t === 0) setOverlay("GO!", true);
      else {
        clearInterval(countdownTimer);
        countdownTimer = null;
        inCountdown = false;
        setOverlay("", false);
      }
    }, 900);
  }

  // ---------------- Drawing ----------------
  function drawField(){
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle = "#23b75f";
    ctx.fillRect(0,0,W,H);

    ctx.strokeStyle = "white";
    ctx.lineWidth = 4;

    ctx.strokeRect(0,0,W,H);
    ctx.beginPath(); ctx.moveTo(W/2,0); ctx.lineTo(W/2,H); ctx.stroke();
    ctx.beginPath(); ctx.arc(W/2,H/2,70,0,Math.PI*2); ctx.stroke();

    ctx.strokeRect(boxL.x, boxL.y, boxL.w, boxL.h);
    ctx.strokeRect(boxR.x, boxR.y, boxR.w, boxR.h);

    drawGoalFrame(goalL, true);
    drawGoalFrame(goalR, false);

    ctx.fillStyle="white";
    for(const p of goalL.posts){ ctx.beginPath(); ctx.arc(p.x,p.y,postR,0,Math.PI*2); ctx.fill(); }
    for(const p of goalR.posts){ ctx.beginPath(); ctx.arc(p.x,p.y,postR,0,Math.PI*2); ctx.fill(); }
  }

  function drawGoalFrame(g,isLeft){
    const depth = 28;
    const x1 = g.x;
    const x2 = isLeft ? x1 - depth : x1 + depth;
    ctx.beginPath();
    ctx.moveTo(x1,g.y1);
    ctx.lineTo(x2,g.y1);
    ctx.lineTo(x2,g.y2);
    ctx.lineTo(x1,g.y2);
    ctx.stroke();
  }

  function hexToRgb(hex){
    if (!hex || typeof hex !== "string") return null;
    const h = hex.trim();
    if (!/^#([0-9a-fA-F]{6})$/.test(h)) return null;
    return { r: parseInt(h.slice(1,3),16), g: parseInt(h.slice(3,5),16), b: parseInt(h.slice(5,7),16) };
  }

  function drawBallTrail(){
    for(let i=0;i<ball.trail.length;i++){
      const t = ball.trail[i];
      const a = i/ball.trail.length;
      const alpha = 0.06 + a*0.55;
      ctx.beginPath();
      ctx.arc(t.x,t.y,4,0,Math.PI*2);
      ctx.fillStyle = `rgba(255,255,255,${alpha*0.55})`;
      ctx.fill();
    }
  }

  function drawGoalieDiveTrail(gk){
    if (!gk.diveTrail.length) return;
    const rgb = hexToRgb(gk.color) || {r:255,g:255,b:255};

    for (let i=0;i<gk.diveTrail.length;i++){
      const p = gk.diveTrail[i];
      const a = i / gk.diveTrail.length;
      const alpha = 0.05 + a * 0.60;

      ctx.beginPath();
      ctx.arc(p.x, p.y, 6 + a*6, 0, Math.PI*2);
      ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha*0.35})`;
      ctx.fill();
    }
  }

  function drawCircle(x,y,r,color){
    ctx.beginPath();
    ctx.arc(x,y,r,0,Math.PI*2);
    ctx.fillStyle=color;
    ctx.fill();
  }

  function drawEntities(){
    drawGoalieDiveTrail(GK_L);
    drawGoalieDiveTrail(GK_R);

    drawCircle(P1.x,P1.y,P1.r,P1.color);
    drawCircle(P2.x,P2.y,P2.r,P2.color);
    drawCircle(GK_L.x,GK_L.y,GK_L.r,GK_L.color);
    drawCircle(GK_R.x,GK_R.y,GK_R.r,GK_R.color);
    drawCircle(ball.x,ball.y,ball.r,"white");
  }

  // ---------------- Player input ----------------
  function getP1Input(){
    let mx=0,my=0;
    if (keys["w"]) my -= 1;
    if (keys["s"]) my += 1;
    if (keys["a"]) mx -= 1;
    if (keys["d"]) mx += 1;
    mx += joy.p1.vx; my += joy.p1.vy;
    const m = Math.hypot(mx,my);
    if (m > 1e-6) { mx/=m; my/=m; }
    return {mx,my};
  }

  function getP2Input(){
    let mx=0,my=0;
    if (keys["arrowup"]) my -= 1;
    if (keys["arrowdown"]) my += 1;
    if (keys["arrowleft"]) mx -= 1;
    if (keys["arrowright"]) mx += 1;
    mx += joy.p2.vx; my += joy.p2.vy;
    const m = Math.hypot(mx,my);
    if (m > 1e-6) { mx/=m; my/=m; }
    return {mx,my};
  }

  function rememberDirs(p, mx, my) {
    if (Math.abs(mx) + Math.abs(my) > 0.001) { p.lastDirX = mx; p.lastDirY = my; }
  }

  // ---------------- Goalie logic (NERF + HUMAN) ----------------
  function predictBallYAtX(targetX){
    if (Math.abs(ball.vx) < 0.0001) return ball.y;
    const t = (targetX - ball.x) / ball.vx;
    if (t < 0) return ball.y;
    return ball.y + ball.vy * t;
  }

  function startDive(gk, yTarget){
    const b = goalieBounds(gk);
    gk.diveT = DIVE_TIME;
    gk.diveCd = rand(DIVE_COOLDOWN_MIN, DIVE_COOLDOWN_MAX);
    gk.diveY = clamp(yTarget, b.minY, b.maxY);
    gk.recoveryT = DIVE_RECOVERY;

    // stripe
    gk.diveTrail.push({x:gk.x, y:gk.y});
    if (gk.diveTrail.length > 24) gk.diveTrail.shift();
  }

  function updateDiveStripe(gk){
    if (gk.diveT > 0) {
      gk.diveTrail.push({x:gk.x, y:gk.y});
      if (gk.diveTrail.length > 26) gk.diveTrail.shift();
    } else {
      // fade out
      if (gk.diveTrail.length && Math.random() < 0.30) gk.diveTrail.shift();
    }
  }

  function maybeHumanTimers(dt, cfg, gk){
    gk.mistakeT = Math.max(0, gk.mistakeT - dt);
    gk.reactT   = Math.max(0, gk.reactT   - dt);
    gk.recoveryT= Math.max(0, gk.recoveryT- dt);

    const mChance = cfg.gkMistake * gk.ai.mistakeMul;
    const rChance = cfg.gkReact   * gk.ai.reactMul;

    if (!inCountdown && !pen.active) {
      if (gk.mistakeT <= 0 && Math.random() < mChance * dt) gk.mistakeT = 0.34 + Math.random()*0.30;
      if (gk.reactT   <= 0 && Math.random() < rChance * dt) gk.reactT   = 0.10 + Math.random()*0.16;
    }
  }

  function shouldDive(gk, cfg){
    const s = getBallSpeed();
    if (s < 5.2) return false;
    const toward = gk.isLeft ? (ball.vx < -1.2) : (ball.vx > 1.2);
    if (!toward) return false;
    const near = gk.isLeft ? (ball.x < W*0.42) : (ball.x > W*0.58);
    if (!near) return false;
    if (gk.diveCd > 0 || gk.diveT > 0) return false;

    const goalX = gk.isLeft ? 0 : W;
    const py = predictBallYAtX(goalX);
    const inMouth = (py >= (H/2 - goalHalf - 25) && py <= (H/2 + goalHalf + 25));

    // nerf: chance più bassa
    const base = 0.10 + 0.12*(cfg.gkDiveAggro - 0.55);
    const styleBoost = 0.05*Math.max(0, gk.ai.style);
    const mouthBoost = inMouth ? 0.06 : 0.0;

    const chance = clamp((base + styleBoost + mouthBoost) * gk.ai.aggro, 0.07, 0.26);
    return Math.random() < chance;
  }

  function updateGoalie(dt, cfg, gk){
    const b = goalieBounds(gk);
    gk.diveCd = Math.max(0, gk.diveCd - dt);
    gk.diveT  = Math.max(0, gk.diveT  - dt);

    maybeHumanTimers(dt, cfg, gk);

    // if reacting late: freeze (human)
    if (gk.reactT > 0) {
      updateDiveStripe(gk);
      return;
    }

    // if just finished diving: small recovery makes mistakes possible
    const speedFactor = (gk.recoveryT > 0) ? 0.72 : 1.0;

    const goalX = gk.isLeft ? 0 : W;
    const toward = gk.isLeft ? (ball.vx < -0.5) : (ball.vx > 0.5);
    const veryToward = gk.isLeft ? (ball.vx < -1.1) : (ball.vx > 1.1);

    let tx = gk.isLeft ? (b.minX + 20) : (b.maxX - 20);
    let ty = H/2;

    if (toward) {
      let predY = predictBallYAtX(goalX);
      predY = clamp(predY, b.minY, b.maxY);

      // nerf: non segue perfetto, mix con palla e "bias" verso centro
      const follow = 0.32;
      ty = lerp(predY, clamp(ball.y, b.minY, b.maxY), follow);
      ty = lerp(H/2, ty, 0.78);
    } else {
      ty = lerp(H/2, clamp(ball.y, b.minY, b.maxY), 0.16);
    }

    // mistakes
    if (gk.mistakeT > 0) {
      ty = clamp(ty + (Math.random()-0.5) * (85 * gk.ai.slack), b.minY, b.maxY);
    }

    // decide dive
    if (veryToward && shouldDive(gk, cfg)) {
      let diveY = ty;

      // human wrong dive offset sometimes
      if (Math.random() < (0.14 * gk.ai.mistakeMul)) {
        diveY = clamp(diveY + (Math.random()<0.5?-1:1) * (55 + Math.random()*65), b.minY, b.maxY);
      }
      startDive(gk, diveY);
    }

    // movement
    const baseS = cfg.gkBaseSpeed * gk.ai.speedMul * speedFactor;

    if (gk.diveT > 0) {
      const s = baseS * DIVE_BURST;

      // additional “over/under” on dive to feel human
      const wobble = (Math.random()-0.5) * 10;
      const targetY = clamp(gk.diveY + wobble, b.minY, b.maxY);

      gk.y += clamp(targetY - gk.y, -s, s);
      const xHome = gk.isLeft ? (b.minX + 20) : (b.maxX - 20);
      gk.x += clamp(xHome - gk.x, -s*0.45, s*0.45);
    } else {
      gk.x += clamp(tx - gk.x, -baseS, baseS);
      gk.y += clamp(ty - gk.y, -baseS, baseS);
    }

    gk.x = clamp(gk.x, b.minX, b.maxX);
    gk.y = clamp(gk.y, b.minY, b.maxY);

    updateDiveStripe(gk);
  }

  function updateGoalkeepers(dt){
    if (pen.active) return;
    const cfg = DIFF[difficulty] || DIFF.medium;
    updateGoalie(dt, cfg, GK_L);
    updateGoalie(dt, cfg, GK_R);
  }

  // ---------------- Bot player AI ----------------
  function updateBot(dt){
    const cfg = DIFF[difficulty] || DIFF.medium;

    const t = cfg.predict;
    const px = ball.x + ball.vx * (t * 60);
    const py = ball.y + ball.vy * (t * 60);

    const danger = (ball.x > W*0.72) || (ball.vx > 0 && ball.x > W*0.60);
    let tx, ty;

    const noise = (Math.random() < cfg.error) ? (Math.random()-0.5)*120 : 0;

    if (danger) {
      tx = clamp(px + 80, W*0.45, W-160);
      ty = clamp(py + noise, P2.r+8, H-P2.r-8);
      if (ball.x > W - 80) tx = W - 170;
    } else {
      tx = px - 55;
      ty = clamp(py + noise, P2.r+8, H-P2.r-8);
      if (ball.x > W - 80) tx = W - 170;
      if (ball.x < 100) tx = 170;
    }

    const minX = 120, maxX = W - 120;
    const dx = tx - P2.x, dy = ty - P2.y;
    const d = Math.hypot(dx,dy) || 1;

    P2.x += (dx/d) * cfg.botSpeed;
    P2.y += (dy/d) * cfg.botSpeed;

    P2.x = clamp(P2.x, minX, maxX);
    P2.y = clamp(P2.y, P2.r+6, H-P2.r-6);

    const close = dist(P2.x,P2.y,ball.x,ball.y) < (P2.r + ball.r + 12);
    if (close) {
      const aimX = danger ? W * 0.47 : 0;
      const aimY = H/2 + (Math.random()-0.5) * 120 * cfg.error;

      const adx = aimX - ball.x;
      const ady = aimY - ball.y;
      const ad = Math.hypot(adx,ady) || 1;

      ball.vx = (adx/ad) * cfg.botKick;
      ball.vy = (ady/ad) * cfg.botKick;

      clampBallSpeed();
    }
  }

  // ---------------- Goals ----------------
  function checkGoals(){
    if (ball.x + ball.r < -2 && ball.y >= goalL.y1 && ball.y <= goalL.y2){
      scoreRight++; setScoreUI(); goalMoment("GOAL!");
    }
    if (ball.x - ball.r > W + 2 && ball.y >= goalR.y1 && ball.y <= goalR.y2){
      scoreLeft++; setScoreUI(); goalMoment("GOAL!");
    }
  }

  function goalMoment(text){
    inCountdown = true;
    setOverlay(text, true);
    setTimeout(() => {
      setOverlay("", false);
      resetRound();
      startCountdown(2);
    }, 650);
  }

  // ---------------- Penalties (shootout) ----------------
  function startPenalties(){
    pen.active = true;
    pen.leftTaken = 0; pen.rightTaken = 0;
    pen.leftGoals = 0; pen.rightGoals = 0;
    pen.leftSeq = []; pen.rightSeq = [];
    pen.turn = "left";
    pen.shotLive = false;
    pen.shotTimer = 0;
    pen.uiLock = 0;

    remaining = 0;
    setTimeUI();
    setOverlay("PENALTIES", true);
    renderPenaltyDots();

    setTimeout(() => {
      setOverlay("", false);
      setupNextPenaltyShot();
    }, 850);
  }

  function penaltyKicker(){ return (pen.turn === "left") ? P1 : P2; }
  function penaltyGoalie(){ return (pen.turn === "left") ? GK_R : GK_L; }
  function penaltyGoal(){ return (pen.turn === "left") ? goalR : goalL; }

  function setupNextPenaltyShot(){
    pen.shotLive = false;
    pen.shotTimer = 0;
    pen.uiLock = 0.42;

    ball.vx = 0; ball.vy = 0;
    ball.trail = [];
    ball.bounceCd = 0;

    resetGoalieState(GK_L);
    resetGoalieState(GK_R);

    const spotOffset = 360;
    const kickerOffset = 175;

    const goalie = penaltyGoalie();
    goalie.x = goalie.isLeft ? 84 : W-84;
    goalie.y = H/2;

    if (pen.turn === "left") {
      ball.x = W - spotOffset; ball.y = H/2;
      P1.x = ball.x - kickerOffset; P1.y = ball.y;
      P2.x = ball.x - 320; P2.y = ball.y;
      setOverlay(`${P1.name.toUpperCase()} KICKS`, true);
    } else {
      ball.x = spotOffset; ball.y = H/2;
      P2.x = ball.x + kickerOffset; P2.y = ball.y;
      P1.x = ball.x + 320; P1.y = ball.y;
      setOverlay(`${P2.name.toUpperCase()} KICKS`, true);
    }

    renderPenaltyDots();
    setTimeout(() => setOverlay("", false), 650);
  }

  function tryTriggerPenaltyShot(){
    if (pen.shotLive || pen.uiLock > 0) return;

    const kicker = penaltyKicker();
    const d = dist(kicker.x, kicker.y, ball.x, ball.y);
    if (d < kicker.r + ball.r + 8) {
      pen.shotLive = true;
      pen.shotTimer = 0;

      const cfg = DIFF[difficulty] || DIFF.medium;
      const g = penaltyGoal();
      const goalCenterY = (g.y1 + g.y2) / 2;
      const goalX = g.x;

      let ax = goalX - ball.x;
      let ay = goalCenterY - ball.y;

      ax += kicker.lastDirX * 190;
      ay += kicker.lastDirY * 190;

      const spread = (gameMode === "bot" && kicker === P2) ? cfg.error : 0.10;
      ay += (Math.random()-0.5) * 220 * spread;

      const ad = Math.hypot(ax,ay) || 1;
      ax /= ad; ay /= ad;

      const power = (gameMode === "bot" && kicker === P2) ? (cfg.botKick + 2.0) : 13.8;
      ball.vx = ax * power;
      ball.vy = ay * power;
      clampBallSpeed();

      // goalie decision (can be wrong)
      const goalie = penaltyGoalie();
      const b = goalieBounds(goalie);
      const centerY = (g.y1 + g.y2) / 2;

      const wrongChance = clamp(cfg.penWrong * goalie.ai.mistakeMul, 0.10, 0.60);
      const willCommit = Math.random() < clamp(0.55 + 0.10*goalie.ai.style, 0.35, 0.75);
      goalie.pen.committed = willCommit;

      let side = (Math.random() < 0.5) ? -1 : 1;
      let targetY = centerY + side*(55 + Math.random()*85);

      // sometimes wrong side
      if (Math.random() < wrongChance) targetY = centerY - (targetY - centerY);

      // add some human randomness anyway
      targetY += (Math.random()-0.5) * 55 * cfg.gkMistake;

      targetY = clamp(targetY, b.minY, b.maxY);

      // reaction delay
      goalie.pen.react = clamp(cfg.gkReact * goalie.ai.reactMul + Math.random()*0.20, 0.07, 0.46);

      // if committed, he dives early (can be wrong)
      if (goalie.pen.committed) {
        setTimeout(() => {
          // might have already ended
          if (!pen.active) return;
          startDive(goalie, targetY);
        }, Math.floor(goalie.pen.react * 1000));
      }
    }
  }

  function updatePenaltyGoalie(dt){
    const cfg = DIFF[difficulty] || DIFF.medium;
    const goalie = penaltyGoalie();
    const b = goalieBounds(goalie);

    goalie.diveCd = Math.max(0, goalie.diveCd - dt);
    goalie.diveT  = Math.max(0, goalie.diveT  - dt);
    goalie.recoveryT = Math.max(0, goalie.recoveryT - dt);

    // pre shot: stay center
    if (!pen.shotLive) {
      const tx = goalie.isLeft ? (b.minX + 20) : (b.maxX - 20);
      const ty = H/2;
      const s = cfg.gkBaseSpeed * goalie.ai.speedMul * 0.70;
      goalie.x += clamp(tx - goalie.x, -s, s);
      goalie.y += clamp(ty - goalie.y, -s, s);
      goalie.x = clamp(goalie.x, b.minX, b.maxX);
      goalie.y = clamp(goalie.y, b.minY, b.maxY);
      updateDiveStripe(goalie);
      return;
    }

    // if not committed, track later
    const speedFactor = goalie.recoveryT > 0 ? 0.72 : 1.0;
    const baseS = cfg.gkBaseSpeed * goalie.ai.speedMul * speedFactor;

    if (!goalie.pen.committed) {
      // track predicted at goal line but not perfect
      const goalX = goalie.isLeft ? 0 : W;
      let predY = predictBallYAtX(goalX);
      predY = clamp(predY, b.minY, b.maxY);
      predY = lerp(H/2, predY, 0.82);
      predY += (Math.random()-0.5) * (70 * cfg.gkMistake * goalie.ai.slack);
      const ty = clamp(predY, b.minY, b.maxY);

      // occasional late dive
      if (goalie.diveT <= 0 && goalie.diveCd <= 0 && getBallSpeed() > 6.2 && Math.random() < 0.14*cfg.gkDiveAggro) {
        startDive(goalie, ty);
      }

      if (goalie.diveT > 0) {
        const s = baseS * (DIVE_BURST * 1.05);
        goalie.y += clamp(goaleYTarget(goalie, ty) - goalie.y, -s, s);
      } else {
        goalie.y += clamp(ty - goalie.y, -baseS, baseS);
      }

      const tx = goalie.isLeft ? (b.minX + 20) : (b.maxX - 20);
      goalie.x += clamp(tx - goalie.x, -baseS*0.65, baseS*0.65);
    } else {
      // committed dive only moves while dive is active
      if (goalie.diveT <= 0) {
        // little correction to center after dive
        const tx = goalie.isLeft ? (b.minX + 20) : (b.maxX - 20);
        const ty = H/2;
        goalie.x += clamp(tx - goalie.x, -baseS*0.55, baseS*0.55);
        goalie.y += clamp(ty - goalie.y, -baseS*0.55, baseS*0.55);
      }
    }

    goalie.x = clamp(goalie.x, b.minX, b.maxX);
    goalie.y = clamp(goalie.y, b.minY, b.maxY);

    updateDiveStripe(goalie);

    // Nerf save power: meno “muro”
    resolveBallCircle(goalie, 9.6);
  }

  function goaleYTarget(goalie, ty){
    // tiny human wobble on dive
    return ty + (Math.random()-0.5) * (goalie.ai.slack * 8);
  }

  function updatePenalties(dt){
    pen.uiLock = Math.max(0, pen.uiLock - dt);

    tryTriggerPenaltyShot();
    updatePenaltyGoalie(dt);

    if (!pen.shotLive) return;

    pen.shotTimer += dt;

    ball.x += ball.vx;
    ball.y += ball.vy;
    ball.vx *= 0.992;
    ball.vy *= 0.992;

    ball.trail.push({x:ball.x,y:ball.y});
    if (ball.trail.length > 16) ball.trail.shift();

    ballWalls();
    for (const p of goalL.posts) resolvePost(p);
    for (const p of goalR.posts) resolvePost(p);

    const g = penaltyGoal();
    const goalScored =
      (g === goalR && (ball.x - ball.r > W + 2) && ball.y >= g.y1 && ball.y <= g.y2) ||
      (g === goalL && (ball.x + ball.r < -2) && ball.y >= g.y1 && ball.y <= g.y2);

    const slow = getBallSpeed() < 0.35;
    const timeout = pen.shotTimer > 4.2;

    if (goalScored) { setOverlay("GOAL!", true); finishPenaltyShot(true); }
    else if (slow || timeout) { setOverlay("MISS!", true); finishPenaltyShot(false); }
  }

  function canEarlyFinishShootout(){
    const leftRemaining = pen.shotsPerSide - pen.leftTaken;
    const rightRemaining = pen.shotsPerSide - pen.rightTaken;
    if (pen.leftGoals > pen.rightGoals + rightRemaining) return "left";
    if (pen.rightGoals > pen.leftGoals + leftRemaining) return "right";
    return null;
  }

  function finishPenaltyShot(scored){
    pen.shotLive = false;

    if (pen.turn === "left") { pen.leftTaken++; pen.leftSeq.push(!!scored); if (scored) pen.leftGoals++; }
    else { pen.rightTaken++; pen.rightSeq.push(!!scored); if (scored) pen.rightGoals++; }

    renderPenaltyDots();
    setTimeout(() => setOverlay("", false), 450);

    let winner = null;
    if (pen.leftTaken <= pen.shotsPerSide && pen.rightTaken <= pen.shotsPerSide) winner = canEarlyFinishShootout();
    const both5 = (pen.leftTaken >= pen.shotsPerSide && pen.rightTaken >= pen.shotsPerSide);

    if (winner || (both5 && pen.leftGoals !== pen.rightGoals && pen.leftTaken === pen.rightTaken)) {
      endShootout(winner || (pen.leftGoals > pen.rightGoals ? "left" : "right"));
      return;
    }

    pen.turn = (pen.turn === "left") ? "right" : "left";

    if (both5 && pen.leftTaken === pen.rightTaken && pen.leftGoals !== pen.rightGoals) {
      endShootout(pen.leftGoals > pen.rightGoals ? "left" : "right");
      return;
    }

    setTimeout(() => setupNextPenaltyShot(), 650);
  }

  function endShootout(winnerSide){
    pen.active = false;
    renderPenaltyDots();

    const winnerName = (winnerSide === "left") ? P1.name : P2.name;

    if (resultModal) resultModal.style.display = "flex";
    if (resultTitle) resultTitle.textContent = "Match Over (Penalties)";
    if (resultScore) resultScore.textContent = `${scoreLeft} - ${scoreRight}`;
    if (resultLine) resultLine.textContent = `Winner: ${winnerName} • Penalties: ${pen.leftGoals}-${pen.rightGoals}`;

    pausedByMenu = true;
  }

  // ---------------- Match end ----------------
  function endMatch(){
    pausedByMenu = true;
    setOverlay("", false);

    if (scoreLeft === scoreRight) {
      pausedByMenu = false;
      startPenalties();
      return;
    }

    pen.active = false;
    renderPenaltyDots();

    if (resultModal) resultModal.style.display = "flex";
    if (resultScore) resultScore.textContent = `${scoreLeft} - ${scoreRight}`;
    if (resultTitle) resultTitle.textContent = "Match Over";
    if (resultLine) resultLine.textContent = `Winner: ${(scoreLeft > scoreRight) ? P1.name : P2.name}`;
  }

  // ---------------- Gameplay update ----------------
  function updateBall(dt){
    ball.bounceCd = Math.max(0, ball.bounceCd - dt);

    ball.x += ball.vx;
    ball.y += ball.vy;

    ball.vx *= 0.992;
    ball.vy *= 0.992;

    ball.trail.push({x:ball.x,y:ball.y});
    if (ball.trail.length > 16) ball.trail.shift();

    ballWalls();
    for (const p of goalL.posts) resolvePost(p);
    for (const p of goalR.posts) resolvePost(p);
  }

  function updatePlayers(dt){
    const i1 = getP1Input();
    const i2 = getP2Input();

    rememberDirs(P1, i1.mx, i1.my);
    P1.x += i1.mx * P1.speed;
    P1.y += i1.my * P1.speed;
    P1.x = clamp(P1.x, P1.r+6, W-P1.r-6);
    P1.y = clamp(P1.y, P1.r+6, H-P1.r-6);

    if (gameMode === "2p") {
      rememberDirs(P2, i2.mx, i2.my);
      P2.x += i2.mx * P2.speed;
      P2.y += i2.my * P2.speed;
      P2.x = clamp(P2.x, P2.r+6, W-P2.r-6);
      P2.y = clamp(P2.y, P2.r+6, H-P2.r-6);
    } else {
      updateBot(dt);
    }
  }

  function doCollisions(){
    resolveBallCircle(P1, 13.4);
    resolveBallCircle(P2, (gameMode === "bot") ? (DIFF[difficulty]?.botKick || 12) : 13.4);

    // Nerf goalie kick: meno OP
    resolveBallCircle(GK_L, 9.6);
    resolveBallCircle(GK_R, 9.6);
  }

  // ---------------- MAIN LOOP ----------------
  let lastT = 0;
  function loop(t){
    if (!running) return;
    const dt = Math.min(0.033, (t - lastT) / 1000 || 0.016);
    lastT = t;

    if (!pausedByMenu) {
      if (!inCountdown && !pen.active) {
        remaining = Math.max(0, remaining - dt);
        setTimeUI();
        if (remaining <= 0) endMatch();
      } else {
        setTimeUI();
      }

      if (!inCountdown) {
        if (pen.active) {
          const kicker = penaltyKicker();
          const inp = (kicker === P1) ? getP1Input() : getP2Input();
          rememberDirs(kicker, inp.mx, inp.my);

          kicker.x += inp.mx * kicker.speed;
          kicker.y += inp.my * kicker.speed;

          kicker.x = clamp(kicker.x, kicker.r+6, W-kicker.r-6);
          kicker.y = clamp(kicker.y, kicker.r+6, H-kicker.r-6);

          updatePenalties(dt);
        } else {
          updatePlayers(dt);
          updateGoalkeepers(dt);
          updateBall(dt);
          doCollisions();
          checkGoals();
        }
      }

      drawField();
      drawBallTrail();
      drawEntities();
    }

    requestAnimationFrame(loop);
  }

  // ---------------- UI (menu) ----------------
  function refreshMenuVisibility(){
    if (!modeSelect || !p2NameWrap || !diffWrap) return;
    const mode = modeSelect.value;
    if (mode === "bot") { p2NameWrap.style.display = "none"; diffWrap.style.display = "block"; }
    else { p2NameWrap.style.display = "block"; diffWrap.style.display = "none"; }
  }
  on(modeSelect, "change", refreshMenuVisibility);
  refreshMenuVisibility();

  function startMatch(){
    ensurePenaltyHud();

    gameMode = modeSelect?.value || "bot";
    difficulty = difficultySelect?.value || "medium";
    matchSeconds = parseInt(matchTimeSelect?.value, 10) || 90;
    remaining = matchSeconds;

    P1.name = (p1NameInput?.value.trim() || "Player 1").slice(0,16);
    P2.name = (gameMode === "bot") ? "Bot" : (p2NameInput?.value.trim() || "Player 2").slice(0,16);

    if (hudP1) hudP1.textContent = P1.name.toUpperCase();
    if (hudP2) hudP2.textContent = P2.name.toUpperCase();

    if (modeText) modeText.textContent = `MODE ${gameMode === "bot" ? "VS BOT" : "2 PLAYERS"}`;
    if (diffText) diffText.textContent = `DIFF ${gameMode === "bot" ? difficulty.toUpperCase() : "—"}`;

    scoreLeft = 0; scoreRight = 0;
    setScoreUI();
    setTimeUI();

    initGoalieBrains();

    pen.active = false;
    pen.leftSeq = [];
    pen.rightSeq = [];
    renderPenaltyDots();

    if (mobileControls) mobileControls.style.display = isTouchDevice() ? "block" : "none";
    if (joy2Wrap) joy2Wrap.style.display = (gameMode === "2p") ? "block" : "none";

    if (menu) menu.style.display = "none";
    canvas.style.display = "block";
    if (hud) hud.style.display = "flex";
    if (resultModal) resultModal.style.display = "none";

    pausedByMenu = false;
    resetRound();
    startCountdown(3);

    if (!running) {
      running = true;
      lastT = performance.now();
      requestAnimationFrame(loop);
    }
  }

  // IMPORTANT: prevent default to avoid weird form submits / reloads
  on(playBtn, "click", (e) => { e.preventDefault?.(); e.stopPropagation?.(); startMatch(); });

  on(againBtn, "click", (e) => {
    e.preventDefault?.(); e.stopPropagation?.();

    if (resultModal) resultModal.style.display = "none";
    pausedByMenu = false;

    scoreLeft = 0; scoreRight = 0;
    remaining = matchSeconds;

    setScoreUI();
    setTimeUI();

    initGoalieBrains();

    pen.active = false;
    pen.leftSeq = [];
    pen.rightSeq = [];
    renderPenaltyDots();

    resetRound();
    startCountdown(3);
  });

  function goHome(e){
    e?.preventDefault?.();
    e?.stopPropagation?.();

    pausedByMenu = true;
    inCountdown = false;

    pen.active = false;
    pen.leftSeq = [];
    pen.rightSeq = [];
    renderPenaltyDots();

    if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }

    canvas.style.display = "none";
    if (hud) hud.style.display = "none";
    if (mobileControls) mobileControls.style.display = "none";
    if (resultModal) resultModal.style.display = "none";
    if (menu) menu.style.display = "flex";

    setOverlay("", false);
  }

  on(homeBtn,  "click", goHome);
  on(homeBtn2, "click", goHome);

  // ------------- init hidden -------------
  canvas.style.display = "none";
  if (hud) hud.style.display = "none";
  if (resultModal) resultModal.style.display = "none";
  if (mobileControls) mobileControls.style.display = "none";
  setOverlay("", false);

  ensurePenaltyHud();

  // Small debug: if buttons still don't work, you’ll see warnings about missing IDs
})();
