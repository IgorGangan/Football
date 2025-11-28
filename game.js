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
  // GK non OP: un po' più forte di prima, ma con errori + dive a cooldown
  const DIFF = {
    easy:   { botSpeed: 2.9, goalieSpeed: 2.6, botKick: 9.5,  error: 0.30, predict: 0.18, gkMistake: 0.26, gkReact: 0.22 },
    medium: { botSpeed: 4.8, goalieSpeed: 3.5, botKick: 12.2, error: 0.14, predict: 0.28, gkMistake: 0.17, gkReact: 0.14 },
    hard:   { botSpeed: 6.6, goalieSpeed: 4.6, botKick: 14.3, error: 0.05, predict: 0.38, gkMistake: 0.10, gkReact: 0.10 },
  };

  // ---------------- Gameplay tuning ----------------
  const PLAYER_R = 26;  // big players
  const GOALIE_R = 16;  // <-- richiesto
  const BALL_R   = 11;

  // Porta grande (già sistemata): se vuoi ancora più grande alza goalHalf
  const goalHalf = 125;
  const postR = 10;

  // Trick-shot boost sui rimbalzi
  const WALL_TRICK_BOOST = 1.12;   // +12% velocità dopo rimbalzo
  const MAX_BALL_SPEED   = 22.0;   // cap per non impazzire
  const BOUNCE_COOLDOWN  = 0.09;   // evita boost multipli nello stesso rimbalzo

  // Dive GK (tuffo)
  const DIVE_TIME = 0.18;            // durata tuffo
  const DIVE_COOLDOWN_MIN = 0.75;
  const DIVE_COOLDOWN_MAX = 1.35;

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
    leftSeq: [],
    rightSeq: [],
    turn: "left",
    shotLive: false,
    shotTimer: 0,
    uiLock: 0,
  };

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
    nameL.textContent = "LEFT"; nameR.textContent = "RIGHT";

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

  // ---------------- Input ----------------
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

  // ---------------- Field / goals ----------------
  const goalL = { x: 0, y1: H/2-goalHalf, y2: H/2+goalHalf, posts: [{x:0,y:H/2-goalHalf},{x:0,y:H/2+goalHalf}] };
  const goalR = { x: W, y1: H/2-goalHalf, y2: H/2+goalHalf, posts: [{x:W,y:H/2-goalHalf},{x:W,y:H/2+goalHalf}] };

  // keeper boxes
  const boxH = 260, boxW = 125;
  const boxL = { x: 0, y: H/2 - boxH/2, w: boxW, h: boxH };
  const boxR = { x: W - boxW, y: H/2 - boxH/2, w: boxW, h: boxH };

  // ---------------- Entities ----------------
  const P1 = { name:"P1", x:240, y:H/2, r:PLAYER_R, speed:5.35, color:"#1a66ff", lastDirX:1, lastDirY:0 };
  const P2 = { name:"P2", x:W-240, y:H/2, r:PLAYER_R, speed:5.35, color:"#ff9f1a", lastDirX:-1, lastDirY:0 };

  // Goalkeepers with dive-state
  const GK_L = {
    x:78, y:H/2, r:GOALIE_R, color:"#25e6ff",
    mistakeT:0, reactT:0,
    diveT:0, diveCd:0, diveY:H/2, diveUsed:false,
    ai: { speedMul:1, mistakeMul:1, reactMul:1, aimSlack:1, diveChance:1, divePower:1, styleBias:0 },
    pen: { planY:null, planX:null, react:0 }
  };
  const GK_R = {
    x:W-78, y:H/2, r:GOALIE_R, color:"#ff2d2d",
    mistakeT:0, reactT:0,
    diveT:0, diveCd:0, diveY:H/2, diveUsed:false,
    ai: { speedMul:1, mistakeMul:1, reactMul:1, aimSlack:1, diveChance:1, divePower:1, styleBias:0 },
    pen: { planY:null, planX:null, react:0 }
  };

  const ball = { x:W/2, y:H/2, r:BALL_R, vx:0, vy:0, trail:[], bounceCd:0 };

  // ---------------- Utils ----------------
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const dist = (ax,ay,bx,by)=>Math.hypot(bx-ax,by-ay);
  const lerp = (a,b,t)=>a+(b-a)*t;
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

  function clampBallSpeed(){
    const s = Math.hypot(ball.vx, ball.vy);
    if (s > MAX_BALL_SPEED) {
      const k = MAX_BALL_SPEED / (s || 1);
      ball.vx *= k; ball.vy *= k;
    }
  }

  // ---------------- Unique goalie brains ----------------
  function initGoalieBrains(){
    // Ogni GK diverso (anche stesso difficulty)
    // styleBias: (-1)=prudente, (0)=normale, (1)=aggressivo
    function rollAI(diff){
      let sMin,sMax,mMin,mMax,rMin,rMax,slMin,slMax, dcMin,dcMax, dpMin,dpMax;
      if (diff === "easy") {
        sMin=0.78; sMax=0.98;
        mMin=1.10; mMax=1.55;
        rMin=1.05; rMax=1.55;
        slMin=1.05; slMax=1.45;
        dcMin=0.85; dcMax=1.35; // dive chance
        dpMin=0.95; dpMax=1.30; // dive power
      } else if (diff === "hard") {
        sMin=0.88; sMax=1.12;
        mMin=0.85; mMax=1.20;
        rMin=0.85; rMax=1.15;
        slMin=0.95; slMax=1.20;
        dcMin=0.85; dcMax=1.25;
        dpMin=0.95; dpMax=1.30;
      } else {
        sMin=0.82; sMax=1.06;
        mMin=0.95; mMax=1.35;
        rMin=0.92; rMax=1.28;
        slMin=1.00; slMax=1.30;
        dcMin=0.85; dcMax=1.30;
        dpMin=0.95; dpMax=1.30;
      }
      const styleBias = rand(-1, 1); // personalità
      return {
        speedMul: rand(sMin,sMax),
        mistakeMul: rand(mMin,mMax),
        reactMul: rand(rMin,rMax),
        aimSlack: rand(slMin,slMax),
        diveChance: rand(dcMin,dcMax) * (0.95 + 0.25*Math.max(0, styleBias)),
        divePower:  rand(dpMin,dpMax) * (0.95 + 0.20*Math.max(0, styleBias)),
        styleBias
      };
    }

    const aL = rollAI(difficulty);
    const aR = rollAI(difficulty);

    Object.assign(GK_L.ai, aL);
    Object.assign(GK_R.ai, aR);

    // forziamo un po' di differenza (non identici)
    if (Math.abs(GK_L.ai.styleBias - GK_R.ai.styleBias) < 0.25) GK_R.ai.styleBias += 0.35 * (Math.random()<0.5?-1:1);
  }

  // ---------------- Reset ----------------
  function resetRound(){
    P1.x=240; P1.y=H/2;
    P2.x=W-240; P2.y=H/2;

    GK_L.x=78; GK_L.y=H/2;
    GK_R.x=W-78; GK_R.y=H/2;

    GK_L.mistakeT = GK_L.reactT = 0;
    GK_R.mistakeT = GK_R.reactT = 0;

    GK_L.diveT = 0; GK_L.diveCd = 0; GK_L.diveUsed=false;
    GK_R.diveT = 0; GK_R.diveCd = 0; GK_R.diveUsed=false;

    GK_L.pen.planX = GK_L.pen.planY = null; GK_L.pen.react = 0;
    GK_R.pen.planX = GK_R.pen.planY = null; GK_R.pen.react = 0;

    ball.x=W/2; ball.y=H/2;
    ball.vx=0; ball.vy=0;
    ball.trail=[];
    ball.bounceCd=0;
  }

  // ---------------- Collision / kick ----------------
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
    const s = Math.hypot(ball.vx, ball.vy);
    const ns = Math.min(MAX_BALL_SPEED, s * WALL_TRICK_BOOST);
    const k = ns / (s || 1);
    ball.vx *= k; ball.vy *= k;
    ball.bounceCd = BOUNCE_COOLDOWN;
  }

  function ballWalls(){
    let bounced = false;

    // top/bottom
    if (ball.y - ball.r < 0) { ball.y = ball.r; ball.vy = Math.abs(ball.vy)*0.98; bounced = true; }
    if (ball.y + ball.r > H) { ball.y = H - ball.r; ball.vy = -Math.abs(ball.vy)*0.98; bounced = true; }

    // left/right (only if NOT in goal mouth)
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

  // ---------------- Goalie bounds ----------------
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

  // ---------------- Goalie mistakes + dive ----------------
  function maybeTriggerGKBrain(dt, cfg, gk){
    const mistakeP = (cfg.gkMistake * gk.ai.mistakeMul);
    const reactP   = (cfg.gkReact   * gk.ai.reactMul);

    if (!inCountdown) {
      if (gk.mistakeT <= 0 && Math.random() < mistakeP * dt) gk.mistakeT = 0.45 + Math.random()*0.35;
      if (gk.reactT <= 0 && Math.random() < reactP * dt) gk.reactT = 0.12 + Math.random()*0.18;
    }
  }

  function maybeTriggerDiveNormal(dt, cfg, gk, isLeft){
    // cooldown & active time
    gk.diveCd = Math.max(0, gk.diveCd - dt);
    gk.diveT  = Math.max(0, gk.diveT  - dt);

    // se sta già tuffandosi, basta (movimento lo fa updateGoalies)
    if (gk.diveT > 0) return;

    // trigger dive solo se palla in arrivo veloce verso la porta
    const speed = Math.hypot(ball.vx, ball.vy);
    if (speed < 4.2) return;
    if (gk.diveCd > 0) return;

    const toward = isLeft ? (ball.vx < -1.7) : (ball.vx > 1.7);
    if (!toward) return;

    const nearGoal = isLeft ? (ball.x < W*0.36) : (ball.x > W*0.64);
    if (!nearGoal) return;

    const b = isLeft ? goalieBoundsLeft(gk) : goalieBoundsRight(gk);

    // prediction breve
    const look = 8 + cfg.predict*22;
    let py = ball.y + ball.vy * look;

    // stile: aggressivo tende a tuffarsi più spesso e più "verso la palla"
    py = lerp(H/2, py, 0.75 + 0.10*Math.max(0, gk.ai.styleBias));
    py = clamp(py, b.minY, b.maxY);

    // chance dive (moderata, non OP)
    const baseChance = (difficulty === "easy" ? 0.16 : difficulty === "hard" ? 0.14 : 0.15);
    const chance = clamp(baseChance * gk.ai.diveChance * (1.0 + 0.12*Math.max(0, gk.ai.styleBias)), 0.06, 0.28);

    if (Math.random() < chance) {
      gk.diveT = DIVE_TIME;
      gk.diveCd = rand(DIVE_COOLDOWN_MIN, DIVE_COOLDOWN_MAX);
      gk.diveY = py;
      gk.diveUsed = true;
    }
  }

  function applyDiveMovement(cfg, gk, tx, ty, diveMul){
    const s = cfg.goalieSpeed * (0.92 + 0.10*(gk.ai.speedMul-1)) * diveMul;
    gk.x += clamp(tx - gk.x, -s, s);
    gk.y += clamp(ty - gk.y, -s, s);
  }

  // ---------------- Goalies update (NORMAL MATCH) ----------------
  function updateGoalies(dt){
    const cfg = (gameMode === "bot") ? (DIFF[difficulty] || DIFF.medium) : DIFF.medium;

    GK_L.mistakeT = Math.max(0, GK_L.mistakeT - dt);
    GK_R.mistakeT = Math.max(0, GK_R.mistakeT - dt);
    GK_L.reactT = Math.max(0, GK_L.reactT - dt);
    GK_R.reactT = Math.max(0, GK_R.reactT - dt);

    maybeTriggerGKBrain(dt, cfg, GK_L);
    maybeTriggerGKBrain(dt, cfg, GK_R);

    // dives
    maybeTriggerDiveNormal(dt, cfg, GK_L, true);
    maybeTriggerDiveNormal(dt, cfg, GK_R, false);

    const bL = goalieBoundsLeft(GK_L);
    const bR = goalieBoundsRight(GK_R);

    // base tracking (non perfetto)
    const slackL = GK_L.ai.aimSlack;
    const slackR = GK_R.ai.aimSlack;

    let tLX = clamp(ball.x, bL.minX, bL.maxX);
    let tLY = clamp(ball.y, bL.minY, bL.maxY);
    tLX = lerp(bL.minX + 22, tLX, 0.48);
    tLY = lerp(H/2, tLY, 0.60);

    let tRX = clamp(ball.x, bR.minX, bR.maxX);
    let tRY = clamp(ball.y, bR.minY, bR.maxY);
    tRX = lerp(bR.maxX - 22, tRX, 0.48);
    tRY = lerp(H/2, tRY, 0.60);

    if (GK_L.mistakeT > 0) {
      tLY = clamp(tLY + (Math.random()-0.5)*90*slackL, bL.minY, bL.maxY);
      tLX = clamp(tLX + (Math.random()-0.5)*55*slackL, bL.minX, bL.maxX);
    }
    if (GK_R.mistakeT > 0) {
      tRY = clamp(tRY + (Math.random()-0.5)*90*slackR, bR.minY, bR.maxY);
      tRX = clamp(tRX + (Math.random()-0.5)*55*slackR, bR.minX, bR.maxX);
    }

    if (GK_L.reactT > 0) { tLX = GK_L.x; tLY = GK_L.y; }
    if (GK_R.reactT > 0) { tRX = GK_R.x; tRY = GK_R.y; }

    // if diving, override Y target partially (tuffo)
    if (GK_L.diveT > 0) tLY = lerp(tLY, GK_L.diveY, 0.85);
    if (GK_R.diveT > 0) tRY = lerp(tRY, GK_R.diveY, 0.85);

    // dive multiplier: short burst, not too much
    const diveMulL = (GK_L.diveT > 0) ? (1.55 * GK_L.ai.divePower) : (0.98 * GK_L.ai.speedMul);
    const diveMulR = (GK_R.diveT > 0) ? (1.55 * GK_R.ai.divePower) : (0.98 * GK_R.ai.speedMul);

    applyDiveMovement(cfg, GK_L, tLX, tLY, diveMulL);
    applyDiveMovement(cfg, GK_R, tRX, tRY, diveMulR);

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
    pen.uiLock = 0.40;

    ball.vx = 0; ball.vy = 0;
    ball.trail = [];
    ball.bounceCd = 0;

    GK_L.mistakeT = GK_L.reactT = 0;
    GK_R.mistakeT = GK_R.reactT = 0;

    GK_L.diveT = 0; GK_L.diveCd = 0; GK_L.diveUsed=false;
    GK_R.diveT = 0; GK_R.diveCd = 0; GK_R.diveUsed=false;

    GK_L.pen.planX = GK_L.pen.planY = null; GK_L.pen.react = 0;
    GK_R.pen.planX = GK_R.pen.planY = null; GK_R.pen.react = 0;

    const spotOffset = 350;
    const kickerOffset = 165;

    if (pen.turn === "left") {
      const bx = W - spotOffset;
      const by = H/2;

      ball.x = bx; ball.y = by;
      P1.x = bx - kickerOffset; P1.y = by;
      P2.x = bx - 300; P2.y = by;

      GK_R.x = W - 78; GK_R.y = H/2;
      GK_L.x = 78; GK_L.y = H/2;

      setOverlay(`${P1.name.toUpperCase()} KICKS`, true);
    } else {
      const bx = spotOffset;
      const by = H/2;

      ball.x = bx; ball.y = by;
      P2.x = bx + kickerOffset; P2.y = by;
      P1.x = bx + 300; P1.y = by;

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

  function planPenaltySave(goalie, cfg){
    const b = (goalie === GK_L) ? goalieBoundsLeft(goalie) : goalieBoundsRight(goalie);

    const predY = clamp(ball.y + ball.vy * 18, b.minY, b.maxY);
    const predX = clamp(ball.x + ball.vx * 12, b.minX, b.maxX);

    // non impossibile segnare: porta grande + gk umano
    const mistakeChance = clamp(cfg.gkMistake * goalie.ai.mistakeMul * 2.1, 0, 0.62);

    let planY = predY;
    let planX = predX;

    if (Math.random() < mistakeChance) {
      const off = (Math.random()<0.5?-1:1) * (95 + Math.random()*115);
      planY = clamp(predY + off, b.minY, b.maxY);
      planX = clamp(predX + (Math.random()-0.5)*80, b.minX, b.maxX);
    } else {
      planY = clamp(predY + (Math.random()-0.5)*65*goalie.ai.aimSlack, b.minY, b.maxY);
      planX = clamp(predX + (Math.random()-0.5)*45*goalie.ai.aimSlack, b.minX, b.maxX);
    }

    goalie.pen.planY = planY;
    goalie.pen.planX = planX;

    // reaction delay + diverge per GK
    const reactBase = 0.18;
    const reactJit  = 0.24;
    goalie.pen.react = (reactBase + Math.random()*reactJit) * goalie.ai.reactMul;

    // decide se farà un tuffo secco verso planY (chance per GK)
    goalie.diveUsed = false;
  }

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

      ax += kicker.lastDirX * 185;
      ay += kicker.lastDirY * 185;

      const botKicker = (gameMode === "bot" && kicker === P2);
      const spread = botKicker ? cfg.error : 0.08;
      ay += (Math.random() - 0.5) * 190 * spread;

      const ad = Math.hypot(ax, ay) || 1;
      ax /= ad; ay /= ad;

      const power = botKicker ? (cfg.botKick + 2.2) : 13.8;
      ball.vx = ax * power;
      ball.vy = ay * power;
      clampBallSpeed();

      const goalie = penaltyGoalie();
      planPenaltySave(goalie, cfg);
    }
  }

  function updatePenaltyGoalie(dt){
    const cfg = (gameMode === "bot") ? (DIFF[difficulty] || DIFF.medium) : DIFF.medium;
    const goalie = penaltyGoalie();
    const b = (goalie === GK_L) ? goalieBoundsLeft(goalie) : goalieBoundsRight(goalie);

    // pre-shot: torna centro
    if (!pen.shotLive) {
      const tx = (goalie === GK_L) ? (b.minX + 25) : (b.maxX - 25);
      const ty = H/2;

      goalie.diveCd = Math.max(0, goalie.diveCd - dt);
      goalie.diveT  = Math.max(0, goalie.diveT - dt);

      const s = cfg.goalieSpeed * 0.72 * goalie.ai.speedMul;
      goalie.x += clamp(tx - goalie.x, -s, s);
      goalie.y += clamp(ty - goalie.y, -s, s);
      goalie.x = clamp(goalie.x, b.minX, b.maxX);
      goalie.y = clamp(goalie.y, b.minY, b.maxY);
      return;
    }

    // during shot: reaction delay
    goalie.pen.react = Math.max(0, goalie.pen.react - dt);
    if (goalie.pen.react > 0) return;

    // dive trigger once (not always)
    goalie.diveCd = Math.max(0, goalie.diveCd - dt);
    goalie.diveT  = Math.max(0, goalie.diveT  - dt);

    if (!goalie.diveUsed && goalie.diveCd <= 0) {
      const base = (difficulty === "easy" ? 0.20 : difficulty === "hard" ? 0.18 : 0.19);
      const chance = clamp(base * goalie.ai.diveChance, 0.10, 0.34);
      if (Math.random() < chance) {
        goalie.diveUsed = true;
        goalie.diveT = DIVE_TIME;
        goalie.diveCd = rand(DIVE_COOLDOWN_MIN, DIVE_COOLDOWN_MAX);
        goalie.diveY = clamp(goalie.pen.planY ?? H/2, b.minY, b.maxY);
      }
    }

    // follow plan (can be wrong), if diving -> lock more to diveY
    let tx = goalie.pen.planX ?? clamp(ball.x, b.minX, b.maxX);
    let ty = goalie.pen.planY ?? clamp(ball.y, b.minY, b.maxY);

    if (goalie.diveT > 0) ty = lerp(ty, goalie.diveY, 0.92);

    if (goalie === GK_L) tx = lerp(b.minX + 16, tx, 0.72);
    else tx = lerp(b.maxX - 16, tx, 0.72);

    const diveMul = goalie.diveT > 0 ? (1.70 * goalie.ai.divePower) : (1.05 * goalie.ai.speedMul);
    const s = cfg.goalieSpeed * 0.78 * diveMul;

    goalie.x += clamp(tx - goalie.x, -s, s);
    goalie.y += clamp(ty - goalie.y, -s, s);

    goalie.x = clamp(goalie.x, b.minX, b.maxX);
    goalie.y = clamp(goalie.y, b.minY, b.maxY);

    resolveBallCircle(goalie, 9.4);
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
      const timeout = pen.shotTimer > 4.1;

      if (goalScored) { setOverlay("GOAL!", true); finishPenaltyShot(true); }
      else if (slow || timeout) { setOverlay("MISS!", true); finishPenaltyShot(false); }
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

  // ---------------- MAIN LOOP ----------------
  let lastT = 0;
  function loop(t){
    if (!running) return;
    const dt = Math.min(0.033, (t - lastT) / 1000 || 0.016);
    lastT = t;

    if (!pausedByMenu) {
      // cooldown bounce
      ball.bounceCd = Math.max(0, ball.bounceCd - dt);

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

          // ball physics
          ball.x += ball.vx;
          ball.y += ball.vy;
          ball.vx *= 0.992;
          ball.vy *= 0.992;

          ball.trail.push({x:ball.x,y:ball.y});
          if (ball.trail.length > 16) ball.trail.shift();

          ballWalls();
          for (const p of goalL.posts) resolvePost(p);
          for (const p of goalR.posts) resolvePost(p);

          // collisions: players stronger, GK medium
          resolveBallCircle(P1, 13.2);
          resolveBallCircle(P2, (gameMode === "bot") ? (DIFF[difficulty]?.botKick || 12) : 13.2);
          resolveBallCircle(GK_L, 10.0);
          resolveBallCircle(GK_R, 10.0);

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

  // ---------------- Init ----------------
  canvas.style.display = "none";
  hud.style.display = "none";
  resultModal.style.display = "none";
  mobileControls.style.display = "none";
  setOverlay("", false);

  ensurePenaltyHud();
})();
