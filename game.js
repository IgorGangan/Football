(() => {
  // ============================================================
  // 2D Soccer - Single file game.js
  // Requires these IDs in HTML:
  // gameCanvas, menu, playBtn, homeBtn, hud, overlayText,
  // modeSelect, p1Name, p2Name, p2NameWrap, diffWrap, difficulty, matchTime,
  // hudP1, hudP2, scoreText, modeText, diffText, timeText,
  // resultModal, resultTitle, resultScore, resultLine, againBtn, homeBtn2,
  // mobileControls, joy1Base, joy1Knob, joy2Wrap, joy2Base, joy2Knob
  // ============================================================

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
  // (if your HUD has no penalty dots, it's still fine)
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
  // GK stronger than before, but human (mistakes, reaction, wrong guesses)
  const DIFF = {
    easy: {
      botSpeed: 2.9, botKick: 9.5,  error: 0.30, predict: 0.18,
      gkBaseSpeed: 3.0, gkReact: 0.22, gkMistake: 0.22, gkDiveAggro: 0.65, penWrong: 0.38
    },
    medium: {
      botSpeed: 4.8, botKick: 12.2, error: 0.14, predict: 0.28,
      gkBaseSpeed: 3.8, gkReact: 0.14, gkMistake: 0.14, gkDiveAggro: 0.78, penWrong: 0.28
    },
    hard: {
      botSpeed: 6.6, botKick: 14.3, error: 0.05, predict: 0.38,
      gkBaseSpeed: 4.7, gkReact: 0.10, gkMistake: 0.09, gkDiveAggro: 0.92, penWrong: 0.18
    },
  };

  // ---------------- Sizes ----------------
  const PLAYER_R = 26;
  const GOALIE_R = 18; // <-- richiesto
  const BALL_R   = 11;

  // ---------------- Field / goal ----------------
  const goalHalf = 125; // big goals
  const postR = 10;
  const goalL = { x: 0, y1: H/2-goalHalf, y2: H/2+goalHalf, posts: [{x:0,y:H/2-goalHalf},{x:0,y:H/2+goalHalf}] };
  const goalR = { x: W, y1: H/2-goalHalf, y2: H/2+goalHalf, posts: [{x:W,y:H/2-goalHalf},{x:W,y:H/2+goalHalf}] };

  // GK boxes
  const boxH = 270, boxW = 135;
  const boxL = { x: 0, y: H/2 - boxH/2, w: boxW, h: boxH };
  const boxR = { x: W - boxW, y: H/2 - boxH/2, w: boxW, h: boxH };

  // ---------------- Trick shot walls boost ----------------
  const WALL_TRICK_BOOST = 1.14; // +14% per bounce
  const MAX_BALL_SPEED = 24.0;
  const BOUNCE_CD = 0.10;

  // ---------------- Dive params ----------------
  const DIVE_TIME = 0.18;
  const DIVE_COOLDOWN_MIN = 0.75;
  const DIVE_COOLDOWN_MAX = 1.25;
  const DIVE_BURST = 1.75; // how strong the dive move feels (not OP)

  // ---------------- Game state ----------------
  let running = false;
  let pausedByMenu = true;
  let inCountdown = false;
  let countdownTimer = null;

  let gameMode = "bot";       // "bot" or "2p"
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
    leftSeq: [],
    rightSeq: [],
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
      // human behavior timers
      mistakeT: 0,
      reactT: 0,
      // dive state
      diveT: 0,
      diveCd: 0,
      diveY: H/2,
      // trail while diving
      diveTrail: [],
      // personality (different brains)
      ai: {
        speedMul: 1,
        reactMul: 1,
        mistakeMul: 1,
        slack: 1,
        aggro: 1,
        // penalties
        penWrong: 0.25,
        penCommit: 0.65,
        // style bias
        style: 0, // -1 safe, +1 aggressive
      },
      // penalty plan
      pen: { planY:null, planX:null, react:0, committed:false },
    };
  }

  // ---------------- Utils ----------------
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const dist = (ax,ay,bx,by)=>Math.hypot(bx-ax,by-ay);
  const lerp = (a,b,t)=>a + (b-a)*t;
  const rand = (a,b)=>a + Math.random()*(b-a);

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

  function getBallSpeed(){
    return Math.hypot(ball.vx, ball.vy);
  }
  function clampBallSpeed(){
    const s = getBallSpeed();
    if (s > MAX_BALL_SPEED) {
      const k = MAX_BALL_SPEED / (s || 1);
      ball.vx *= k; ball.vy *= k;
    }
  }

  // ---------------- INPUT (keyboard) ----------------
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

  const isTouchDevice = () => ("ontouchstart" in window || navigator.maxTouchPoints > 0);

  // ---------------- Penalty HUD ----------------
  let penHudWrap, penRowL, penRowR, penDotsL, penDotsR;
  function ensurePenaltyHud(){
    if (penHudWrap) return;
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

  // ---------------- Boxes / bounds ----------------
  function goalieBounds(gk){
    const b = gk.isLeft ? boxL : boxR;
    return {
      minX: b.x + gk.r + 6,
      maxX: b.x + b.w - gk.r - 6,
      minY: b.y + gk.r + 6,
      maxY: b.y + b.h - gk.r - 6,
    };
  }

  // ---------------- Brain init (each GK unique) ----------------
  function initGoalieBrains(){
    const cfg = DIFF[difficulty] || DIFF.medium;

    function roll(gk){
      // style: + = aggressive (dives more), - = safe
      const style = rand(-1, 1);

      // stronger but human
      const speedMul   = rand(0.92, 1.10) * (1 + 0.06*Math.max(0, style));
      const reactMul   = rand(0.90, 1.22) * (1 + 0.10*Math.max(0, -style)); // safe reacts a bit earlier sometimes
      const mistakeMul = rand(0.90, 1.35) * (1 + 0.10*Math.max(0, style));  // aggressive can overcommit => mistakes
      const slack      = rand(0.95, 1.35); // aim looseness

      const aggro      = rand(0.90, 1.15) * (1 + 0.15*Math.max(0, style));
      const penWrong   = clamp(cfg.penWrong * rand(0.85, 1.20) * (1 + 0.10*Math.max(0, style)), 0.08, 0.48);
      const penCommit  = clamp(0.64 + 0.12*style + rand(-0.08, 0.08), 0.45, 0.85);

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

    // ensure they don't feel identical
    if (Math.abs(GK_L.ai.style - GK_R.ai.style) < 0.25) GK_R.ai.style += (Math.random()<0.5?-1:1)*0.35;
  }

  // ---------------- Reset ----------------
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

  function resetGoalieState(gk){
    gk.mistakeT = 0;
    gk.reactT = 0;
    gk.diveT = 0;
    gk.diveCd = 0;
    gk.diveY = H/2;
    gk.diveTrail = [];
    gk.pen.planX = gk.pen.planY = null;
    gk.pen.react = 0;
    gk.pen.committed = false;
  }

  // ---------------- Ball collisions ----------------
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
    const s = kickStrength + cur * 0.18;

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

  // ---------------- Rendering ----------------
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
    for (let i=0;i<gk.diveTrail.length;i++){
      const p = gk.diveTrail[i];
      const a = i / gk.diveTrail.length;
      const alpha = 0.04 + a * 0.62;

      // colored "stripe"
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6 + a*6, 0, Math.PI*2);
      const rgb = hexToRgb(gk.color) || {r:255,g:255,b:255};
      ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha*0.38})`;
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
    // GK dive stripe behind them
    drawGoalieDiveTrail(GK_L);
    drawGoalieDiveTrail(GK_R);

    drawCircle(P1.x,P1.y,P1.r,P1.color);
    drawCircle(P2.x,P2.y,P2.r,P2.color);
    drawCircle(GK_L.x,GK_L.y,GK_L.r,GK_L.color);
    drawCircle(GK_R.x,GK_R.y,GK_R.r,GK_R.color);
    drawCircle(ball.x,ball.y,ball.r,"white");
  }

  function hexToRgb(hex){
    // supports "#rrggbb"
    if (!hex || typeof hex !== "string") return null;
    const h = hex.trim();
    if (!/^#([0-9a-fA-F]{6})$/.test(h)) return null;
    return {
      r: parseInt(h.slice(1,3),16),
      g: parseInt(h.slice(3,5),16),
      b: parseInt(h.slice(5,7),16),
    };
  }

  // ---------------- Player inputs ----------------
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

  // ---------------- Goalkeepers "real" logic ----------------
  function maybeTriggerHumanTimers(dt, cfg, gk){
    gk.mistakeT = Math.max(0, gk.mistakeT - dt);
    gk.reactT   = Math.max(0, gk.reactT   - dt);

    // mistake windows: aim is looser / jitter
    const mChance = cfg.gkMistake * gk.ai.mistakeMul;
    const rChance = cfg.gkReact   * gk.ai.reactMul;

    if (!inCountdown && !pen.active) {
      if (gk.mistakeT <= 0 && Math.random() < mChance * dt) gk.mistakeT = 0.35 + Math.random()*0.30;
      if (gk.reactT   <= 0 && Math.random() < rChance * dt) gk.reactT   = 0.10 + Math.random()*0.14;
    }
  }

  // Predict where ball crosses a vertical x (goal line-ish)
  function predictBallYAtX(targetX){
    // If vx is ~0, can't predict well
    if (Math.abs(ball.vx) < 0.0001) return ball.y;
    const t = (targetX - ball.x) / ball.vx;
    // only look forward in time
    if (t < 0) return ball.y;
    return ball.y + ball.vy * t;
  }

  function shouldDiveAtGoal(gk, cfg){
    // only dive if ball is fast AND going toward this goal AND close enough
    const s = getBallSpeed();
    if (s < 4.8) return false;

    const toward = gk.isLeft ? (ball.vx < -1.3) : (ball.vx > 1.3);
    if (!toward) return false;

    const near = gk.isLeft ? (ball.x < W*0.40) : (ball.x > W*0.60);
    if (!near) return false;

    if (gk.diveCd > 0 || gk.diveT > 0) return false;

    // if ball path would cross in/near goal mouth, dive more
    const goalX = gk.isLeft ? 0 : W;
    const py = predictBallYAtX(goalX);
    const inMouth = (py >= (H/2 - goalHalf - 30) && py <= (H/2 + goalHalf + 30));

    // aggressiveness by difficulty + personality
    const baseChance = 0.14 + 0.10*(cfg.gkDiveAggro - 0.65); // from cfg
    const styleBoost = 0.06*Math.max(0, gk.ai.style);
    const mouthBoost = inMouth ? 0.10 : 0.00;

    const chance = clamp((baseChance + styleBoost + mouthBoost) * gk.ai.aggro, 0.08, 0.34);

    return Math.random() < chance;
  }

  function startDive(gk, yTarget){
    const b = goalieBounds(gk);
    gk.diveT = DIVE_TIME;
    gk.diveCd = rand(DIVE_COOLDOWN_MIN, DIVE_COOLDOWN_MAX);
    gk.diveY = clamp(yTarget, b.minY, b.maxY);

    // add stripe instantly
    gk.diveTrail.unshift({x:gk.x, y:gk.y});
    if (gk.diveTrail.length > 18) gk.diveTrail.length = 18;
  }

  function updateGoalieDiveStripe(dt, gk){
    // keep fade trail
    if (gk.diveTrail.length) {
      // slow decay
      if (gk.diveT <= 0) {
        // fade out quicker when not diving
        if (Math.random() < 0.28) gk.diveTrail.shift();
      }
    }
    // while diving, keep adding points
    if (gk.diveT > 0) {
      gk.diveTrail.push({x:gk.x, y:gk.y});
      if (gk.diveTrail.length > 24) gk.diveTrail.shift();
    }
  }

  function updateGoalieNormal(dt, cfg, gk){
    const b = goalieBounds(gk);

    gk.diveCd = Math.max(0, gk.diveCd - dt);
    gk.diveT  = Math.max(0, gk.diveT  - dt);

    maybeTriggerHumanTimers(dt, cfg, gk);

    // react delay: sometimes freeze
    if (gk.reactT > 0) {
      updateGoalieDiveStripe(dt, gk);
      return;
    }

    const goalX = gk.isLeft ? 0 : W;

    // 'smart' target:
    // - if ball toward you: aim predicted crossing near goal line
    // - else: return closer to center of box
    const toward = gk.isLeft ? (ball.vx < -0.5) : (ball.vx > 0.5);
    const veryToward = gk.isLeft ? (ball.vx < -1.2) : (ball.vx > 1.2);

    let tx = gk.isLeft ? (b.minX + 20) : (b.maxX - 20);
    let ty = H/2;

    if (toward) {
      const predY = predictBallYAtX(goalX);
      // clamp inside box and inside goal-mouth-ish
      ty = clamp(predY, b.minY, b.maxY);

      // slight "smart" tracking to ball too (not only intercept)
      const mixBall = clamp(0.28 + 0.15*cfg.gkDiveAggro, 0.25, 0.55);
      ty = lerp(ty, clamp(ball.y, b.minY, b.maxY), mixBall);
    } else {
      // when ball far: go home but still follow a bit
      ty = lerp(H/2, clamp(ball.y, b.minY, b.maxY), 0.18 + 0.10*Math.max(0,gk.ai.style));
    }

    // mistakes: jitter
    if (gk.mistakeT > 0) {
      const jitter = (Math.random()-0.5) * (70 * gk.ai.slack);
      ty = clamp(ty + jitter, b.minY, b.maxY);
    }

    // decide dive
    if (veryToward && shouldDiveAtGoal(gk, cfg)) {
      // dive to predicted intercept or slightly offset (human)
      let diveY = ty;
      if (Math.random() < (0.12 * gk.ai.mistakeMul)) {
        diveY = clamp(diveY + (Math.random()<0.5?-1:1) * (45 + Math.random()*55), b.minY, b.maxY);
      }
      startDive(gk, diveY);
    }

    // if diving: big Y burst toward diveY
    if (gk.diveT > 0) {
      const s = cfg.gkBaseSpeed * gk.ai.speedMul * DIVE_BURST;
      gk.y += clamp(gk.diveY - gk.y, -s, s);
      // keep a bit of X stability
      const xHome = gk.isLeft ? (b.minX + 20) : (b.maxX - 20);
      gk.x += clamp(xHome - gk.x, -s*0.6, s*0.6);
    } else {
      // normal movement: decent but not OP
      const s = cfg.gkBaseSpeed * gk.ai.speedMul;
      gk.x += clamp(tx - gk.x, -s, s);
      gk.y += clamp(ty - gk.y, -s, s);
    }

    gk.x = clamp(gk.x, b.minX, b.maxX);
    gk.y = clamp(gk.y, b.minY, b.maxY);

    updateGoalieDiveStripe(dt, gk);
  }

  function updateGoalkeepers(dt){
    const cfg = (DIFF[difficulty] || DIFF.medium);

    // in penalties: only one GK is active (defender)
    if (pen.active) return;

    updateGoalieNormal(dt, cfg, GK_L);
    updateGoalieNormal(dt, cfg, GK_R);
  }

  // ---------------- Bot AI (opponent player) ----------------
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

  // ---------------- Goals & scoring ----------------
  function checkGoals(){
    // ball left out of bounds through goal mouth => goal for right
    if (ball.x + ball.r < -2 && ball.y >= goalL.y1 && ball.y <= goalL.y2){
      scoreRight++; setScoreUI(); goalMoment("GOAL!");
    }
    // ball right out of bounds through goal mouth => goal for left
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

    // spawn farther
    const spotOffset = 360;
    const kickerOffset = 175;

    const goalie = penaltyGoalie();
    const g = penaltyGoal();

    // goalie starts centered
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

    // goalie pre-plan (CAN BE WRONG)
    planPenaltyGoalie(goalie, DIFF[difficulty] || DIFF.medium, g);

    renderPenaltyDots();
    setTimeout(() => setOverlay("", false), 650);
  }

  function planPenaltyGoalie(goalie, cfg, g){
    const b = goalieBounds(goalie);

    // where would a "perfect" body want to go?
    const centerY = (g.y1 + g.y2) / 2;
    let planY = clamp(centerY, b.minY, b.maxY);

    // decide if goalie commits or waits (human)
    goalie.pen.committed = (Math.random() < goalie.ai.penCommit);

    // wrong-side guess chance based on difficulty + personality
    const wrong = (Math.random() < goalie.ai.penWrong);

    // if committed, pick a side (left/right of goal mouth)
    const side = (Math.random() < 0.5) ? -1 : 1;
    const offset = (55 + Math.random()*70) * side;

    if (goalie.pen.committed) {
      // choose a dy target
      planY = clamp(centerY + (wrong ? -offset : offset), b.minY, b.maxY);
      // sometimes even more wrong (fun)
      if (wrong && Math.random() < 0.35) planY = clamp(planY + (Math.random()<0.5?-1:1)*70, b.minY, b.maxY);
    } else {
      // not committed: still can be sloppy
      planY = clamp(centerY + (Math.random()-0.5)*60*goalie.ai.slack, b.minY, b.maxY);
    }

    goalie.pen.planY = planY;
    goalie.pen.planX = goalie.isLeft ? (b.minX + 20) : (b.maxX - 20);

    // reaction delay (human)
    const reactBase = cfg.gkReact * goalie.ai.reactMul;
    goalie.pen.react = clamp(reactBase + Math.random()*0.22, 0.06, 0.45);
  }

  function tryTriggerPenaltyShot(){
    if (pen.shotLive || pen.uiLock > 0) return;

    const kicker = penaltyKicker();
    const d = dist(kicker.x, kicker.y, ball.x, ball.y);
    if (d >= kicker.r + ball.r + 8) return;

    pen.shotLive = true;
    pen.shotTimer = 0;

    const cfg = (DIFF[difficulty] || DIFF.medium);
    const g = penaltyGoal();
    const goalCenterY = (g.y1 + g.y2) / 2;
    const goalX = g.x;

    // aim by approach angle, plus small randomness
    let ax = goalX - ball.x;
    let ay = goalCenterY - ball.y;

    ax += kicker.lastDirX * 190;
    ay += kicker.lastDirY * 190;

    const botKicker = (gameMode === "bot" && kicker === P2);
    const spread = botKicker ? cfg.error : 0.10;
    ay += (Math.random()-0.5) * 210 * spread;

    const ad = Math.hypot(ax,ay) || 1;
    ax /= ad; ay /= ad;

    const power = botKicker ? (cfg.botKick + 2.0) : 13.8;
    ball.vx = ax * power;
    ball.vy = ay * power;
    clampBallSpeed();

    // goalie also may decide to dive once shot starts
    const goalie = penaltyGoalie();
    if (goalie.pen.committed) {
      // commit dive to planY
      startDive(goalie, goalie.pen.planY ?? H/2);
    }
  }

  function updatePenaltyGoalie(dt){
    const cfg = (DIFF[difficulty] || DIFF.medium);
    const goalie = penaltyGoalie();
    const b = goalieBounds(goalie);

    // cooldown/dive
    goalie.diveCd = Math.max(0, goalie.diveCd - dt);
    goalie.diveT  = Math.max(0, goalie.diveT  - dt);

    // pre-shot: stay centered-ish
    if (!pen.shotLive) {
      const tx = goalie.isLeft ? (b.minX + 20) : (b.maxX - 20);
      const ty = lerp(H/2, goalie.pen.planY ?? H/2, goalie.pen.committed ? 0.20 : 0.08);

      const s = (cfg.gkBaseSpeed * goalie.ai.speedMul) * 0.70;
      goalie.x += clamp(tx - goalie.x, -s, s);
      goalie.y += clamp(ty - goalie.y, -s, s);

      goalie.x = clamp(goalie.x, b.minX, b.maxX);
      goalie.y = clamp(goalie.y, b.minY, b.maxY);

      updateGoalieDiveStripe(dt, goalie);
      return;
    }

    goalie.pen.react = Math.max(0, goalie.pen.react - dt);
    if (goalie.pen.react > 0) {
      updateGoalieDiveStripe(dt, goalie);
      return;
    }

    // during shot: either track or commit
    let tx = goalie.isLeft ? (b.minX + 20) : (b.maxX - 20);
    let ty;

    if (goalie.pen.committed) {
      ty = goalie.diveT > 0 ? goalie.diveY : (goalie.pen.planY ?? H/2);
      // if not already diving, start a late dive sometimes
      if (goalie.diveT <= 0 && Math.random() < 0.20) startDive(goalie, ty);
    } else {
      // tracking: predict approx at goal line
      const goalX = goalie.isLeft ? 0 : W;
      let predY = predictBallYAtX(goalX);
      predY = clamp(predY, b.minY, b.maxY);
      // human looseness
      predY = clamp(predY + (Math.random()-0.5)*55*goalie.ai.slack*(cfg.gkMistake*5.2), b.minY, b.maxY);
      ty = predY;

      // occasional dive even without commit
      if (goalie.diveT <= 0 && goalie.diveCd <= 0 && getBallSpeed() > 6.0 && Math.random() < 0.18*cfg.gkDiveAggro) {
        startDive(goalie, ty);
      }
    }

    // movement
    if (goalie.diveT > 0) {
      const s = cfg.gkBaseSpeed * goalie.ai.speedMul * (DIVE_BURST * 1.12);
      goalie.y += clamp(ty - goalie.y, -s, s);
      goalie.x += clamp(tx - goalie.x, -s*0.55, s*0.55);
    } else {
      const s = cfg.gkBaseSpeed * goalie.ai.speedMul * 0.95;
      goalie.x += clamp(tx - goalie.x, -s, s);
      goalie.y += clamp(ty - goalie.y, -s, s);
    }

    goalie.x = clamp(goalie.x, b.minX, b.maxX);
    goalie.y = clamp(goalie.y, b.minY, b.maxY);

    updateGoalieDiveStripe(dt, goalie);

    // save collision (stronger but not OP)
    resolveBallCircle(goalie, 11.2);
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

  // ---------------- Main gameplay update ----------------
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
    // player kicks strong
    resolveBallCircle(P1, 13.4);
    resolveBallCircle(P2, (gameMode === "bot") ? (DIFF[difficulty]?.botKick || 12) : 13.4);

    // goalies: solid saves but not always
    resolveBallCircle(GK_L, 11.2);
    resolveBallCircle(GK_R, 11.2);
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
          // only kicker moves freely in penalties (feels clean)
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

      // draw
      drawField();
      drawBallTrail();
      drawEntities();
    }

    requestAnimationFrame(loop);
  }

  // ---------------- UI & start ----------------
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

    initGoalieBrains();

    pen.active = false;
    pen.leftSeq = [];
    pen.rightSeq = [];
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

    initGoalieBrains();

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

  // ---------------- init hidden ----------------
  canvas.style.display = "none";
  hud.style.display = "none";
  resultModal.style.display = "none";
  mobileControls.style.display = "none";
  setOverlay("", false);

  ensurePenaltyHud();
})();
