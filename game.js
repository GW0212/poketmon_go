// ============================================================
// POKEMON GO WEB CLONE - Main Game Logic
// ============================================================

const TILE = 40;
const COLS = 40, ROWS = 40;
const MAP_W = COLS * TILE, MAP_H = ROWS * TILE;

const T = { GRASS: 0, DEEP_GRASS: 1, WATER: 2, PATH: 3, BUILDING: 4, POKESTOP: 5, GYM: 6, SAND: 7 };
const TILE_COLORS = ['#5DBB4D','#4CAF50','#4FC3F7','#D2B48C','#9E9E9E','#42A5F5','#FFD600','#F4E4BC'];

const state = {
  player: { x: 20 * TILE, y: 20 * TILE, speed: 3, name: '트레이너', level: 1, xp: 0, xpMax: 100 },
  cam: { x: 0, y: 0 },
  map: [],
  wildPokemon: [],
  pokestops: [],
  gyms: [],
  caught: {},
  bag: { pokeball: 20, greatball: 5, ultraball: 2 },
  totalCaught: 0,
  totalWalked: 0,
  keys: {},
  currentScreen: 'map',
  currentEncounter: null,
  selectedBall: 'pokeball',
  spawnTimer: 0,
  radarPokemon: [],
  lastPos: null,
};

// ---- MAP GENERATION ----
function generateMap() {
  const map = Array.from({ length: ROWS }, () => Array(COLS).fill(T.GRASS));

  let rx = 5;
  for (let r = 0; r < ROWS; r++) {
    map[r][rx] = T.WATER;
    map[r][rx+1] = T.WATER;
    if (Math.random() < 0.15) rx = Math.max(2, Math.min(COLS-4, rx + (Math.random()<0.5?1:-1)));
  }

  for (let c = 0; c < COLS; c++) { map[10][c] = T.PATH; map[30][c] = T.PATH; }
  for (let r = 0; r < ROWS; r++) { map[r][20] = T.PATH; }

  for (let i = 0; i < 30; i++) {
    const pr = Math.floor(Math.random() * ROWS), pc = Math.floor(Math.random() * COLS);
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const nr = pr+dr, nc = pc+dc;
      if (nr>=0&&nr<ROWS&&nc>=0&&nc<COLS&&map[nr][nc]===T.GRASS) map[nr][nc] = T.DEEP_GRASS;
    }
  }

  const bldgs = [[3,3],[3,8],[8,3],[15,15],[25,8],[32,25],[8,32],[28,32]];
  for (const [r,c] of bldgs) {
    for (let dr=0;dr<3;dr++) for (let dc=0;dc<3;dc++) {
      if (r+dr<ROWS&&c+dc<COLS) map[r+dr][c+dc]=T.BUILDING;
    }
  }

  for (let c=0;c<COLS;c++) { if(map[ROWS-1][c]===T.GRASS)map[ROWS-1][c]=T.SAND; if(map[ROWS-2][c]===T.GRASS)map[ROWS-2][c]=T.SAND; }

  const stops = [[5,25],[15,8],[28,18],[12,30],[22,5],[35,12]];
  const gymsPos = [[20,20],[8,15],[32,32]];
  for (const [r,c] of stops) { map[r][c]=T.POKESTOP; state.pokestops.push({r,c,lastVisit:0}); }
  for (const [r,c] of gymsPos) { map[r][c]=T.GYM; state.gyms.push({r,c}); }

  return map;
}

