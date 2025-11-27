(() => {
  // ---------------- DOM ----------------
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  const menu = document.getElementById("menu");
  const playBtn = document.getElementById("playBtn");
  const homeBtn = document.getElementById("homeBtn");
  const hud = document.getElementById("hud");
  const overlayEl = document.getElementById("overlayText");

  const modeSelect = document.getElementById("modeSelect");
  const p1NameInput = document.getElementById("p1Name");
  const p2NameInput = document.getElementById("p2Name");
  const p2NameWrap = document.getElementById("p2NameWrap");
  const diffWrap = document.getElementById("diffWrap");
  const difficultySelect = document.getElementById("difficulty");
  const matchTimeSelect = document.getElementById("matchTime");

  const hudP1 = document.getElementById("hudP1");
  const hudP2 = document.getElementById("hudP2");
  const scoreText = document.getElementById("scoreText");
  const modeText = document.getElementById("modeText");
  const diffText = document.getElementById("diffText");
  const timeText = document.getElementById("timeText");

  const resultModal = document.getElementById("resultModal");
  const resultTitle = document.getElementById("resultTitle");
  const resultScore = document.getElementById("resultScore");
  const resultLine = document.getElementById("resultLine");
  const againBtn = document.getElementById("againBtn");
  const homeBtn2 = document.getElementById("homeBtn2");

  const mobileControls = document.getElementById("mobileControls");
  const joy1Base = document.getElementById("joy1Base");
  const joy1Knob = document.getElementById("joy1Knob");
  const joy2Wrap = document.getElementById("joy2Wrap");
  const joy2Base = document.getElementById("joy2Base");
  const joy2Knob = document.getElementById("joy2Knob");

  const W = canvas.width;
  const H = canvas.height;

  // ---------------- Inject CSS for penalty dots ----------------
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

  // ---------------- Difficulty configs ----------------
  const DIFF = {
    easy: {
      botSpeed: 2.9, goalieSpeed: 2.9, botKick: 9.5,
      error: 0.30, predict: 0.18,
      gkMistake: 0.24,
      gkReact: 0.22
    },
    medium: {
      botSpeed: 4.8, goalieSpeed: 4.4, botKick: 12.2,
      error: 0.14, predict: 0.28,
      gkMistake: 0.13,
      gkReact: 0.14
    },
    hard: {
      botSpeed: 6.6, goalieSpeed: 6.2, botKick: 14.3,
      error: 0.05, predict: 0.38,
      gkMistake: 0.06,
      gkReact: 0.09
    },
  };

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
    leftTaken: 0,
    rightTaken: 0,
    leftGoals: 0,
    rightGoals: 0,
    leftSeq: [],   // array of true/false for each shot
    rightSeq: [],
    turn: "left",
    shotLive: false,
    shotTimer: 0,
    uiLock: 0,
  };

  // ---------------- Build penalty HUD UI inside existing HUD ----------------
  let penHudWrap, penRowL, penRowR, penDotsL, penDotsR;
  function ensurePenaltyHud(){
    if (penHudWrap) return;

    const midBox = hud.querySelector(".hudBox.mid");
    if (!midBox) return;

    penHudWrap = document.createElement("div");
    penHudWrap.className = "penHudLine";
    penHudWrap.id = "penHudLine";

    penRowL = document.createElement("div");
    penRowL.className = "penRow";

    penRowR = document.createElement("div");
    penRowR.className = "penRow";
    penRowR.style.marginTop = "6px";

    const nameL = document.createElement("span");
    nameL.className = "penName";
    nameL.id = "penNameL";
    nameL.textContent = "LEFT";

    const nameR = document.createElement("span");
    nameR.className = "penName";
    nameR.id = "penNameR";
    nameR.textContent = "RIGHT";

    const label = document.createElement("span");
    label.className = "penLabel";
    label.textContent = "PEN";

    penDotsL = document.createElement("div");
    penDotsL.className = "dots";
    penDotsL.id = "penDotsL";

    penDotsR = document.createElement("div");
    penDotsR.className = "dots";
    penDotsR.id = "penDotsR";

    // Row format: NAME  [dots]  PEN
    penRowL.appendChild(nameL);
    penRowL.appendChild(penDotsL);
    penRowL.appendChild(label.cloneNode(true));

    penRowR.appendChild(nameR);
    penRowR.appendChild(penDotsR);
    penRowR.appendChild(label);

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

    if (!pen.active) {
      penHudWrap.style.display = "none";
      return;
    }
    penHudWrap.style.display = "block";

    // names
    const nameL = penRowL.querySelector("#penNameL");
    const nameR = penRowR.querySelector("#penNameR");
    if (nameL) nameL.textContent = (P1.name || "P1").toUpperCase();
    if (nameR) nameR.textContent = (P2.name || "P2").toUpperCase();

    penDotsL.innerHTML = "";
    penDotsR.innerHTML = "";

    // base 5 dots + sudden death extension
    const base = pen.shotsPerSide;
    const extraCount = Math.max(0, Math.max(pen.leftSeq.length, pen.rightSeq.length) - base);

    // left
    for (let i = 0; i < base; i++){
      const v = pen.leftSeq[i];
      penDotsL.appendChild(mkDot(v === true ? "goal" : v === false ? "miss" : "pending"));
    }
    for (let i = 0; i < extraCount; i++){
      const idx = base + i;
      const v = pen.leftSeq[idx];
      penDotsL.appendChild(mkDot(v === true ? "goal" : v === false ? "miss" : "pending", true));
    }

    // right
    for (let i = 0; i < base; i++){
      const v = pen.rightSeq[i];
      penDotsR.appendChild(mkDot(v === true ? "goal" : v === false ? "miss" : "pending"));
    }
    for (let i = 0; i < extraCount; i++){
      const idx = base + i;
      const v = pen.rightSeq[idx];
      penDotsR.appendChild(mkDot(v === true ? "goal" : v === false ? "miss" : "pending", true));
    }
  }

  // ---------------- Input (keyboard) ----------------
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

  function isTouchDevice() {
    return "ontouchstart" in window || navigator.maxTouchPoints > 0;
  }

  // ---------------- Field / goals ----------------
  const goalHalf = 80;
  const postR = 10;

  const goalL = { x: 0, y1: H/2-goalHalf, y2: H/2+goalHalf, posts: [{x:0,y:H/2-goalHalf},{x:0,y:H/2+goalHalf}] };
  const goalR = { x: W, y1: H/2-goalHalf, y2: H/2+goalHalf, posts: [{x:W,y:H/2-goalHalf},{x:W,y:H/2+goalHalf}] };

  // Boxes (white)
  const boxH = 240, boxW = 120;
  const boxL = { x: 0, y: H/2 - boxH/2, w: boxW, h: boxH };
  const boxR = { x: W - boxW, y: H/2 - boxH/2, w: boxW, h: boxH };

  // ---------------- Entities ----------------
  const P1 = { name:"P1", x:240, y:H/2, r:16, speed:5.35, color:"#1a66ff", lastDirX:1, lastDirY:0 };
  const P2 = { name:"P2", x:W-240, y:H/2, r:16, speed:5.35, color:"#ff9f1a", lastDirX:-1, lastDirY:0 };

  const GK_L = { x:78, y:H/2, r:19, color:"#25e6ff", mistakeT:0, reactT:0 };
  const GK_R = { x:W-78, y:H/2, r:19, color:"#ff2d2d", mistakeT:0, reactT:0 };

  const ball = { x:W/2, y:H/2, r:11, vx:0, vy:0, trail:[] };

  // ---------------- Utils ----------------
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const dist = (ax,ay,bx,by)=>Math.hypot(bx-ax,by-ay);
  const lerp = (a,b,t)=>a+(b-a)*t;

  function setOverlay(text, on=true){
    overlayEl.textContent = text;
    overlayEl.style.opacity = on ? 1 : 0;
  }
  function setScoreUI(){ scoreText.textContent = `${scoreLeft} - ${scoreRight}`; }

  function setTimeUI(){
    if (pen.active) { timeText.textContent = "PENALTIES"; return; }
    const m = Math.floor(remaining / 60);
    const s = Math.floor(remaining % 60);
    timeText.textContent = `TIME ${m}:${String(s).padStart(2,"0")}`;
  }

  function resetRound(){
    P1.x=240; P1.y=H/2;
    P2.x=W-240; P2.y=H/2;

    GK_L.x=78; GK_L.y=H/2;
    GK_R.x=W-78; GK_R.y=H/2;
    GK_L.mistakeT = GK_L.reactT = 0;
    GK_R.mistakeT = GK_R.reactT = 0;

    ball.x=W/2; ball.y=H/2;
    ball.vx=0; ball.vy=0;
    ball.trail=[];
  }

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

    const cur = Math.hypot(ball.vx, ball.vy);
    const s = kickStrength + cur * 0.18;

    ball.vx = nx * s;
    ball.vy = ny * s;
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
    return true;
  }

  function ballWalls(){
    if (ball.y - ball.r < 0) { ball.y = ball.r; ball.vy = Math.abs(ball.vy)*0.98; }
    if (ball.y + ball.r > H) { ball.y = H - ball.r; ball.vy = -Math.abs(ball.vy)*0.98; }

    if (ball.x - ball.r < 0) {
      const inMouth = (ball.y >= goalL.y1 && ball.y <= goalL.y2);
      if (!inMouth) { ball.x = ball.r; ball.vx = Math.abs(ball.vx)*0.98; }
    }
    if (ball.x + ball.r > W) {
      const inMouth = (ball.y >= goalR.y1 && ball.y <= goalR.y2);
      if (!inMouth) { ball.x = W - ball.r; ball.vx = -Math.abs(ball.vx)*0.98; }
    }
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

  // ---------------- Draw ----------------
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

  function drawTrail(){
    for(let i=0;i<ball.trail.length;i++){
      const t = ball.trail[i];
      const a = i/ball.trail.length;
      const alpha = 0.07 + a*0.55;
      ctx.beginPath();
      ctx.arc(t.x,t.y,4,0,Math.PI*2);
      ctx.fillStyle = `rgba(255,255,255,${alpha*0.55})`;
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
    drawCircle(P1.x,P1.y,P1.r,P1.color);
    drawCircle(P2.x,P2.y,P2.r,P2.color);
    drawCircle(GK_L.x,GK_L.y,GK_L.r,GK_L.color);
    drawCircle(GK_R.x,GK_R.y,GK_R.r,GK_R.color);
    drawCircle(ball.x,ball.y,ball.r,"white");
  }

  // ---------------- Inputs ----------------
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

  // ---------------- Goalies ----------------
  function goalieBoundsLeft(gk){
    return {
      minX: boxL.x + gk.r + 6,
      maxX: boxL.x + boxL.w - gk.r - 6,
      minY: boxL.y + gk.r + 6,
      maxY: boxL.y + boxL.h - gk.r - 6
    };
  }
  function goalieBoundsRight(gk){
    return {
      minX: boxR.x + gk.r + 6,
      maxX: boxR.x + boxR.w - gk.r - 6,
      minY: boxR.y + gk.r + 6,
      maxY: boxR.y + boxR.h - gk.r - 6
    };
  }

  function maybeTriggerGoalieMistakes(dt, cfg){
    if (!inCountdown) {
      if (GK_L.mistakeT <= 0 && Math.random() < cfg.gkMistake * dt) GK_L.mistakeT = 0.55;
      if (GK_R.mistakeT <= 0 && Math.random() < cfg.gkMistake * dt) GK_R.mistakeT = 0.55;
      if (GK_L.reactT <= 0 && Math.random() < cfg.gkReact * dt) GK_L.reactT = 0.18;
      if (GK_R.reactT <= 0 && Math.random() < cfg.gkReact * dt) GK_R.reactT = 0.18;
    }
  }

  function updateGoalies(dt){
    const cfg = (gameMode === "bot") ? (DIFF[difficulty] || DIFF.medium) : DIFF.medium;
    const gs = cfg.goalieSpeed;

    GK_L.mistakeT = Math.max(0, GK_L.mistakeT - dt);
    GK_R.mistakeT = Math.max(0, GK_R.mistakeT - dt);
    GK_L.reactT = Math.max(0, GK_L.reactT - dt);
    GK_R.reactT = Math.max(0, GK_R.reactT - dt);

    // mistakes in normal match too
    maybeTriggerGoalieMistakes(dt, cfg);

    const bL = goalieBoundsLeft(GK_L);
    const bR = goalieBoundsRight(GK_R);

    let tLX = clamp(ball.x, bL.minX, bL.maxX);
    let tLY = clamp(ball.y, bL.minY, bL.maxY);
    tLX = lerp(bL.minX + 20, tLX, 0.55);

    let tRX = clamp(ball.x, bR.minX, bR.maxX);
    let tRY = clamp(ball.y, bR.minY, bR.maxY);
    tRX = lerp(bR.maxX - 20, tRX, 0.55);

    if (GK_L.mistakeT > 0) {
      tLY = clamp(tLY + 90 * (Math.random() < 0.5 ? 1 : -1), bL.minY, bL.maxY);
      tLX = clamp(tLX + 30 * (Math.random() < 0.5 ? 1 : -1), bL.minX, bL.maxX);
    }
    if (GK_R.mistakeT > 0) {
      tRY = clamp(tRY + 90 * (Math.random() < 0.5 ? 1 : -1), bR.minY, bR.maxY);
      tRX = clamp(tRX + 30 * (Math.random() < 0.5 ? 1 : -1), bR.minX, bR.maxX);
    }

    if (GK_L.reactT > 0) { tLX = GK_L.x; tLY = GK_L.y; }
    if (GK_R.reactT > 0) { tRX = GK_R.x; tRY = GK_R.y; }

    GK_L.x += clamp(tLX - GK_L.x, -gs, gs);
    GK_L.y += clamp(tLY - GK_L.y, -gs, gs);
    GK_R.x += clamp(tRX - GK_R.x, -gs, gs);
    GK_R.y += clamp(tRY - GK_R.y, -gs, gs);

    GK_L.x = clamp(GK_L.x, bL.minX, bL.maxX);
    GK_L.y = clamp(GK_L.y, bL.minY, bL.maxY);
    GK_R.x = clamp(GK_R.x, bR.minX, bR.maxX);
    GK_R.y = clamp(GK_R.y, bR.minY, bR.maxY);
  }

  // ---------------- Bot AI ----------------
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
      const aimX = danger ? W * 0.55 : 0;
      const aimY = H/2 + (Math.random()-0.5) * 120 * cfg.error;

      const adx = aimX - ball.x;
      const ady = aimY - ball.y;
      const ad = Math.hypot(adx,ady) || 1;

      ball.vx = (adx/ad) * cfg.botKick;
      ball.vy = (ady/ad) * cfg.botKick;
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
    }, 600);
  }

  // ---------------- Penalties ----------------
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
    }, 800);
  }

  function setupNextPenaltyShot(){
    pen.shotLive = false;
    pen.shotTimer = 0;
    pen.uiLock = 0.35;

    ball.vx = 0; ball.vy = 0;
    ball.trail = [];

    GK_L.mistakeT = GK_L.reactT = 0;
    GK_R.mistakeT = GK_R.reactT = 0;

    // farther from goal (penalty spot)
    const spotOffset = 300;
    const kickerOffset = 110;

    if (pen.turn === "left") {
      const bx = W - spotOffset;
      const by = H/2;

      ball.x = bx; ball.y = by;
      P1.x = bx - kickerOffset; P1.y = by;
      P2.x = bx - 220; P2.y = by;

      GK_R.x = W - 78; GK_R.y = H/2;
      GK_L.x = 78; GK_L.y = H/2;

      setOverlay(`${P1.name.toUpperCase()} KICKS`, true);
    } else {
      const bx = spotOffset;
      const by = H/2;

      ball.x = bx; ball.y = by;
      P2.x = bx + kickerOffset; P2.y = by;
      P1.x = bx + 220; P1.y = by;

      GK_L.x = 78; GK_L.y = H/2;
      GK_R.x = W - 78; GK_R.y = H/2;

      setOverlay(`${P2.name.toUpperCase()} KICKS`, true);
    }

    renderPenaltyDots();
    setTimeout(() => setOverlay("", false), 650);
  }

  function penaltyKicker(){ return (pen.turn === "left") ? P1 : P2; }
  function penaltyGoalie(){ return (pen.turn === "left") ? GK_R : GK_L; }
  function penaltyGoal(){ return (pen.turn === "left") ? goalR : goalL; }

  function tryTriggerPenaltyShot(){
    if (pen.shotLive || pen.uiLock > 0) return;

    const kicker = penaltyKicker();
    const d = dist(kicker.x, kicker.y, ball.x, ball.y);
    if (d < kicker.r + ball.r + 8) {
      pen.shotLive = true;
      pen.shotTimer = 0;

      const cfg = (gameMode === "bot") ? (DIFF[difficulty] || DIFF.medium) : DIFF.medium;

      const g = penaltyGoal();
      const goalCenterY = (g.y1 + g.y2) / 2;
      const goalX = g.x;

      let ax = goalX - ball.x;
      let ay = goalCenterY - ball.y;

      ax += kicker.lastDirX * 140;
      ay += kicker.lastDirY * 140;

      // bot kicker can miss sometimes too
      const botKicker = (gameMode === "bot" && kicker === P2);
      const spread = botKicker ? cfg.error : 0.12;
      ay += (Math.random() - 0.5) * 260 * spread;

      const ad = Math.hypot(ax, ay) || 1;
      ax /= ad; ay /= ad;

      const power = botKicker ? (cfg.botKick + 2.0) : 13.0;
      ball.vx = ax * power;
      ball.vy = ay * power;

      // goalie can also fail sometimes
      const goalie = penaltyGoalie();
      if (Math.random() < (cfg.gkMistake * 0.9)) goalie.mistakeT = 0.6;
    }
  }

  function updatePenaltyGoalie(dt){
    const cfg = (gameMode === "bot") ? (DIFF[difficulty] || DIFF.medium) : DIFF.medium;
    const goalie = penaltyGoalie();
    goalie.mistakeT = Math.max(0, goalie.mistakeT - dt);

    const b = (goalie === GK_L) ? goalieBoundsLeft(goalie) : goalieBoundsRight(goalie);

    if (!pen.shotLive) {
      const tx = (goalie === GK_L) ? (b.minX + 25) : (b.maxX - 25);
      const ty = H/2;
      const s = cfg.goalieSpeed * 0.70;

      goalie.x += clamp(tx - goalie.x, -s, s);
      goalie.y += clamp(ty - goalie.y, -s, s);

      goalie.x = clamp(goalie.x, b.minX, b.maxX);
      goalie.y = clamp(goalie.y, b.minY, b.maxY);
      return;
    }

    const s = cfg.goalieSpeed;
    let tx = clamp(ball.x, b.minX, b.maxX);
    let ty = clamp(ball.y, b.minY, b.maxY);

    if (goalie === GK_L) tx = lerp(b.minX + 20, tx, 0.65);
    else tx = lerp(b.maxX - 20, tx, 0.65);

    if (goalie.mistakeT > 0) ty = clamp(ty + 110 * (Math.random() < 0.5 ? 1 : -1), b.minY, b.maxY);

    goalie.x += clamp(tx - goalie.x, -s, s);
    goalie.y += clamp(ty - goalie.y, -s, s);

    goalie.x = clamp(goalie.x, b.minX, b.maxX);
    goalie.y = clamp(goalie.y, b.minY, b.maxY);

    resolveBallCircle(goalie, 12.0);
  }

  function updatePenalties(dt){
    pen.uiLock = Math.max(0, pen.uiLock - dt);

    tryTriggerPenaltyShot();
    updatePenaltyGoalie(dt);

    if (pen.shotLive) {
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

      const slow = Math.hypot(ball.vx, ball.vy) < 0.35;
      const timeout = pen.shotTimer > 3.8;

      if (goalScored) {
        setOverlay("GOAL!", true);
        finishPenaltyShot(true);
      } else if (slow || timeout) {
        setOverlay("MISS!", true);
        finishPenaltyShot(false);
      }
    }
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

    // store outcome in sequence for dots
    if (pen.turn === "left") {
      pen.leftTaken++;
      pen.leftSeq.push(!!scored);
      if (scored) pen.leftGoals++;
    } else {
      pen.rightTaken++;
      pen.rightSeq.push(!!scored);
      if (scored) pen.rightGoals++;
    }

    renderPenaltyDots();
    setTimeout(() => setOverlay("", false), 450);

    let winner = null;
    if (pen.leftTaken <= pen.shotsPerSide && pen.rightTaken <= pen.shotsPerSide) {
      winner = canEarlyFinishShootout();
    }

    const both5 = (pen.leftTaken >= pen.shotsPerSide && pen.rightTaken >= pen.shotsPerSide);

    if (winner || (both5 && pen.leftGoals !== pen.rightGoals && pen.leftTaken === pen.rightTaken)) {
      endShootout(winner || (pen.leftGoals > pen.rightGoals ? "left" : "right"));
      return;
    }

    // switch
    pen.turn = (pen.turn === "left") ? "right" : "left";

    // sudden death resolution: after each pair
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

    resultModal.style.display = "flex";
    resultTitle.textContent = "Match Over (Penalties)";
    resultScore.textContent = `${scoreLeft} - ${scoreRight}`;
    resultLine.textContent = `Winner: ${winnerName} • Penalties: ${pen.leftGoals}-${pen.rightGoals}`;

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

    resultModal.style.display = "flex";
    resultScore.textContent = `${scoreLeft} - ${scoreRight}`;
    resultTitle.textContent = "Match Over";
    resultLine.textContent = `Winner: ${(scoreLeft > scoreRight) ? P1.name : P2.name}`;
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
        const i1 = getP1Input();
        const i2 = getP2Input();

        if (pen.active) {
          const kicker = (pen.turn === "left") ? P1 : P2;
          const inp = (kicker === P1) ? i1 : i2;
          rememberDirs(kicker, inp.mx, inp.my);

          kicker.x += inp.mx * kicker.speed;
          kicker.y += inp.my * kicker.speed;

          kicker.x = clamp(kicker.x, kicker.r+6, W-kicker.r-6);
          kicker.y = clamp(kicker.y, kicker.r+6, H-kicker.r-6);

          updatePenalties(dt);
        } else {
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

          updateGoalies(dt);

          ball.x += ball.vx;
          ball.y += ball.vy;
          ball.vx *= 0.992;
          ball.vy *= 0.992;

          ball.trail.push({x:ball.x,y:ball.y});
          if (ball.trail.length > 16) ball.trail.shift();

          ballWalls();
          for (const p of goalL.posts) resolvePost(p);
          for (const p of goalR.posts) resolvePost(p);

          resolveBallCircle(P1, 10.8);
          resolveBallCircle(P2, (gameMode === "bot") ? (DIFF[difficulty]?.botKick || 12) : 10.8);
          resolveBallCircle(GK_L, 11.4);
          resolveBallCircle(GK_R, 11.4);

          checkGoals();
        }
      }

      drawField();
      drawTrail();
      drawEntities();
    }

    requestAnimationFrame(loop);
  }

  // ---------------- UI behavior ----------------
  function refreshMenuVisibility(){
    const mode = modeSelect.value;
    if (mode === "bot") { p2NameWrap.style.display = "none"; diffWrap.style.display = "block"; }
    else { p2NameWrap.style.display = "block"; diffWrap.style.display = "none"; }
  }
  modeSelect.addEventListener("change", refreshMenuVisibility);
  refreshMenuVisibility();

  function startMatch(){
    ensurePenaltyHud();

    gameMode = modeSelect.value;
    difficulty = difficultySelect.value;
    matchSeconds = parseInt(matchTimeSelect.value, 10) || 90;
    remaining = matchSeconds;

    P1.name = (p1NameInput.value.trim() || "Player 1").slice(0,16);
    P2.name = (gameMode === "bot") ? "Bot" : (p2NameInput.value.trim() || "Player 2").slice(0,16);

    hudP1.textContent = P1.name.toUpperCase();
    hudP2.textContent = P2.name.toUpperCase();

    modeText.textContent = `MODE ${gameMode === "bot" ? "VS BOT" : "2 PLAYERS"}`;
    diffText.textContent = `DIFF ${gameMode === "bot" ? difficulty.toUpperCase() : "—"}`;

    scoreLeft = 0; scoreRight = 0;
    setScoreUI();
    setTimeUI();

    pen.active = false;
    renderPenaltyDots();

    if (isTouchDevice()) mobileControls.style.display = "block";
    else mobileControls.style.display = "none";
    joy2Wrap.style.display = (gameMode === "2p") ? "block" : "none";

    menu.style.display = "none";
    canvas.style.display = "block";
    hud.style.display = "flex";
    resultModal.style.display = "none";

    pausedByMenu = false;
    resetRound();
    startCountdown(3);

    if (!running) {
      running = true;
      lastT = performance.now();
      requestAnimationFrame(loop);
    }
  }

  playBtn.addEventListener("click", startMatch);

  againBtn.addEventListener("click", () => {
    resultModal.style.display = "none";
    pausedByMenu = false;

    scoreLeft = 0; scoreRight = 0;
    remaining = matchSeconds;
    setScoreUI();
    setTimeUI();

    pen.active = false;
    pen.leftSeq = [];
    pen.rightSeq = [];
    renderPenaltyDots();

    resetRound();
    startCountdown(3);
  });

  function goHome(){
    pausedByMenu = true;
    inCountdown = false;

    pen.active = false;
    pen.leftSeq = [];
    pen.rightSeq = [];
    renderPenaltyDots();

    if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }

    canvas.style.display = "none";
    hud.style.display = "none";
    mobileControls.style.display = "none";
    resultModal.style.display = "none";
    menu.style.display = "flex";

    setOverlay("", false);
  }

  homeBtn.addEventListener("click", goHome);
  homeBtn2.addEventListener("click", goHome);

  // init hidden
  canvas.style.display = "none";
  hud.style.display = "none";
  resultModal.style.display = "none";
  mobileControls.style.display = "none";
  setOverlay("", false);

  // Create the penalty HUD once
  ensurePenaltyHud();
})();