// ---- SPRITE CACHE ----
const spriteCache = {};
function getSprite(id, large = false) {
  const url = large
    ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`
    : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
  if (!spriteCache[url]) {
    const img = new Image();
    img.src = url;
    spriteCache[url] = img;
  }
  return spriteCache[url];
}

function preloadSprites() {
  for (const p of POKEMON_DATA) {
    getSprite(p.id);
    getSprite(p.id, true);
  }
}

// ---- CANVAS SETUP ----
const canvas = document.getElementById('map-canvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  const gameEl = document.getElementById('game-container');
  const navEl = document.getElementById('bottom-nav');
  const w = gameEl.offsetWidth || window.innerWidth;
  const navH = navEl ? navEl.offsetHeight : 60;
  const h = (gameEl.offsetHeight || window.innerHeight) - navH;
  if (w > 0 && h > 0 && (canvas.width !== w || canvas.height !== h)) {
    canvas.width = w;
    canvas.height = h;
  }
}

window.addEventListener('resize', () => { resizeCanvas(); updateCamera(); });

// ---- SPAWN POKEMON ----
function spawnWildPokemon() {
  if (state.wildPokemon.length >= 8) return;
  const poke = getRandomPokemon();
  const px = state.player.x / TILE, py = state.player.y / TILE;
  let tx, ty, tries = 0;
  do {
    tx = Math.floor(px + (Math.random()-0.5)*14);
    ty = Math.floor(py + (Math.random()-0.5)*14);
    tries++;
  } while (tries < 20 && (tx<0||tx>=COLS||ty<0||ty>=ROWS||state.map[ty][tx]===T.WATER||state.map[ty][tx]===T.BUILDING));

  if (tries >= 20) return;
  state.wildPokemon.push({ ...poke, tx, ty, x: tx*TILE+TILE/2, y: ty*TILE+TILE/2, wobble: Math.random()*Math.PI*2, spawnId: Date.now()+Math.random() });
  updateRadar();
}

function updateRadar() {
  const px = state.player.x, py = state.player.y;
  state.radarPokemon = [...state.wildPokemon]
    .map(p => ({ ...p, dist: Math.hypot(p.x-px, p.y-py) }))
    .sort((a,b) => a.dist-b.dist)
    .slice(0, 3);
  renderRadar();
}

// ---- CAMERA ----
function updateCamera() {
  const vw = canvas.width, vh = canvas.height;
  state.cam.x = Math.max(0, Math.min(MAP_W - vw, state.player.x - vw/2));
  state.cam.y = Math.max(0, Math.min(MAP_H - vh, state.player.y - vh/2));
}

// ---- RENDER MAP ----
function renderMap() {
  if (state.currentScreen !== 'map') return;
  if (canvas.width === 0 || canvas.height === 0) { resizeCanvas(); updateCamera(); }
  const { x: cx, y: cy } = state.cam;
  const vw = canvas.width, vh = canvas.height;

  ctx.clearRect(0, 0, vw, vh);

  const startC = Math.floor(cx/TILE), endC = Math.min(COLS, startC + Math.ceil(vw/TILE)+1);
  const startR = Math.floor(cy/TILE), endR = Math.min(ROWS, startR + Math.ceil(vh/TILE)+1);

  for (let r = startR; r < endR; r++) {
    for (let c = startC; c < endC; c++) {
      const t = state.map[r][c];
      const sx = c*TILE - cx, sy = r*TILE - cy;

      ctx.fillStyle = TILE_COLORS[t];
      ctx.fillRect(sx, sy, TILE, TILE);

      if (t === T.DEEP_GRASS) {
        ctx.fillStyle = 'rgba(0,100,0,0.15)';
        ctx.fillRect(sx+2,sy+2,TILE-4,TILE-4);
      }
      if (t === T.WATER) {
        const wave = Math.sin(Date.now()/800 + c*0.5 + r*0.3)*2;
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(sx, sy + TILE/2 + wave, TILE, 2);
      }
      if (t === T.PATH) {
        ctx.strokeStyle = 'rgba(180,150,100,0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(sx+4, sy+4, TILE-8, TILE-8);
      }
      if (t === T.BUILDING) {
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.fillRect(sx+2,sy+2,TILE-4,TILE-4);
        ctx.fillStyle = 'rgba(255,255,200,0.7)';
        ctx.fillRect(sx+6,sy+6,8,8);
        ctx.fillRect(sx+TILE-14,sy+6,8,8);
      }
      if (t === T.POKESTOP) {
        const ps = state.pokestops.find(p=>p.r===r&&p.c===c);
        const available = !ps || Date.now()-ps.lastVisit > 300000;
        const bob = Math.sin(Date.now()/600)*3;
        ctx.fillStyle = available ? 'rgba(33,150,243,0.2)' : 'rgba(150,150,150,0.2)';
        ctx.beginPath();
        ctx.arc(sx+TILE/2, sy+TILE/2, TILE/2-2, 0, Math.PI*2);
        ctx.fill();
        ctx.font = '22px serif';
        ctx.textAlign = 'center';
        ctx.fillText(available ? '🔵' : '⚪', sx+TILE/2, sy+TILE/2+8+bob);
        ctx.textAlign = 'left';
      }
      if (t === T.GYM) {
        const bob = Math.sin(Date.now()/500)*3;
        ctx.fillStyle = 'rgba(255,214,0,0.2)';
        ctx.beginPath();
        ctx.arc(sx+TILE/2, sy+TILE/2, TILE/2-2, 0, Math.PI*2);
        ctx.fill();
        ctx.font = '24px serif';
        ctx.textAlign = 'center';
        ctx.fillText('🏟️', sx+TILE/2, sy+TILE/2+10+bob);
        ctx.textAlign = 'left';
      }
    }
  }

  // Wild Pokemon
  const now = Date.now();
  for (const wp of state.wildPokemon) {
    const sx = wp.x - cx, sy = wp.y - cy;
    if (sx < -TILE || sx > vw+TILE || sy < -TILE || sy > vh+TILE) continue;
    const bob = Math.sin(now/600 + wp.wobble)*4;
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(sx+20, sy+42, 15, 5, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = RARITY_COLOR[wp.rarity] + '33';
    ctx.beginPath();
    ctx.arc(sx+20, sy+20+bob, 24, 0, Math.PI*2);
    ctx.fill();
    const spr = getSprite(wp.id);
    if (spr.complete && spr.naturalWidth > 0) {
      ctx.drawImage(spr, sx+2, sy+2+bob, 36, 36);
    } else {
      ctx.font = '28px serif';
      ctx.textAlign = 'center';
      ctx.fillText(wp.emoji, sx+20, sy+30+bob);
      ctx.textAlign = 'left';
    }
  }

  // ---- PLAYER (Pokeball design) ----
  const px = state.player.x - cx;
  const py = state.player.y - cy;
  const pcx = px + 20, pcy = py + 20, pr = 22;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(pcx, pcy + 26, 18, 6, 0, 0, Math.PI*2);
  ctx.fill();

  // Outer glow ring
  ctx.save();
  ctx.shadowColor = 'rgba(255,255,255,1)';
  ctx.shadowBlur = 12;
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(pcx, pcy, pr + 3, 0, Math.PI*2);
  ctx.stroke();
  ctx.restore();

  // Top half - red
  ctx.fillStyle = '#E53935';
  ctx.beginPath();
  ctx.moveTo(pcx - pr, pcy);
  ctx.arc(pcx, pcy, pr, Math.PI, 0);
  ctx.closePath();
  ctx.fill();

  // Bottom half - white
  ctx.fillStyle = '#f5f5f5';
  ctx.beginPath();
  ctx.moveTo(pcx - pr, pcy);
  ctx.arc(pcx, pcy, pr, 0, Math.PI);
  ctx.closePath();
  ctx.fill();

  // Middle band
  ctx.fillStyle = '#111';
  ctx.fillRect(pcx - pr, pcy - 3, pr * 2, 6);

  // Center button outer
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(pcx, pcy, 8, 0, Math.PI*2);
  ctx.fill();

  // Center button inner
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.arc(pcx, pcy, 5, 0, Math.PI*2);
  ctx.fill();

  // Range indicator
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4,4]);
  ctx.beginPath();
  ctx.arc(pcx, pcy, TILE*1.8, 0, Math.PI*2);
  ctx.stroke();
  ctx.setLineDash([]);
}

// ---- RADAR ----
function renderRadar() {
  const el = document.getElementById('radar-display');
  if (state.radarPokemon.length === 0) {
    el.innerHTML = '<div id="radar-title">주변 포켓몬</div><div style="font-size:11px;color:#aaa;text-align:center;padding:4px">없음</div>';
    return;
  }
  let html = '<div id="radar-title">주변 포켓몬</div>';
  for (const p of state.radarPokemon) {
    const dist = Math.round(p.dist / TILE * 10);
    html += `<div class="radar-entry">
      <img class="radar-sprite" src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.id}.png" alt="${p.name}">
      <div class="radar-info">
        <div class="radar-pname">${p.name}</div>
        <div class="radar-dist">~${dist}m</div>
      </div>
    </div>`;
  }
  el.innerHTML = html;
}

// ---- PLAYER MOVEMENT ----
function movePlayer() {
  const p = state.player;
  let dx = 0, dy = 0;
  if (state.keys['ArrowLeft']||state.keys['a']||state.keys['A']) dx=-1;
  if (state.keys['ArrowRight']||state.keys['d']||state.keys['D']) dx=1;
  if (state.keys['ArrowUp']||state.keys['w']||state.keys['W']) dy=-1;
  if (state.keys['ArrowDown']||state.keys['s']||state.keys['S']) dy=1;

  if (dx !== 0 || dy !== 0) {
    const nx = Math.max(0, Math.min(MAP_W-TILE, p.x + dx*p.speed));
    const ny = Math.max(0, Math.min(MAP_H-TILE, p.y + dy*p.speed));
    const tc = Math.floor(nx/TILE), tr = Math.floor(ny/TILE);
    if (state.map[tr] && state.map[tr][tc] !== T.WATER && state.map[tr][tc] !== T.BUILDING) {
      if (!state.lastPos) state.lastPos = {x:p.x,y:p.y};
      const dist = Math.hypot(nx-state.lastPos.x, ny-state.lastPos.y);
      if (dist > TILE) { state.totalWalked += Math.round(dist/TILE); state.lastPos = {x:nx,y:ny}; }
      p.x = nx; p.y = ny;
    }
    checkProximity();
  }
}

// ---- PROXIMITY CHECKS ----
function checkProximity() {
  const px = state.player.x + 20, py = state.player.y + 20;
  for (const wp of state.wildPokemon) {
    if (Math.hypot(wp.x+10 - px, wp.y+10 - py) < TILE * 1.5) {
      startEncounter(wp);
      return;
    }
  }
  for (const ps of state.pokestops) {
    const sx = ps.c*TILE+20, sy = ps.r*TILE+20;
    if (Math.hypot(sx-px,sy-py) < TILE*1.8) {
      if (Date.now()-ps.lastVisit > 300000) visitPokestop(ps);
    }
  }
}

function visitPokestop(ps) {
  ps.lastVisit = Date.now();
  const rewards = [];
  const balls = Math.floor(Math.random()*3)+1;
  state.bag.pokeball += balls;
  rewards.push({ icon:'⚫', name:`포켓볼 x${balls}` });
  if (Math.random() < 0.3) { state.bag.greatball++; rewards.push({ icon:'🔵', name:'수퍼볼 x1' }); }
  document.getElementById('pokestop-title').textContent = '포켓스탑 방문!';
  document.getElementById('pokestop-items').innerHTML = rewards.map(r=>`<div class="stop-item"><div class="stop-item-icon">${r.icon}</div><div class="stop-item-name">${r.name}</div></div>`).join('');
  const popup = document.getElementById('pokestop-popup');
  popup.classList.add('show');
  updateBagUI();
  setTimeout(() => popup.classList.remove('show'), 2500);
  gainXP(50);
}

// ---- XP & LEVEL ----
function gainXP(amount) {
  state.player.xp += amount;
  while (state.player.xp >= state.player.xpMax) {
    state.player.xp -= state.player.xpMax;
    state.player.level++;
    state.player.xpMax = Math.floor(state.player.xpMax * 1.3);
    showNotif(`레벨 업! Lv.${state.player.level} 🎉`);
  }
  updateHUD();
}

function updateHUD() {
  document.getElementById('player-name').textContent = state.player.name;
  document.getElementById('player-level').textContent = `Lv.${state.player.level}`;
  const pct = (state.player.xp / state.player.xpMax * 100).toFixed(1);
  document.getElementById('xp-bar').style.width = pct + '%';
  document.getElementById('pokeball-count').innerHTML = `⚫ ${state.bag.pokeball}`;
}

// ---- ENCOUNTER ----
function startEncounter(wp) {
  state.currentEncounter = wp;
  state.wildPokemon = state.wildPokemon.filter(p=>p.spawnId!==wp.spawnId);
  updateRadar();

  const imgEl = document.getElementById('wild-pokemon-img');
  imgEl.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${wp.id}.png`;
  imgEl.alt = wp.name;
  document.getElementById('wild-pokemon-name').textContent = wp.name;
  document.getElementById('wild-pokemon-cp').textContent = `CP ${wp.cp}`;
  const rc = RARITY_COLOR[wp.rarity];
  document.getElementById('wild-pokemon-rarity').textContent = RARITY_LABEL[wp.rarity];
  document.getElementById('wild-pokemon-rarity').style.background = rc + '33';
  document.getElementById('wild-pokemon-rarity').style.color = rc;
  document.getElementById('enc-types').innerHTML = wp.type.map(t=>`<span class="type-badge" style="background:${getTypeColor(t)}33;color:${getTypeColor(t)}">${t}</span>`).join('');

  updateBallSelect();
  document.getElementById('catch-result').classList.remove('show');

  // Position catch-circle and shadow under the pokemon display
  const bg = document.getElementById('encounter-bg');
  const bgH = bg ? bg.offsetHeight : 600;
  const pokemonTop = bgH * 0.06;
  const pokemonEmojiH = 100;
  const circleTop = pokemonTop + pokemonEmojiH * 0.5 - 55; // center on emoji
  const circleWrap = document.getElementById('catch-circle-wrap');
  if (circleWrap) {
    circleWrap.style.top = circleTop + 'px';
    circleWrap.style.left = '50%';
    circleWrap.style.transform = 'translateX(-50%)';
  }
  const shadow = document.getElementById('pokemon-shadow');
  if (shadow) {
    shadow.style.top = (pokemonTop + pokemonEmojiH + 10) + 'px';
    shadow.style.left = '50%';
    shadow.style.transform = 'translateX(-50%)';
  }

  // Show ball at bottom-center of throw area
  const throwBall = throwBallEl();
  if (throwBall) {
    const area = document.getElementById('throw-area');
    const aW = area ? area.offsetWidth : 390;
    const aH = area ? area.offsetHeight : 450;
    throwBall.style.left = (aW / 2 - 26) + 'px';
    throwBall.style.top = (aH - 90) + 'px';
    throwBall.style.display = 'block';
    throwBall.style.transform = '';
  }

  document.getElementById('encounter-screen').classList.add('active');
  state.currentScreen = 'encounter';
}

function getTypeColor(type) {
  const c = {'풀':'#78C850','불':'#F08030','물':'#6890F0','전기':'#F8D030','에스퍼':'#F85888','고스트':'#705898','벌레':'#A8B820','독':'#A040A0','바위':'#B8A038','땅':'#E0C068','격투':'#C03028','일반':'#A8A878','날':'#98D8D8','용':'#7038F8','요정':'#EE99AC','얼음':'#98D8D8'};
  return c[type] || '#999';
}

function updateBallSelect() {
  document.getElementById('ball-select').innerHTML = [
    { id:'pokeball', icon:'⚫', name:'포켓볼', key:'pokeball' },
    { id:'greatball', icon:'🔵', name:'수퍼볼', key:'greatball' },
    { id:'ultraball', icon:'⚫', name:'울트라볼', key:'ultraball' },
  ].map(b=>`
    <div class="ball-option ${state.selectedBall===b.id?'selected':''}" onclick="selectBall('${b.id}')">
      <span class="ball-icon">${b.icon}</span>
      <div><div>${b.name}</div><div class="ball-cnt">${state.bag[b.key]}개</div></div>
    </div>`).join('');
}

function selectBall(id) { state.selectedBall = id; updateBallSelect(); }

// ---- THROW MECHANIC (drag to throw) ----
let throwDrag = null;
const throwBallEl = () => document.getElementById('throwing-ball');
const throwAreaEl = () => document.getElementById('throw-area');

function getPointerPos(e) {
  const rect = throwAreaEl().getBoundingClientRect();
  const src = e.touches ? e.touches[0] : e;
  return { x: src.clientX - rect.left, y: src.clientY - rect.top };
}

function onThrowStart(e) {
  if (state.currentScreen !== 'encounter' || !state.currentEncounter) return;
  const pos = getPointerPos(e);
  throwDrag = {
    startX: pos.x, startY: pos.y,
    curX: pos.x, curY: pos.y,
    trail: [{ x: pos.x, y: pos.y, t: Date.now() }]
  };
  const ball = throwBallEl();
  ball.style.left = (pos.x - 20) + 'px';
  ball.style.top = (pos.y - 20) + 'px';
  ball.style.display = 'block';
  ball.style.transition = 'none';
  ball.style.transform = '';
}

function onThrowMove(e) {
  if (!throwDrag) return;
  const pos = getPointerPos(e);
  throwDrag.curX = pos.x;
  throwDrag.curY = pos.y;
  throwDrag.trail.push({ x: pos.x, y: pos.y, t: Date.now() });
  if (throwDrag.trail.length > 10) throwDrag.trail.shift();
  const ball = throwBallEl();
  ball.style.left = (pos.x - 20) + 'px';
  ball.style.top = (pos.y - 20) + 'px';
}

function onThrowEnd() {
  if (!throwDrag) return;
  const drag = throwDrag;
  throwDrag = null;

  // Velocity from recent trail
  let velX = 0, velY = -1;
  const trail = drag.trail;
  if (trail.length >= 2) {
    const recent = trail.slice(-5);
    const dt = (recent[recent.length-1].t - recent[0].t) || 16;
    velX = (recent[recent.length-1].x - recent[0].x) / dt;
    velY = (recent[recent.length-1].y - recent[0].y) / dt;
  }

  const draggedUp = drag.startY - drag.curY;
  if (draggedUp > 40 || velY < -0.3) {
    performThrow(drag.curX, drag.curY, velX);
  } else {
    throwBallEl().style.display = 'none';
  }
}

function performThrow(fromX, fromY, velX) {
  const enc = state.currentEncounter;
  if (!enc) return;

  const ballCount = state.bag[state.selectedBall];
  if (ballCount <= 0) {
    showNotif('볼이 없습니다!');
    throwBallEl().style.display = 'none';
    return;
  }

  state.bag[state.selectedBall]--;
  updateBallSelect();
  updateHUD();

  const area = throwAreaEl();
  const rect = area.getBoundingClientRect();
  const targetX = rect.width / 2;
  const targetY = rect.height * 0.22;

  // Curve: based on horizontal velocity at release
  const curveAmt = velX * 80;
  const isCurve = Math.abs(velX) > 0.3;
  const spinDir = velX > 0 ? 1 : -1;

  const duration = 650;
  const startTime = performance.now();
  const ball = throwBallEl();

  function animate(now) {
    const t = Math.min((now - startTime) / duration, 1);
    const ease = t < 0.5 ? 2*t*t : -1+(4-2*t)*t;

    // Bezier curve trajectory: control point offset by curveAmt
    const cpx = (fromX + targetX) / 2 + curveAmt;
    const cpy = (fromY + targetY) / 2 - 60;
    const bx = (1-t)*(1-t)*fromX + 2*(1-t)*t*cpx + t*t*targetX;
    const by = (1-t)*(1-t)*fromY + 2*(1-t)*t*cpy + t*t*targetY;
    const rotation = spinDir * ease * (isCurve ? 900 : 540);
    const scale = 1 - ease * 0.5;

    ball.style.left = (bx - 20) + 'px';
    ball.style.top = (by - 20) + 'px';
    ball.style.transform = `rotate(${rotation}deg) scale(${scale})`;

    if (t < 1) {
      requestAnimationFrame(animate);
    } else {
      ball.classList.add('shaking');
      setTimeout(() => {
        ball.classList.remove('shaking');
        ball.style.display = 'none';
        ball.style.transform = '';
        resolveCatch(enc);
      }, 1400);
    }
  }

  requestAnimationFrame(animate);
}

function resolveCatch(enc) {
  const ballMult = { pokeball: 1, greatball: 1.5, ultraball: 2 }[state.selectedBall] || 1;
  const rate = enc.catchRate * ballMult;
  const caught = Math.random() < rate;

  const resultEl = document.getElementById('catch-result');
  const textEl = document.getElementById('catch-result-text');
  const emojiEl = document.getElementById('catch-result-emoji');
  const subEl = document.getElementById('catch-result-sub');

  resultEl.classList.add('show');

  if (caught) {
    textEl.textContent = '잡았다!';
    emojiEl.textContent = enc.emoji;
    subEl.textContent = `${enc.name} (CP ${enc.cp}) 포획 성공!`;
    if (!state.caught[enc.id]) state.caught[enc.id] = [];
    state.caught[enc.id].push({ cp: enc.cp, level: enc.level, ...enc });
    state.totalCaught++;
    gainXP(enc.rarity === 'legendary' ? 1000 : enc.rarity === 'epic' ? 500 : enc.rarity === 'rare' ? 200 : 100);
    updatePokedexUI();
  } else {
    textEl.textContent = '도망쳤다!';
    emojiEl.textContent = '💨';
    subEl.textContent = `${enc.name}이(가) 도망쳤습니다`;
  }

  setTimeout(() => {
    resultEl.classList.remove('show');
    closeEncounter();
  }, 2000);
}

function closeEncounter() {
  document.getElementById('encounter-screen').classList.remove('active');
  state.currentScreen = 'map';
  state.currentEncounter = null;
  throwDrag = null;
  throwBallEl().style.display = 'none';
}

// ---- POKEDEX UI ----
function updatePokedexUI() {
  const grid = document.getElementById('pokedex-grid');
  if (!grid) return;
  let html = '';
  for (const pd of POKEMON_DATA) {
    const myList = state.caught[pd.id] || [];
    const have = myList.length > 0;
    const bestCp = have ? Math.max(...myList.map(p=>p.cp)) : 0;
    const rc = RARITY_COLOR[pd.rarity];
    const sprUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pd.id}.png`;
    html += `<div class="poke-card ${have?'':'locked'}" onclick="${have?`showDetail(${pd.id})`:''}">
      ${have && myList.length > 1 ? `<div class="poke-count">x${myList.length}</div>` : ''}
      ${have
        ? `<img class="poke-sprite" src="${sprUrl}" alt="${pd.name}">`
        : `<div class="poke-emoji-unknown">?</div>`}
      <div class="poke-name">${have ? pd.name : `No.${pd.id}`}</div>
      ${have ? `<div class="poke-cp">CP ${bestCp}</div>
      <div style="margin-top:4px"><span class="rarity-dot" style="background:${rc}"></span><span style="font-size:10px;color:${rc}">${RARITY_LABEL[pd.rarity]}</span></div>` : ''}
    </div>`;
  }
  grid.innerHTML = html;
  document.getElementById('pokedex-count').textContent = `${Object.keys(state.caught).length} / ${POKEMON_DATA.length}`;
}

function showDetail(pokeId) {
  const pd = POKEMON_DATA.find(p=>p.id===pokeId);
  if (!pd) return;
  const myList = state.caught[pd.id]||[];
  const bestCp = Math.max(...myList.map(p=>p.cp));
  const rc = RARITY_COLOR[pd.rarity];
  const modal = document.createElement('div');
  modal.className = 'detail-modal';
  modal.innerHTML = `<div class="detail-panel">
    <div class="detail-hero">
      <img class="detail-sprite" src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pd.id}.png" alt="${pd.name}">
      <div class="detail-name">${pd.name}</div>
      <div style="font-size:12px;color:#aaa;">No.${String(pd.id).padStart(3,'0')}</div>
      <div class="detail-types">${pd.type.map(t=>`<span class="type-badge" style="background:${getTypeColor(t)}33;color:${getTypeColor(t)}">${t}</span>`).join('')}</div>
      <div style="margin-top:8px"><span class="rarity-dot" style="background:${rc}"></span><span style="font-size:12px;color:${rc};font-weight:600">${RARITY_LABEL[pd.rarity]}</span></div>
      <div style="font-size:22px;font-weight:800;color:#333;margin-top:8px">최고 CP: ${bestCp}</div>
      <div style="font-size:12px;color:#aaa">보유 ${myList.length}마리</div>
    </div>
    <div class="detail-stats">
      ${[['HP',pd.hp,160],['공격',pd.atk,130],['방어',Math.floor(pd.hp*0.7),130]].map(([n,v,mx])=>`
      <div class="stat-row">
        <div class="stat-name">${n}</div>
        <div class="stat-bar-wrap"><div class="stat-bar-fill" style="width:${Math.min(100,v/mx*100)}%;background:${v>100?'#4CAF50':v>60?'#FF9800':'#F44336'}"></div></div>
        <div class="stat-num">${v}</div>
      </div>`).join('')}
    </div>
    <button class="detail-close" onclick="this.closest('.detail-modal').remove()">닫기</button>
  </div>`;
  document.getElementById('game-container').appendChild(modal);
  modal.addEventListener('click', e => { if (e.target===modal) modal.remove(); });
}

// ---- BAG UI ----
function updateBagUI() {
  const body = document.getElementById('bag-body');
  if (!body) return;
  body.innerHTML = `
    <div class="bag-section">
      <h3>포켓볼</h3>
      <div class="item-list">
        <div class="item-row"><div class="item-icon">⚫</div><div class="item-info"><div class="item-name">포켓볼</div><div class="item-desc">일반 포켓몬 포획</div></div><div class="item-count">${state.bag.pokeball}</div></div>
        <div class="item-row"><div class="item-icon">🔵</div><div class="item-info"><div class="item-name">수퍼볼</div><div class="item-desc">포획률 1.5배</div></div><div class="item-count">${state.bag.greatball}</div></div>
        <div class="item-row"><div class="item-icon">⬛</div><div class="item-info"><div class="item-name">울트라볼</div><div class="item-desc">포획률 2배</div></div><div class="item-count">${state.bag.ultraball}</div></div>
      </div>
    </div>`;
}

// ---- PROFILE UI ----
function updateProfileUI() {
  const body = document.getElementById('profile-body');
  if (!body) return;
  const pct = (state.player.xp / state.player.xpMax * 100).toFixed(0);
  body.innerHTML = `
    <div class="profile-hero">
      <div class="profile-avatar">🧢</div>
      <div class="profile-trainer-name">${state.player.name}</div>
      <div class="profile-team">팀 미스틱</div>
      <div class="profile-level-badge">Lv.${state.player.level}</div>
    </div>
    <div class="xp-section">
      <div class="xp-label"><span>경험치</span><span>${state.player.xp} / ${state.player.xpMax}</span></div>
      <div class="xp-full-bar"><div class="xp-full-fill" style="width:${pct}%"></div></div>
    </div>
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-value">${state.totalCaught}</div><div class="stat-label">총 포획</div></div>
      <div class="stat-card"><div class="stat-value">${Object.keys(state.caught).length}</div><div class="stat-label">포켓몬 종류</div></div>
      <div class="stat-card"><div class="stat-value">${state.totalWalked}</div><div class="stat-label">이동 타일</div></div>
      <div class="stat-card"><div class="stat-value">Lv.${state.player.level}</div><div class="stat-label">트레이너 레벨</div></div>
    </div>`;
}

// ---- NOTIFICATION ----
let notifTimer;
function showNotif(msg) {
  const el = document.getElementById('notif');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(notifTimer);
  notifTimer = setTimeout(() => el.classList.remove('show'), 2000);
}

// ---- SCREEN NAVIGATION ----
function switchScreen(screen) {
  if (state.currentScreen === 'encounter') return;
  state.currentScreen = screen;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.screen===screen));
  ['pokedex-screen','bag-screen','profile-screen'].forEach(id => {
    document.getElementById(id).style.display = 'none';
  });
  if (screen === 'pokedex') { document.getElementById('pokedex-screen').style.display='flex'; updatePokedexUI(); }
  else if (screen === 'bag') { document.getElementById('bag-screen').style.display='flex'; updateBagUI(); }
  else if (screen === 'profile') { document.getElementById('profile-screen').style.display='flex'; updateProfileUI(); }
}

// ---- TOUCH MAP DRAG ----
let dragStart = null;
canvas.addEventListener('touchstart', e => {
  const t = e.touches[0];
  dragStart = { x: t.clientX, y: t.clientY, px: state.player.x, py: state.player.y };
}, { passive: true });

canvas.addEventListener('touchmove', e => {
  if (!dragStart) return;
  const t = e.touches[0];
  const dx = t.clientX - dragStart.x, dy = t.clientY - dragStart.y;
  const nx = Math.max(0, Math.min(MAP_W-TILE, dragStart.px - dx));
  const ny = Math.max(0, Math.min(MAP_H-TILE, dragStart.py - dy));
  const tc = Math.floor(nx/TILE), tr = Math.floor(ny/TILE);
  if (state.map[tr]&&state.map[tr][tc]!==T.WATER&&state.map[tr][tc]!==T.BUILDING) {
    state.player.x = nx; state.player.y = ny;
  }
  checkProximity();
}, { passive: true });

canvas.addEventListener('touchend', () => { dragStart = null; });

// ---- MAIN LOOP ----
let last = 0;
function gameLoop(ts) {
  if (!last) last = ts;
  const dt = ts - last; last = ts;

  if (state.currentScreen === 'map') {
    movePlayer();
    updateCamera();
    renderMap();
    state.spawnTimer += dt;
    if (state.spawnTimer > 4000) { state.spawnTimer = 0; spawnWildPokemon(); updateRadar(); }
  }

  requestAnimationFrame(gameLoop);
}

// ---- INIT ----
function init() {
  state.map = generateMap();

  // Two rAF frames to ensure layout is computed before sizing canvas
  requestAnimationFrame(() => requestAnimationFrame(() => {
    resizeCanvas();
    updateCamera();
  }));

  resizeCanvas();
  updateCamera();
  updateHUD();

  // Keyboard: clear all keys on focus loss
  document.addEventListener('keydown', e => { state.keys[e.key] = true; });
  document.addEventListener('keyup', e => { state.keys[e.key] = false; });
  window.addEventListener('blur', () => { state.keys = {}; });

  // D-pad: JS listeners with mouseleave + touchcancel support
  const DPAD_MAP = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
  document.querySelectorAll('.dpad-btn[data-dir]').forEach(btn => {
    const key = DPAD_MAP[btn.dataset.dir];
    const press = () => { state.keys[key] = true; };
    const release = () => { state.keys[key] = false; };
    btn.addEventListener('mousedown', press);
    btn.addEventListener('mouseup', release);
    btn.addEventListener('mouseleave', release);  // stops movement when mouse leaves button
    btn.addEventListener('touchstart', press, { passive: true });
    btn.addEventListener('touchend', release);
    btn.addEventListener('touchcancel', release);
  });

  // Nav buttons
  document.querySelectorAll('.nav-btn[data-screen]').forEach(btn => {
    btn.addEventListener('click', () => switchScreen(btn.dataset.screen));
  });

  // Run button
  document.getElementById('btn-run').addEventListener('click', closeEncounter);

  // Nav pokeball
  document.getElementById('nav-catch').addEventListener('click', () => {
    if (state.wildPokemon.length > 0) startEncounter(state.wildPokemon[0]);
    else showNotif('주변에 포켓몬이 없습니다');
  });

  // Throw drag events on throw-area
  const area = document.getElementById('throw-area');
  area.addEventListener('mousedown', onThrowStart);
  area.addEventListener('touchstart', onThrowStart, { passive: true });
  document.addEventListener('mousemove', onThrowMove);
  document.addEventListener('touchmove', onThrowMove, { passive: true });
  document.addEventListener('mouseup', onThrowEnd);
  document.addEventListener('touchend', onThrowEnd);

  preloadSprites();

  // Spawn initial pokemon
  for (let i = 0; i < 5; i++) spawnWildPokemon();
  updateRadar();

  document.querySelector('[data-screen="map"]')?.classList.add('active');
  requestAnimationFrame(gameLoop);
}

window.addEventListener('load', init);
window.selectBall = selectBall;
window.showDetail = showDetail;
window.switchScreen = switchScreen;
