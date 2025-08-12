/* ===========================
   Globals
   =========================== */
let canvas, ctx, state = 'mainmenu';
let player, bullets=[], asteroids=[], particles=[], trail=[], thrusterParticles=[], levelCompleteParticles=[];
let enemies=[], enemyBullets=[];
let powerups=[];
let keys = new Set();
let lastShotAt = -999, elapsed = 0;
let score = 0, best = 0, timeAccumulator = 0, lastFrame = 0;

// Wave System
let currentLevel = 1, currentWave = 1;
let waveEnemiesKilled = 0, waveEnemiesTotal = 0;
let waveState = 'preparing'; // 'preparing', 'active', 'completed', 'transitioning'
let waveTimer = 0, waveTransitionTimer = 0;
let spawnTimer = 0, lastEnemySpawn = 0;

// economy + progression
let credits = 0;
let owned = new Set(['scout']);
let selectedShipId = 'scout';
let shipLevels = {scout:1};
let currentWeapon = 1;
// hangar
let hangarOffset = 0, hangarTarget = 0, dragging = false, dragStartX = 0, dragStartOff = 0, dragAccum = 0;
const CARD_W = 180, CARD_H = 200, CARD_GAP = 24;
let hangarReturn = 'mainmenu';
// input
const mouse = {x:0,y:0};
let clickOnce = false;
let touchActive = false;
let lastTouchTap = 0;
// audio & settings
let audioCtx = null;
let difficulty = 'medium';
let musicOn = true, sfxOn = true;
let music = { started:false, nodes:[], time:0 };
// camera shake
let shakeT=0, shakeA=0;
// ui clock
let uiTime = 0;

/* ===========================
   Init
   =========================== */
function init(){
  canvas = document.getElementById('game');
  ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  loadProgress();

  canvas.addEventListener('pointerdown', async (e)=>{
    if (!clickOnce){ clickOnce = true; initAudio(); try{ await audioCtx.resume(); }catch{} refreshMusic(); }
    if (e.pointerType !== 'mouse'){
      const r = canvas.getBoundingClientRect();
      mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
      mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
      if (state==='playing'){
        const now = performance.now();
        if (now - lastTouchTap < 300) switchWeapon();
        lastTouchTap = now;
        touchActive = true;
        keys.add('Space');
        player.x = Math.max(PLAYER_R, Math.min(WIDTH-PLAYER_R, mouse.x));
        player.y = Math.max(PLAYER_R, Math.min(HEIGHT-PLAYER_R, mouse.y));
      }
      if (state==='hangar'){
        dragging = true; dragStartX = mouse.x; dragStartOff = hangarOffset; dragAccum = 0;
      }
    }
  });

  canvas.addEventListener('pointermove', (e)=>{
    if (e.pointerType !== 'mouse'){
      const r = canvas.getBoundingClientRect();
      mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
      mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
      if (touchActive && state==='playing'){
        player.x = Math.max(PLAYER_R, Math.min(WIDTH-PLAYER_R, mouse.x));
        player.y = Math.max(PLAYER_R, Math.min(HEIGHT-PLAYER_R, mouse.y));
      }
      if (state==='hangar' && dragging){
        const dx = mouse.x - dragStartX;
        hangarOffset = Math.max(0, dragStartOff - dx);
        dragAccum += Math.abs(dx);
      }
    }
  });
  const endPointer = (e)=>{
    if (e.pointerType !== 'mouse'){
      if (state==='hangar'){ dragging = false; snapHangar(); }
      touchActive = false; keys.delete('Space');
    }
  };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('pointerout', endPointer);

  canvas.addEventListener('click', ()=>{ clicks.t = performance.now(); });

  canvas.addEventListener('mousedown', ()=>{
    if (state==='hangar'){ dragging = true; dragStartX = mouse.x; dragStartOff = hangarOffset; dragAccum = 0; }
  });
  canvas.addEventListener('mouseup', ()=>{
    if (state==='hangar'){ dragging = false; snapHangar(); }
  });

  canvas.addEventListener('mousemove', (e)=>{
    const r = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
    mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
    if (state==='hangar' && dragging){
      const dx = mouse.x - dragStartX;
      hangarOffset = Math.max(0, dragStartOff - dx);
      dragAccum += Math.abs(dx);
    }
  });

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  toMain();
  requestAnimationFrame(loop);
}

function loop(t){
  if (!lastFrame) lastFrame = t;
  let dt = (t - lastFrame) / 1000; lastFrame = t;
  if (dt > 1/30) dt = 1/30;

  uiTime += dt;
  if (shakeT > 0){ shakeT -= dt; if (shakeT < 0) shakeT = 0; }

  if (state === 'playing'){
    timeAccumulator += dt; while (timeAccumulator >= 1/60){ update(1/60); timeAccumulator -= 1/60; }
  }

  if (state === 'levelcomplete'){
    levelCompleteTime += dt;
    updateLevelCompleteParticles(dt);
  }

  render();
  requestAnimationFrame(loop);
}

/* ===========================
   State helpers
   =========================== */
function transitionTo(next){ state = next; refreshMusic(); }
function toMain(){
  transitionTo('mainmenu');
  resetGame();
  validateSelected();
  const idx = SHIPS.findIndex(s=>s.id===selectedShipId);
  const step = CARD_W + CARD_GAP;
  hangarTarget = Math.max(0, idx) * step;
  hangarOffset = hangarTarget;
}
function validateSelected(){ if (!SHIPS.some(s=>s.id===selectedShipId)) selectedShipId='scout'; }
function toHangar(returnTo='mainmenu'){ validateSelected(); hangarReturn = returnTo; transitionTo('hangar'); }
function backFromHangar(){
  if (hangarReturn === 'mainmenu') toMain();
  else transitionTo(hangarReturn);
}
function toSettings(){ transitionTo('settings'); }

function resetGame(){
  bullets.length = 0; asteroids.length = 0; particles.length = 0; trail.length = 0; thrusterParticles.length = 0;
  enemies.length = 0; enemyBullets.length = 0; powerups.length = 0;
  const hp = getShip().stats.hp;
  player = { x: WIDTH/2, y: HEIGHT - 80, r: PLAYER_R, maxHp: hp, hp: hp, iTime:0, shield:0, rainbowTime:0 };
  currentWeapon = 1;
  currentLevel = 1; currentWave = 1; waveState = 'preparing';
  elapsed = 0; waveTimer = 0; waveTransitionTimer = 0; spawnTimer = 0; lastEnemySpawn = 0;
  waveEnemiesKilled = 0; waveEnemiesTotal = 0;
}

function startGame(){
  score = 0; elapsed = 0; timeAccumulator = 0; lastFrame = 0; lastShotAt = -999;
  resetGame();
  startWave();
  transitionTo('playing');
}
function pauseGame(){ transitionTo('paused'); }
function resumeGame(){ transitionTo('playing'); }
function resetProgress(){
  best=0; credits=0; owned=new Set(['scout']); selectedShipId='scout';
  localStorage.removeItem('space_save_slot'); saveProgress(); toHangar();
}
function gameOver(){
  transitionTo('gameover'); 
  if (score > best){ best = score; try{ localStorage.setItem('space_best', String(best)); }catch(e){} }
  addShake(12, 2.0);
}

/* ===========================
   Wave System
   =========================== */
function startWave(){
  waveState = 'preparing';
  waveTimer = 0;
  waveTransitionTimer = 3.0; // 3 second preparation
  waveEnemiesKilled = 0;
  spawnTimer = 0;
  lastEnemySpawn = 0;
  
  // Clear existing enemies and projectiles
  enemies.length = 0;
  enemyBullets.length = 0;
  asteroids.length = 0;
  
  // Calculate wave enemy count based on wave type and level
  const baseCount = currentWave === 1 ? 8 : (currentWave === 2 ? 6 : 1); // asteroids : enemies : miniboss
  waveEnemiesTotal = baseCount + (currentLevel - 1) * 2;
  if (currentWave === 3) waveEnemiesTotal = 1; // Always 1 miniboss
}

function updateWaveSystem(dt){
  waveTimer += dt;
  
  switch(waveState){
    case 'preparing':
      waveTransitionTimer -= dt;
      if (waveTransitionTimer <= 0){
        waveState = 'active';
        waveTransitionTimer = 0;
      }
      break;
      
    case 'active':
      spawnWaveEnemies(dt);
      
      // Check if wave is completed
      const aliveEnemies = enemies.length + asteroids.length;
      if (waveEnemiesKilled >= waveEnemiesTotal && aliveEnemies === 0){
        completeWave();
      }
      break;
      
    case 'completed':
      waveTransitionTimer -= dt;
      if (waveTransitionTimer <= 0){
        nextWave();
      }
      break;
  }
}

function spawnWaveEnemies(dt){
  spawnTimer += dt;
  const spawnInterval = 1.0 + Math.random() * 1.5; // Random spawn timing
  
  if (spawnTimer >= spawnInterval && waveEnemiesKilled + enemies.length + asteroids.length < waveEnemiesTotal){
    spawnTimer = 0;
    
    switch(currentWave){
      case 1: // Asteroids only
        spawnWaveAsteroid();
        break;
      case 2: // Enemy spacecraft
        spawnWaveEnemy();
        break;
      case 3: // Miniboss
        if (enemies.length === 0) spawnMiniboss();
        break;
    }
  }
}

function spawnWaveAsteroid(){
  const r = randRange(AST_MIN_R, AST_MAX_R);
  const x = randRange(r, WIDTH - r);
  const v = randRange(AST_MIN_V, AST_MAX_V) * (DIFFS[difficulty]?.speedMul || 1) * (1 + (currentLevel-1)*0.1);
  asteroids.push(makeAsteroid(x, -r-4, r, v));
}

function spawnWaveEnemy(){
  const types = ['SCOUT', 'CRUISER', 'INTERCEPTOR'];
  const type = types[Math.floor(Math.random() * types.length)];
  const enemyData = ENEMY_TYPES[type];
  
  const enemy = {
    type: type,
    x: Math.random() * (WIDTH - 40) + 20,
    y: -enemyData.size - 10,
    vx: 0,
    vy: enemyData.speed * (DIFFS[difficulty]?.speedMul || 1),
    hp: enemyData.hp * (DIFFS[difficulty]?.healthMul || 1),
    maxHp: enemyData.hp * (DIFFS[difficulty]?.healthMul || 1),
    size: enemyData.size,
    color: enemyData.color,
    lastShot: 0,
    shootCooldown: enemyData.shootCooldown,
    bulletSpeed: enemyData.bulletSpeed,
    score: enemyData.score
  };
  
  enemies.push(enemy);
}

function spawnMiniboss(){
  const enemyData = ENEMY_TYPES.MINIBOSS;
  const miniboss = {
    type: 'MINIBOSS',
    x: WIDTH / 2,
    y: -enemyData.size - 10,
    vx: 0,
    vy: enemyData.speed * 0.5, // Slower approach
    hp: enemyData.hp * (DIFFS[difficulty]?.healthMul || 1) * currentLevel,
    maxHp: enemyData.hp * (DIFFS[difficulty]?.healthMul || 1) * currentLevel,
    size: enemyData.size,
    color: enemyData.color,
    lastShot: 0,
    shootCooldown: enemyData.shootCooldown,
    bulletSpeed: enemyData.bulletSpeed,
    score: enemyData.score * currentLevel,
    phase: 1,
    movePattern: 0
  };
  
  enemies.push(miniboss);
}

function completeWave(){
  waveState = 'completed';
  waveTransitionTimer = 2.0; // 2 second completion display
  
  // Award credits
  const reward = WAVE_REWARDS[currentWave - 1];
  credits += reward;
  score += reward * 5; // Score bonus
  saveProgress();
  
  playSfx(660, 'triangle', 0.3, 0.2); // Success sound
}

function nextWave(){
  if (currentWave < WAVES_PER_LEVEL){
    currentWave++;
    startWave();
  } else {
    // Level completed - show completion screen
    showLevelComplete();
  }
}

// Show level completion animation and menu
let levelCompleteTime = 0;
function showLevelComplete(){
  levelCompleteTime = 0;
  levelCompleteParticles = [];
  for (let i=0;i<40;i++){
    const a = Math.random()*Math.PI*2;
    const sp = randRange(60,140);
    levelCompleteParticles.push({
      x: WIDTH/2,
      y: HEIGHT/2 - 80,
      vx: Math.cos(a)*sp,
      vy: Math.sin(a)*sp,
      life: randRange(0.8,1.6),
      maxLife: 1.6
    });
  }
  transitionTo('levelcomplete');
}

function updateLevelCompleteParticles(dt){
  for (let p of levelCompleteParticles){
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
  }
  levelCompleteParticles = levelCompleteParticles.filter(p=>p.life>0);
}

function proceedToNextLevel(){
  if (currentLevel < MAX_LEVELS){
    currentLevel++;
    currentWave = 1;
    startWave();
    transitionTo('playing');
  } else {
    // No more levels - trigger game completed sequence
    gameCompleted();
  }
}

function gameCompleted(){
  // Bonus for completing all levels
  credits += 500;
  score += 2500;
  saveProgress();
  transitionTo('gameover');
  addShake(8, 1.0);
}

/* ===========================
   Input
   =========================== */
function onKeyDown(e){
  const k = e.key;
  if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"," ","Space","Enter","Escape","b","B","s","S"].includes(k)) e.preventDefault();

  if (k==='Escape'){
    if (state==='playing') return pauseGame();
    if (state==='paused') return resumeGame();
    if (state==='hangar') return backFromHangar();
    if (state==='settings') return toMain();
  }

  if (state==='playing'){
    if (k===' '||k==='Space') keys.add('Space');
    if (k==='ArrowLeft') keys.add('ArrowLeft');
    if (k==='ArrowRight') keys.add('ArrowRight');
    if (k==='ArrowUp') keys.add('ArrowUp');
    if (k==='ArrowDown') keys.add('ArrowDown');
    if (k==='b'||k==='B') switchWeapon();
  }

  if (state==='hangar'){
    if (k==='ArrowLeft') focusBy(-1);
    if (k==='ArrowRight') focusBy(+1);
    if (k==='b'||k==='B') tryBuyFocused();
    if (k==='s'||k==='S') selectFocused();
    if (k==='Enter'){ startGame(); }
  }

  if (state==='gameover' && k==='Enter'){ toMain(); }
}
function onKeyUp(e){
  const k=e.key;
  if (k===' '||k==='Space') keys.delete('Space');
  if (k==='ArrowLeft') keys.delete('ArrowLeft');
  if (k==='ArrowRight') keys.delete('ArrowRight');
  if (k==='ArrowUp') keys.delete('ArrowUp');
  if (k==='ArrowDown') keys.delete('ArrowDown');
}

function switchWeapon(){
  const lvl = shipLevels[selectedShipId] || 1;
  const max = lvl >= 3 ? 3 : (lvl >= 2 ? 2 : 1);
  currentWeapon++;
  if (currentWeapon > max) currentWeapon = 1;
}

function statsFor(ship, level){
  const stats = {...ship.stats};
  if (level >= 3){
    stats.hp = Math.round(stats.hp * 1.2);
    stats.speedMul *= 1.1;
    stats.cooldownMul *= 0.8;
    stats.bulletMul *= 1.3;
  }
  return stats;
}

/* ===========================
   Update
   =========================== */
function update(dt){
  elapsed += dt;

  // Update player invincibility frames (FIXED - moved here from checkCollisions)
  if (player.iTime > 0) player.iTime -= dt;
  if (player.rainbowTime > 0){ player.rainbowTime -= dt; if (player.rainbowTime < 0) player.rainbowTime = 0; }
  
  updateWaveSystem(dt);
  handleInput(dt);
  
  // Update bullets
  for (let b of bullets){ b.y -= BULLET_SPEED * dt; }
  for (let b of enemyBullets){ b.y += b.speed * dt; }
  
  // Update asteroids
  for (let a of asteroids){ a.y += a.v * dt; a.rot += a.rotV*dt; }
  
  // Update enemies
  updateEnemies(dt);
  
  // Remove off-screen projectiles
  bullets = bullets.filter(b => b.y + (b.r || BULLET_R) >= -10);
  enemyBullets = enemyBullets.filter(b => b.y - 5 <= HEIGHT + 10);
  asteroids = asteroids.filter(a => a.y - a.r <= HEIGHT + 10);
  enemies = enemies.filter(e => e.y - e.size <= HEIGHT + 20);

  // Update powerups
  for (let p of powerups){ p.y += p.vy * dt; }
  powerups = powerups.filter(p => p.y - p.r <= HEIGHT + 20);
  for (let i = powerups.length - 1; i >= 0; i--){
    const p = powerups[i];
    if (circleHit(player.x,player.y,player.r, p.x,p.y,p.r)){
      if (p.type === 'hp'){ player.hp = Math.min(player.maxHp, player.hp + 30); }
      else if (p.type === 'shield'){ player.shield = 2; }
      else if (p.type === 'rainbow'){ player.rainbowTime = Math.max(player.rainbowTime, 8); }
      powerups.splice(i,1);
      playSfx(880,'sine',0.1,0.1);
    }
  }

  // Collisions (FIXED - no longer has dt reference error)
  checkCollisions();
  
  if (keys.has('Space')) shoot();
  updateThrusterParticles(dt);

  for (let p of particles){ p.vx*=0.99; p.vy*=0.99; p.x+=p.vx*dt; p.y+=p.vy*dt; p.life-=dt; }
  particles = particles.filter(p => p.life > 0);
  trail.push({x:player.x, y:player.y}); if (trail.length > 14) trail.shift();
}

function updateEnemies(dt){
  for (let enemy of enemies){
    // Movement
    if (enemy.type === 'MINIBOSS'){
      // Special miniboss movement patterns
      enemy.movePattern += dt;
      if (enemy.y < 80){ // Move into position first
        enemy.y += enemy.vy * dt;
      } else {
        // Side to side movement
        enemy.vx = Math.sin(enemy.movePattern * 2) * 100;
        enemy.x += enemy.vx * dt;
        enemy.x = Math.max(enemy.size, Math.min(WIDTH - enemy.size, enemy.x));
      }
    } else {
      // Normal enemy movement
      enemy.y += enemy.vy * dt;
      
      // Simple AI - move toward player horizontally
      if (enemy.type === 'INTERCEPTOR'){
        const dx = player.x - enemy.x;
        enemy.vx = Math.sign(dx) * 50;
        enemy.x += enemy.vx * dt;
      }
    }
    
    // Shooting
    enemy.lastShot += dt;
    if (enemy.lastShot >= enemy.shootCooldown && enemy.y > 0 && enemy.y < HEIGHT - 50){
      enemy.lastShot = 0;
      
      // Different shooting patterns
      if (enemy.type === 'MINIBOSS'){
        // Spread shot
        for (let i = -1; i <= 1; i++){
          enemyBullets.push({
            x: enemy.x + i * 15,
            y: enemy.y + enemy.size,
            speed: enemy.bulletSpeed,
            color: enemy.color
          });
        }
      } else {
        // Single shot
        enemyBullets.push({
          x: enemy.x,
          y: enemy.y + enemy.size,
          speed: enemy.bulletSpeed,
          color: enemy.color
        });
      }
      
      playSfx(300, 'square', 0.1, 0.08); // Enemy shoot sound
    }
  }
}

function checkCollisions(){
  // Player bullets vs asteroids
  outer1: for (let i = asteroids.length - 1; i >= 0; i--){
    const a = asteroids[i];
    for (let j = bullets.length - 1; j >= 0; j--){
      const b = bullets[j];
      const br = b.r || BULLET_R * getShip().stats.bulletMul;
      if (circleHit(a.x,a.y,a.r, b.x,b.y,br)){
        asteroids.splice(i,1); bullets.splice(j,1);
        waveEnemiesKilled++;
        credits += 1; score += 10; saveProgress();
        spawnExplosion(a.x,a.y, Math.max(8, Math.min(20, a.r/2)));
        maybeDropPowerup(a.x, a.y);
        addShake(6, 0.15); playSfx(520,'square',0.08,0.12);
        break outer1;
      }
    }
  }
  
  // Player bullets vs enemies
  outer2: for (let i = enemies.length - 1; i >= 0; i--){
    const e = enemies[i];
    for (let j = bullets.length - 1; j >= 0; j--){
      const b = bullets[j];
      const br = b.r || BULLET_R * getShip().stats.bulletMul;
      if (circleHit(e.x,e.y,e.size, b.x,b.y,br)){
        bullets.splice(j,1);
        const dmg = b.dmg || 25;
        e.hp -= dmg; // Damage
        
        if (e.hp <= 0){
          enemies.splice(i,1);
          waveEnemiesKilled++;
          credits += Math.floor(e.score / 10);
          score += e.score;
          saveProgress();
          spawnExplosion(e.x,e.y, e.size);
          maybeDropPowerup(e.x, e.y);
          addShake(8, 0.2);
          playSfx(440,'square',0.15,0.15);
        } else {
          // Hit but not dead
          addShake(4, 0.1);
          playSfx(480,'square',0.05,0.08);
        }
        break outer2;
      }
    }
  }

  // Asteroids vs player (FIXED - removed dt reference)
  for (let ai=asteroids.length-1; ai>=0; ai--){
    const a = asteroids[ai];
    if (circleHit(player.x,player.y,player.r, a.x,a.y,a.r)){
      if (player.rainbowTime > 0){
        asteroids.splice(ai,1);
        waveEnemiesKilled++;
        credits += 1; score += 10; saveProgress();
        spawnExplosion(a.x,a.y, Math.max(8, Math.min(20, a.r/2)));
        maybeDropPowerup(a.x, a.y);
      } else if (player.iTime<=0){
        const dmg = asteroidDamage(a.r);
        if (player.shield > 0){
          player.shield--; player.iTime = 0.4;
        } else {
          player.hp -= dmg; player.iTime = 0.8;
        }
        spawnExplosion(player.x,player.y,22); addShake(10, 0.25); playSfx(220,'square',0.12,0.2);
        asteroids.splice(ai,1);
        maybeDropPowerup(a.x, a.y);
        if (player.hp <= 0){ player.hp = 0; gameOver(); return; }
      }
    }
  }

  // Enemies vs player
  for (let ei=enemies.length-1; ei>=0; ei--){
    const e = enemies[ei];
    if (circleHit(player.x,player.y,player.r, e.x,e.y,e.size)){
      if (player.rainbowTime > 0){
        enemies.splice(ei,1);
        waveEnemiesKilled++;
        credits += Math.floor(e.score / 10);
        score += e.score; saveProgress();
        spawnExplosion(e.x,e.y, e.size);
        maybeDropPowerup(e.x, e.y);
      } else if (player.iTime<=0){
        const dmg = 30;
        if (player.shield > 0){
          player.shield--; player.iTime = 0.4;
        } else {
          player.hp -= dmg; player.iTime = 0.8;
        }
        spawnExplosion(player.x,player.y,22); addShake(12, 0.3); playSfx(200,'square',0.15,0.25);
        // Don't remove enemy, just damage player
        if (player.hp <= 0){ player.hp = 0; gameOver(); return; }
      }
    }
  }

  // Enemy bullets vs player
  for (let bi=enemyBullets.length-1; bi>=0; bi--){
    const b = enemyBullets[bi];
    if (circleHit(player.x,player.y,player.r, b.x,b.y,5)){
      if (player.rainbowTime > 0){
        enemyBullets.splice(bi,1);
        spawnExplosion(b.x,b.y,10);
      } else if (player.iTime<=0){
        enemyBullets.splice(bi,1);
        const dmg = 20;
        if (player.shield > 0){
          player.shield--; player.iTime = 0.3;
        } else {
          player.hp -= dmg; player.iTime = 0.6;
        }
        spawnExplosion(player.x,player.y,15); addShake(8, 0.2); playSfx(320,'square',0.1,0.15);
        if (player.hp <= 0){ player.hp = 0; gameOver(); return; }
      }
    }
  }
}

function updateThrusterParticles(dt){
  if (keys.has('ArrowUp') || keys.has('ArrowLeft') || keys.has('ArrowRight') || keys.has('ArrowDown')){
    const ship = getShip();
    const colors = ship.colors;
    const level = ship.level || 1;
    // Higher level ships emit more intense thruster particles.
    const count = 3 + (level - 1); // 3,4,5 for lv1,2,3
    for (let i = 0; i < count; i++){
      thrusterParticles.push({
        x: player.x + (Math.random() - 0.5) * 8,
        y: player.y + PLAYER_R + Math.random() * 4,
        vx: (Math.random() - 0.5) * 30,
        vy: 60 + Math.random() * 40 + (level - 1) * 20,
        life: 0.15 + Math.random() * 0.1,
        maxLife: 0.25,
        color: level >= 3 ? '#ffffff' : colors.thruster,
        size: (2 + Math.random() * 2) * (1 + (level - 1) * 0.3)
      });
    }
  }
  
  for (let p of thrusterParticles){
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    p.vy += 100 * dt;
  }
  thrusterParticles = thrusterParticles.filter(p => p.life > 0);
}

function maybeDropPowerup(x, y){
  if (Math.random() < 0.1){
    const r = Math.random();
    let type;
    if (r < 0.5) type = 'hp';
    else if (r < 0.9) type = 'shield';
    else type = 'rainbow';
    powerups.push({ x, y, vy: 80, r: 10, type });
  }
}

function asteroidDamage(r){
  const t = Math.max(0, Math.min(1, (r - AST_MIN_R) / (AST_MAX_R - AST_MIN_R)));
  return Math.round(12 + t * 26);
}
function handleInput(dt){
  let dx=0, dy=0;
  if (keys.has('ArrowLeft')) dx -= 1;
  if (keys.has('ArrowRight')) dx += 1;
  if (keys.has('ArrowUp')) dy -= 1;
  if (keys.has('ArrowDown')) dy += 1;
  if (dx||dy){ const inv=1/Math.hypot(dx,dy); dx*=inv; dy*=inv; }
  const speedBoost = player.rainbowTime > 0 ? 1.5 : 1;
  player.x += dx * BASE_SPEED * getShip().stats.speedMul * speedBoost * dt;
  player.y += dy * BASE_SPEED * getShip().stats.speedMul * speedBoost * dt;
  player.x = Math.max(PLAYER_R, Math.min(WIDTH-PLAYER_R, player.x));
  player.y = Math.max(PLAYER_R, Math.min(HEIGHT-PLAYER_R, player.y));
}
function shoot(){
  const cd = BASE_COOLDOWN * getShip().stats.cooldownMul * (player.rainbowTime > 0 ? 0.5 : 1);
  if (elapsed - lastShotAt < cd) return;
  lastShotAt = elapsed;
  const stats = getShip().stats;
  if (currentWeapon === 1){
    bullets.push({ x: player.x, y: player.y - PLAYER_R - 2 });
    playLaserSound();
  } else if (currentWeapon === 2){
    bullets.push({ x: player.x - 10, y: player.y - PLAYER_R - 2 });
    bullets.push({ x: player.x, y: player.y - PLAYER_R - 2 });
    bullets.push({ x: player.x + 10, y: player.y - PLAYER_R - 2 });
    playSfx(900,'square',0.12,0.2);
  } else {
    bullets.push({ x: player.x, y: player.y - PLAYER_R - 2, r: BULLET_R*2*stats.bulletMul, dmg:50 });
    playSfx(200,'sawtooth',0.25,0.3);
  }
}

/* ===========================
   Rendering
   =========================== */
function render(){
  btns.length = 0;

  // camera shake
  let sx=0, sy=0;
  if (shakeT>0){ sx=(Math.random()*2-1)*shakeA*shakeT; sy=(Math.random()*2-1)*shakeA*shakeT; }

  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,WIDTH,HEIGHT);

  drawBackground();

  ctx.setTransform(1,0,0,1,sx,sy);

  if (state !== 'mainmenu' && state !== 'hangar' && state !== 'settings' && state !== 'paused' && state !== 'gameover'){
    drawThrusterParticles();
    
    // bullets
    ctx.fillStyle = COLORS.bullet;
    for (let b of bullets){
      const r = b.r || BULLET_R*getShip().stats.bulletMul;
      ctx.beginPath(); ctx.arc(b.x,b.y,r,0,Math.PI*2); ctx.fill();
    }
    
    // enemy bullets
    ctx.save(); ctx.shadowColor = '#f44'; ctx.shadowBlur = 6;
    for (let b of enemyBullets){ 
      ctx.fillStyle = b.color; 
      ctx.beginPath(); 
      ctx.arc(b.x,b.y,4,0,Math.PI*2); 
      ctx.fill(); 
    }
    ctx.restore();

    // asteroids
    for (let a of asteroids){ drawAsteroid(a); }
    
    // enemies
    for (let e of enemies){ drawEnemy(e); }

    // powerups
    for (let p of powerups){
      if (p.type === 'hp' || p.type === 'shield'){
        ctx.fillStyle = p.type==='hp' ? '#5f5' : '#55f';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
        ctx.fill();
      } else if (p.type === 'rainbow'){
        const hue = (uiTime * 200) % 360;
        ctx.fillStyle = `hsl(${hue},100%,60%)`;
        ctx.beginPath();
        for (let i=0;i<5;i++){
          const ang = -Math.PI/2 + i*2*Math.PI/5;
          ctx.lineTo(p.x + Math.cos(ang)*p.r, p.y + Math.sin(ang)*p.r);
          const ang2 = ang + Math.PI/5;
          ctx.lineTo(p.x + Math.cos(ang2)*p.r*0.5, p.y + Math.sin(ang2)*p.r*0.5);
        }
        ctx.closePath();
        ctx.fill();
      }
    }

    // particles
    ctx.save();
    for (let p of particles){
      const alpha = Math.max(0,p.life/p.maxLife);
      ctx.fillStyle = `rgba(120,220,255,${alpha})`;
      ctx.shadowColor = '#9ff'; ctx.shadowBlur = 12 * alpha;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();

    drawTrail();
    drawPlayer();
  }

  drawHUD();
  if (state==='mainmenu') drawMainMenu();
  if (state==='hangar') drawHangar();
  if (state==='settings') drawSettings();
  if (state==='paused') drawPause();
  if (state==='gameover') drawGameOver();
  if (state==='levelcomplete') drawLevelComplete();

  drawVignette();
  drawScanlines();
}

function drawEnemy(enemy){
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  
  // Health bar for miniboss
  if (enemy.type === 'MINIBOSS'){
    const barW = 60, barH = 6;
    const pct = enemy.hp / enemy.maxHp;
    ctx.fillStyle = 'rgba(60,0,0,0.8)';
    ctx.fillRect(-barW/2, -enemy.size - 15, barW, barH);
    ctx.fillStyle = '#f44';
    ctx.fillRect(-barW/2, -enemy.size - 15, barW * pct, barH);
  }
  
  // Ship body
  ctx.fillStyle = enemy.color + '60';
  ctx.strokeStyle = enemy.color;
  ctx.lineWidth = 2;
  ctx.shadowColor = enemy.color;
  ctx.shadowBlur = 10;
  
  if (enemy.type === 'MINIBOSS'){
    // Large diamond shape
    ctx.beginPath();
    ctx.moveTo(0, -enemy.size);
    ctx.lineTo(-enemy.size*0.8, 0);
    ctx.lineTo(0, enemy.size);
    ctx.lineTo(enemy.size*0.8, 0);
    ctx.closePath();
  } else {
    // Triangle pointing down
    ctx.beginPath();
    ctx.moveTo(0, enemy.size);
    ctx.lineTo(-enemy.size*0.7, -enemy.size);
    ctx.lineTo(enemy.size*0.7, -enemy.size);
    ctx.closePath();
  }
  
  ctx.fill();
  ctx.stroke();
  
  // Engine glow
  ctx.fillStyle = enemy.color;
  ctx.shadowBlur = 8;
  if (enemy.type === 'MINIBOSS'){
    ctx.beginPath();
    ctx.arc(-enemy.size*0.4, enemy.size*0.5, 3, 0, Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(enemy.size*0.4, enemy.size*0.5, 3, 0, Math.PI*2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(0, -enemy.size*0.6, 2, 0, Math.PI*2);
    ctx.fill();
  }
  
  ctx.restore();
}

function drawThrusterParticles(){
  ctx.save();
  for (let p of thrusterParticles){
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 8 * alpha;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawBackground(){
  const g = ctx.createRadialGradient(WIDTH*0.3, HEIGHT*0.2, 40, WIDTH*0.3, HEIGHT*0.2, 500);
  g.addColorStop(0, 'rgba(10,40,60,0.35)'); 
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; 
  ctx.fillRect(0,0,WIDTH,HEIGHT);

  ctx.save(); 
  ctx.strokeStyle = 'rgba(0,255,255,0.06)'; 
  ctx.lineWidth = 1;
  for (let x = 0; x <= WIDTH; x += 40){ 
    ctx.beginPath(); 
    ctx.moveTo(x,0); 
    ctx.lineTo(x,HEIGHT); 
    ctx.stroke(); 
  }
  for (let y = 0; y <= HEIGHT; y += 40){ 
    ctx.beginPath(); 
    ctx.moveTo(0,y); 
    ctx.lineTo(WIDTH,y); 
    ctx.stroke(); 
  }

  const t = uiTime;
  drawStars(50, 0.25, t * 12);
  drawStars(30, 0.45, t * 24);
  drawStars(20, 0.7, t * 40);
  ctx.restore();
}

function drawStars(count, alpha, offset){
  ctx.fillStyle = `rgba(155,255,255,${alpha})`;
  for (let i = 0; i < count; i++){
    const x = (pseudoNoise(i*13.3) * WIDTH + offset) % WIDTH;
    const y = (pseudoNoise(i*7.7) * HEIGHT + (offset*0.5)) % HEIGHT;
    ctx.fillRect((x|0), (y|0), 2, 2);
  }
}

function drawPlayer(){
  const ship = getShip();
  const colors = ship.colors;
  const {x, y} = player;

  ctx.save();
  ctx.translate(x, y);

    switch(ship.id){
      case 'scout': drawScoutShip(colors); break;
      case 'raptor': drawRaptorShip(colors); break;
      case 'nova': drawNovaShip(colors); break;
      case 'zenith': drawZenithShip(colors); break;
      case 'aurora': drawAuroraShip(colors); break;
      case 'eclipse': drawEclipseShip(colors); break;
      default: drawScoutShip(colors); break;
    }

  drawShipExtras(ship.level, colors);
  
  if (player.iTime > 0){ 
    ctx.globalAlpha = 0.6 + 0.4*Math.sin(elapsed*20); 
    ctx.strokeStyle = '#fff'; 
    ctx.lineWidth = 3; 
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 12;
    ctx.beginPath(); 
    ctx.arc(0,0,PLAYER_R+8,0,Math.PI*2); 
    ctx.stroke(); 
    ctx.globalAlpha = 1;
  }

  if (player.shield > 0){
    ctx.strokeStyle = '#5cf';
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(0,0,PLAYER_R+6,0,Math.PI*2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  if (player.rainbowTime > 0){
    const hue = (uiTime * 360) % 360;
    ctx.strokeStyle = `hsl(${hue},100%,60%)`;
    ctx.lineWidth = 4;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(0,0,PLAYER_R+10,0,Math.PI*2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  ctx.restore();
}

function drawShipExtras(level, colors){
  // Ships gain extra visual flair as they are upgraded.  This makes
  // progression much more visible to the player.

  if (level >= 2){
    // Add small wing boosters on the sides plus an accent line.
    ctx.fillStyle = colors.secondary;

    // left booster
    ctx.beginPath();
    ctx.moveTo(-PLAYER_R*0.8, PLAYER_R*0.1);
    ctx.lineTo(-PLAYER_R*0.4, PLAYER_R*0.6);
    ctx.lineTo(-PLAYER_R*0.3, PLAYER_R*0.1);
    ctx.closePath();
    ctx.fill();

    // right booster
    ctx.beginPath();
    ctx.moveTo(PLAYER_R*0.8, PLAYER_R*0.1);
    ctx.lineTo(PLAYER_R*0.4, PLAYER_R*0.6);
    ctx.lineTo(PLAYER_R*0.3, PLAYER_R*0.1);
    ctx.closePath();
    ctx.fill();

    // central accent stripe
    ctx.fillRect(-PLAYER_R*0.5, PLAYER_R*0.2, PLAYER_R, 2);
  }

  if (level >= 3){
    // Highest level ships get an animated energy ring around them for a
    // very noticeable upgrade.
    const pulse = 0.6 + 0.4 * Math.sin(uiTime * 5);
    ctx.strokeStyle = colors.core;
    ctx.lineWidth = 2;
    ctx.shadowColor = colors.core;
    ctx.shadowBlur = 12;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(0, 0, (PLAYER_R + 6) * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    // small glowing node near the nose
    ctx.fillStyle = colors.core;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(0, -PLAYER_R * 0.3, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

function drawScoutShip(colors){
  ctx.shadowColor = colors.primary;
  ctx.shadowBlur = 15;
  
  ctx.fillStyle = colors.primary + '40';
  ctx.strokeStyle = colors.primary;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -PLAYER_R);
  ctx.lineTo(-PLAYER_R*0.6, PLAYER_R*0.3);
  ctx.lineTo(-PLAYER_R*0.3, PLAYER_R);
  ctx.lineTo(PLAYER_R*0.3, PLAYER_R);
  ctx.lineTo(PLAYER_R*0.6, PLAYER_R*0.3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  
  ctx.fillStyle = colors.core;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, Math.PI*2);
  ctx.fill();
  
  ctx.fillStyle = colors.secondary;
  ctx.fillRect(-PLAYER_R*0.4, PLAYER_R*0.5, 3, 8);
  ctx.fillRect(PLAYER_R*0.4-3, PLAYER_R*0.5, 3, 8);
}

function drawRaptorShip(colors){
  ctx.shadowColor = colors.primary;
  ctx.shadowBlur = 15;
  
  ctx.fillStyle = colors.primary + '50';
  ctx.strokeStyle = colors.primary;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, -PLAYER_R);
  ctx.lineTo(-PLAYER_R*0.8, PLAYER_R*0.6);
  ctx.lineTo(-PLAYER_R*0.4, PLAYER_R);
  ctx.lineTo(PLAYER_R*0.4, PLAYER_R);
  ctx.lineTo(PLAYER_R*0.8, PLAYER_R*0.6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  
  ctx.fillStyle = colors.secondary;
  ctx.fillRect(-PLAYER_R*0.9, PLAYER_R*0.2, PLAYER_R*0.3, 4);
  ctx.fillRect(PLAYER_R*0.6, PLAYER_R*0.2, PLAYER_R*0.3, 4);
  
  ctx.fillStyle = colors.core;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(-PLAYER_R*0.5, PLAYER_R*0.7, 3, 0, Math.PI*2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(PLAYER_R*0.5, PLAYER_R*0.7, 3, 0, Math.PI*2);
  ctx.fill();
}

function drawNovaShip(colors){
  ctx.shadowColor = colors.primary;
  ctx.shadowBlur = 18;
  
  ctx.fillStyle = colors.primary + '45';
  ctx.strokeStyle = colors.primary;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, -PLAYER_R*1.1);
  ctx.lineTo(-PLAYER_R*0.7, PLAYER_R*0.8);
  ctx.lineTo(PLAYER_R*0.7, PLAYER_R*0.8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  
  ctx.strokeStyle = colors.core;
  ctx.lineWidth = 3;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.moveTo(-PLAYER_R*0.7, PLAYER_R*0.8);
  ctx.lineTo(-PLAYER_R*1.2, PLAYER_R*0.4);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(PLAYER_R*0.7, PLAYER_R*0.8);
  ctx.lineTo(PLAYER_R*1.2, PLAYER_R*0.4);
  ctx.stroke();
  
  const pulse = 0.7 + 0.3 * Math.sin(uiTime * 8);
  ctx.fillStyle = colors.core;
  ctx.shadowBlur = 15 * pulse;
  ctx.beginPath();
  ctx.arc(0, 0, 5 * pulse, 0, Math.PI*2);
  ctx.fill();
}

function drawZenithShip(colors){
  ctx.shadowColor = colors.primary;
  ctx.shadowBlur = 20;
  
  ctx.fillStyle = colors.primary + '55';
  ctx.strokeStyle = colors.primary;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -PLAYER_R*1.2);
  ctx.lineTo(-PLAYER_R*0.9, PLAYER_R*0.2);
  ctx.lineTo(-PLAYER_R*0.5, PLAYER_R);
  ctx.lineTo(PLAYER_R*0.5, PLAYER_R);
  ctx.lineTo(PLAYER_R*0.9, PLAYER_R*0.2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  
  ctx.strokeStyle = colors.secondary;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-PLAYER_R*0.4, -PLAYER_R*0.5);
  ctx.lineTo(PLAYER_R*0.4, -PLAYER_R*0.5);
  ctx.stroke();
  
  ctx.fillStyle = colors.core;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(-PLAYER_R*0.6, PLAYER_R*0.8, 2.5, 0, Math.PI*2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, PLAYER_R*0.9, 3, 0, Math.PI*2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(PLAYER_R*0.6, PLAYER_R*0.8, 2.5, 0, Math.PI*2);
  ctx.fill();
}

function drawAuroraShip(colors){
  ctx.shadowColor = colors.primary;
  ctx.shadowBlur = 25;
  
  ctx.fillStyle = colors.primary + '60';
  ctx.strokeStyle = colors.primary;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, -PLAYER_R*1.3);
  ctx.lineTo(-PLAYER_R*0.6, -PLAYER_R*0.3);
  ctx.lineTo(-PLAYER_R*0.8, PLAYER_R*0.5);
  ctx.lineTo(-PLAYER_R*0.3, PLAYER_R);
  ctx.lineTo(PLAYER_R*0.3, PLAYER_R);
  ctx.lineTo(PLAYER_R*0.8, PLAYER_R*0.5);
  ctx.lineTo(PLAYER_R*0.6, -PLAYER_R*0.3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  
  const phase = uiTime * 6;
  ctx.strokeStyle = colors.core;
  ctx.lineWidth = 2;
  ctx.shadowBlur = 15;
  ctx.globalAlpha = 0.7 + 0.3 * Math.sin(phase);
  ctx.beginPath();
  ctx.arc(-PLAYER_R*0.5, 0, 8, 0, Math.PI*2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(PLAYER_R*0.5, 0, 8, 0, Math.PI*2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  
  ctx.fillStyle = colors.core;
  ctx.shadowBlur = 20;
  const coreSize = 4 + 2 * Math.sin(phase * 1.5);
  ctx.beginPath();
  ctx.arc(0, 0, coreSize, 0, Math.PI*2);
  ctx.fill();
}

function drawEclipseShip(colors){
  ctx.shadowColor = colors.primary;
  ctx.shadowBlur = 28;

  ctx.fillStyle = colors.primary + '50';
  ctx.strokeStyle = colors.primary;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, -PLAYER_R*1.4);
  ctx.lineTo(-PLAYER_R*0.8, -PLAYER_R*0.2);
  ctx.lineTo(-PLAYER_R*0.6, PLAYER_R*0.6);
  ctx.lineTo(-PLAYER_R*0.2, PLAYER_R*1.1);
  ctx.lineTo(PLAYER_R*0.2, PLAYER_R*1.1);
  ctx.lineTo(PLAYER_R*0.6, PLAYER_R*0.6);
  ctx.lineTo(PLAYER_R*0.8, -PLAYER_R*0.2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  const phase = uiTime * 8;
  ctx.strokeStyle = colors.secondary;
  ctx.lineWidth = 1.5;
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.arc(0, -PLAYER_R*0.1, PLAYER_R*0.9 + Math.sin(phase)*1.5, 0, Math.PI*2);
  ctx.stroke();

  ctx.fillStyle = colors.core;
  ctx.shadowBlur = 25;
  const coreSize = 5 + 1.5 * Math.sin(phase*1.3);
  ctx.beginPath();
  ctx.arc(0, 0, coreSize, 0, Math.PI*2);
  ctx.fill();
}

function drawTrail(){
  ctx.save();
  const ship = getShip();
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';

  for (let i=1;i<trail.length;i++){
    const a = trail[i-1], b = trail[i];
    const t = i/trail.length;
    ctx.globalAlpha = t * 0.8;
    if (player.rainbowTime > 0){
      const hue = (uiTime*360 + t*360) % 360;
      ctx.strokeStyle = `hsl(${hue},100%,60%)`;
      ctx.shadowColor = ctx.strokeStyle;
    } else {
      ctx.strokeStyle = ship.colors.primary + '60';
      ctx.shadowColor = ship.colors.primary;
    }
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawAsteroid(a){
  if (!a || !Array.isArray(a.points) || a.points.length===0){ return; }
  ctx.save(); ctx.translate(a.x,a.y); ctx.rotate(a.rot);
  ctx.fillStyle = COLORS.asteroidFill; ctx.strokeStyle = COLORS.asteroidStroke; ctx.lineWidth = 2;
  ctx.shadowColor = COLORS.asteroidStroke; ctx.shadowBlur = 10;
  ctx.beginPath(); ctx.moveTo(a.points[0].x, a.points[0].y);
  for (let i=1;i<a.points.length;i++){ const p=a.points[i]; ctx.lineTo(p.x,p.y); }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}

function drawHUD(){
  ctx.save();
  ctx.fillStyle = COLORS.hud; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.font = '16px system-ui, sans-serif';
  if (state === 'playing'){
    hudChip(10, 10, `Score: ${score}`);
    hudChip(10, 40, `Level: ${currentLevel}-${currentWave}`);
    
    // Wave info
    const waveNames = ['Asteroids', 'Enemies', 'Miniboss'];
    const waveName = waveNames[currentWave - 1] || 'Unknown';
    hudChip(10, 70, `Wave: ${waveName}`);
    
    if (waveState === 'preparing'){
      hudChip(WIDTH/2 - 80, 10, `Preparing... ${Math.ceil(waveTransitionTimer)}`, false);
    } else if (waveState === 'completed'){
      hudChip(WIDTH/2 - 80, 10, `Wave Complete! +${WAVE_REWARDS[currentWave-1]} credits`, false);
    } else if (waveState === 'active'){
      const remaining = waveEnemiesTotal - waveEnemiesKilled;
      hudChip(WIDTH/2 - 60, 10, `Enemies: ${remaining}`, false);
    }
    
    hudChip(WIDTH-10, 10, `Best: ${best}`, true);
    hudChip(WIDTH-10, 40, `Credits: ${credits}`, true);
    hudChip(WIDTH-10, 70, `Weapon: ${currentWeapon}`, true);

    // HP bar
    const pct = Math.max(0, Math.min(1, player.hp / player.maxHp));
    const HPX=10, HPY=HEIGHT-30, HPW=220, HPH=12;
    ctx.fillStyle='rgba(0,20,30,0.7)'; roundRect(HPX,HPY,HPW,HPH,6); ctx.fill();
    ctx.fillStyle= pct<0.3 ? '#ff7a7a' : '#7af'; roundRect(HPX,HPY,HPW*pct,HPH,6); ctx.fill();
    ctx.fillStyle=COLORS.hud; ctx.fillText(`HP ${Math.ceil(player.hp)}/${player.maxHp}`, HPX, HPY-18);
  } else if (state === 'hangar'){
    ctx.textAlign='right'; hudChip(WIDTH-10,10,`Credits: ${credits}`, true);
  }
  ctx.restore();
}
function hudChip(x,y,text,right=false){
  const pad=8; ctx.font='16px system-ui, sans-serif'; const w = ctx.measureText(text).width + pad*2; const h = 24;
  const rx = right ? x - w : x;
  ctx.fillStyle = 'rgba(0,40,60,0.6)'; ctx.strokeStyle = 'rgba(155,255,255,0.35)'; ctx.lineWidth = 1.5;
  roundRect(rx,y,w,h,8); ctx.fill(); ctx.stroke(); ctx.fillStyle = COLORS.hud; ctx.fillText(text, rx + pad, y + 4);
}
function roundRect(x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }

function drawMainMenu(){
  ctx.fillStyle='rgba(0,0,10,0.65)'; ctx.fillRect(0,0,WIDTH,HEIGHT);
  const t = uiTime; const cx=WIDTH/2, cy=120, r=110, n=14;
  for (let i=0;i<n;i++){
    const a = t*0.8 + i*(Math.PI*2/n);
    const x = cx + Math.cos(a)*r, y = cy + Math.sin(a)*r*0.45;
    const alpha = 0.25 + 0.35 * (0.5+0.5*Math.sin(a+t));
    ctx.fillStyle = `rgba(155,255,255,${alpha})`; ctx.beginPath(); ctx.arc(x,y,2,0,Math.PI*2); ctx.fill();
  }
  ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle=COLORS.hud;
  ctx.font='bold 52px system-ui, sans-serif'; ctx.fillText('Space Mini', WIDTH/2, 120);

  drawButton(WIDTH/2-140, 220, 280, 44, 'New Game', ()=>{ startGame(); });
  drawButton(WIDTH/2-140, 276, 280, 44, hasSaveSlot()?'Load Game':'Load Game (empty)', ()=>{ const st=loadGameState(); if(st){ transitionTo(st); if(state==='levelcomplete') levelCompleteTime=3; } }, !hasSaveSlot());
  drawButton(WIDTH/2-140, 332, 280, 44, 'Settings', ()=>{ toSettings(); });
  drawButton(WIDTH/2-140, 388, 280, 44, 'Hangar', ()=>{ toHangar(); });

  ctx.fillStyle='rgba(180,220,240,0.7)'; ctx.font='14px system-ui, sans-serif';
  ctx.fillText('5 Levels • 3 Waves Each • Epic Boss Battles', WIDTH/2, HEIGHT-40);
  ctx.fillText('Click once to enable audio', WIDTH/2, HEIGHT-20);
}
function drawSettings(){
  ctx.fillStyle='rgba(0,0,10,0.65)'; ctx.fillRect(0,0,WIDTH,HEIGHT);
  ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle=COLORS.hud;
  ctx.font='bold 44px system-ui, sans-serif'; ctx.fillText('Settings', WIDTH/2, 100);

  ctx.font='18px system-ui, sans-serif'; ctx.fillText('Difficulty', WIDTH/2, 160);
  drawToggleRow(WIDTH/2, 190, [
    {id:'easy', label:'Easy'}, {id:'medium', label:'Medium'}, {id:'hard', label:'Hard'}
  ], difficulty, (id)=>{ if (DIFFS[id]) { difficulty=id; saveProgress(); } });

  ctx.fillText('Audio', WIDTH/2, 270);
  drawToggleRow(WIDTH/2, 300, [
    {id:'music', label:`Music: ${musicOn?'ON':'OFF'}`},
    {id:'sfx', label:`SFX: ${sfxOn?'ON':'OFF'}`}
  ], null, (id)=>{ if (id==='music'){ musicOn=!musicOn; saveProgress(); refreshMusic(); } if (id==='sfx'){ sfxOn=!sfxOn; saveProgress(); } });

  drawButton(WIDTH/2-100, 380, 200, 44, 'Back', ()=>{ toMain(); });
}
function drawHangar(){
  if (!dragging){
    const k = 0.1; hangarOffset += (hangarTarget - hangarOffset)*k;
  }

  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillStyle=COLORS.hud; ctx.font='bold 46px system-ui, sans-serif'; ctx.fillText('Hangar', WIDTH/2, 70);
  ctx.font='16px system-ui, sans-serif'; ctx.fillText('Drag to browse • Click to select • Buy or Upgrade', WIDTH/2, 104);

  const step = CARD_W + CARD_GAP;
  const startX = WIDTH/2 - CARD_W/2;
  for (let i=0;i<SHIPS.length;i++){
    const x = Math.round(startX + i*step - hangarOffset);
    const y = HEIGHT/2 - CARD_H/2;
    const focused = Math.round(hangarTarget/step) === i;
    drawShipCard(x,y,SHIPS[i],focused);
  }

  const focusIdx = Math.max(0, Math.min(SHIPS.length-1, Math.round(hangarTarget/step)));
  const focus = SHIPS[focusIdx];

  drawButton(20, HEIGHT-48, 120, 40, 'Back', ()=>{ backFromHangar(); }, false, true);

  if (!owned.has(focus.id)) {
    const canBuy = credits >= focus.cost;
    drawButton(WIDTH/2 - 90, HEIGHT-100, 180, 44, `Buy (${focus.cost})`, ()=>{ tryBuy(focus); }, !canBuy);
  } else {
    const lvl = shipLevels[focus.id] || 1;
    const next = lvl + 1;
    if (next <= MAX_SHIP_LEVEL){
      const cost = UPGRADE_COSTS[next] || 0;
      const canUp = credits >= cost;
      drawButton(WIDTH/2 - 90, HEIGHT-100, 180, 44, `Upgrade (${cost})`, ()=>{ upgradeShip(focus); }, !canUp);
    } else {
      drawButton(WIDTH/2 - 90, HEIGHT-100, 180, 44, 'Max Level', ()=>{}, true);
    }
  }
}
function drawShipCard(x,y,ship,focused){
  const hover = mouse.x>=x && mouse.x<=x+CARD_W && mouse.y>=y && mouse.y<=y+CARD_H;
  ctx.save(); ctx.translate(x,y);
  ctx.fillStyle = focused ? 'rgba(0,50,80,0.7)' : (hover ? 'rgba(0,40,70,0.6)' : 'rgba(0,25,40,0.55)');
  ctx.strokeStyle = focused ? '#aff' : 'rgba(155,255,255,0.25)';
  ctx.lineWidth = focused ? 2 : 1; roundRect(0,0,CARD_W,CARD_H,14); ctx.fill(); ctx.stroke();

  ctx.save();
  ctx.translate(CARD_W/2, 95);
  ctx.scale(0.8, 0.8);

  const colors = ship.colors;
  const level = shipLevels[ship.id] || 1;
  switch(ship.id){
    case 'scout': drawScoutShip(colors); break;
    case 'raptor': drawRaptorShip(colors); break;
      case 'nova': drawNovaShip(colors); break;
      case 'zenith': drawZenithShip(colors); break;
      case 'aurora': drawAuroraShip(colors); break;
      case 'eclipse': drawEclipseShip(colors); break;
      default: drawScoutShip(colors); break;
    }
  drawShipExtras(level, colors);

  ctx.restore();

  ctx.fillStyle = COLORS.hud; ctx.textAlign = 'center';
  ctx.font = 'bold 18px system-ui, sans-serif'; ctx.fillText(ship.name, CARD_W/2, 24);
  ctx.font = '14px system-ui, sans-serif'; ctx.fillText(owned.has(ship.id)?'OWNED':`COST: ${ship.cost}`, CARD_W/2, CARD_H - 26);
  if (selectedShipId === ship.id) { ctx.fillStyle = '#9ff'; ctx.fillText('SELECTED', CARD_W/2, CARD_H - 46); }
  ctx.fillStyle = COLORS.hud;
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(`Level ${level}`, CARD_W/2, 120);

  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(180,220,240,0.8)';
  const stats = statsFor(ship, level);
  ctx.fillText(`HP: ${stats.hp} | Speed: ${(stats.speedMul*100).toFixed(0)}%`, CARD_W/2, 140);
  ctx.fillText(`Fire Rate: ${(100/stats.cooldownMul).toFixed(0)}%`, CARD_W/2, 155);

  if (hover && !dragging && dragAccum < 6 && wasJustClicked()){
    const step = CARD_W + CARD_GAP;
    const idx = SHIPS.findIndex(s=>s.id===ship.id);
    hangarTarget = idx * step;
    if (owned.has(ship.id)){ selectedShipId = ship.id; saveProgress(); }
  }
  ctx.restore();
}

const clicks = { t:0 };
function wasJustClicked(){ 
  const now = performance.now(); 
  const hit = clicks.t > 0 && (now - clicks.t) < 180; 
  if (hit) clicks.t = 0;
  return hit; 
}

const btns = [];
function drawButton(x,y,w,h,label,fn,disabled=false,bright=false){
  btns.push({x,y,w,h,fn,disabled});
  const hover = mouse.x>=x && mouse.x<=x+w && mouse.y>=y && mouse.y<=y+h;
  ctx.save(); ctx.globalAlpha = disabled?0.6:1;
  const base = bright ? 'rgba(0,60,90,0.7)' : 'rgba(0,40,60,0.7)';
  const hoverCol = bright ? 'rgba(0,80,120,0.8)' : 'rgba(0,60,90,0.8)';
  ctx.fillStyle = hover && !disabled ? hoverCol : base;
  ctx.strokeStyle = hover && !disabled ? '#aff' : 'rgba(155,255,255,0.35)'; ctx.lineWidth = hover?2:1.5; roundRect(x,y,w,h,12); ctx.fill(); ctx.stroke();
  ctx.fillStyle = COLORS.hud; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.font='bold 18px system-ui, sans-serif'; ctx.fillText(label, x+w/2, y+h/2);
  ctx.restore();

  if (!disabled && hover && wasJustClicked()) fn();
}
function drawToggleRow(centerX, y, items, active, onChoose){
  const W=120,H=34,G=14; const total=items.length*W+(items.length-1)*G; let x=centerX-total/2;
  for (let it of items){
    const on = active ? it.id===active : false;
    const hover = mouse.x>=x && mouse.x<=x+W && mouse.y>=y && mouse.y<=y+H;
    ctx.fillStyle = on ? 'rgba(0,80,120,0.9)' : (hover ? 'rgba(0,60,90,0.8)' : 'rgba(0,40,60,0.7)');
    ctx.strokeStyle = on || hover ? '#aff' : 'rgba(155,255,255,0.35)';
    roundRect(x,y,W,H,10); ctx.fill(); ctx.stroke();
    ctx.fillStyle=COLORS.hud; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.font='16px system-ui, sans-serif'; ctx.fillText(it.label, x+W/2, y+H/2);
    if (hover && wasJustClicked()) onChoose(it.id);
    x += W+G;
  }
}

function drawLevelComplete(){
  // Animation phase for first 2 seconds
  const animDuration = 2.0;
  const showMenu = levelCompleteTime >= animDuration;

  ctx.fillStyle='rgba(0,0,10,0.65)';
  ctx.fillRect(0,0,WIDTH,HEIGHT);

  const msg = currentLevel >= MAX_LEVELS ? 'Victory!' : `Level ${currentLevel} Complete!`;
  const t = Math.min(levelCompleteTime, animDuration);
  const scale = 1 + 0.1*Math.sin(t*4);

  ctx.save();
  ctx.textAlign='center';
  ctx.textBaseline='middle';
  ctx.fillStyle=COLORS.hud;
  ctx.translate(WIDTH/2, HEIGHT/2 - 80);
  ctx.scale(scale, scale);
  ctx.font='bold 44px system-ui, sans-serif';
  ctx.fillText(msg, 0, 0);
  ctx.restore();

  // Expanding ring
  ctx.save();
  ctx.strokeStyle = `rgba(180,220,255,${1 - t/animDuration})`;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(WIDTH/2, HEIGHT/2 - 80, t*60, 0, Math.PI*2);
  ctx.stroke();
  ctx.restore();

  // Sparkle particles
  for (let p of levelCompleteParticles){
    const a = p.life / p.maxLife;
    ctx.fillStyle = `rgba(255,255,200,${a})`;
    ctx.fillRect(p.x-2, p.y-2, 4, 4);
  }

  if (showMenu){
    drawButton(WIDTH/2-110, HEIGHT/2 - 20, 220, 40, 'Main Menu', ()=>{ toMain(); });
    drawButton(WIDTH/2-110, HEIGHT/2 + 30, 220, 40, 'Hangar', ()=>{ toHangar('levelcomplete'); });
    drawButton(WIDTH/2-110, HEIGHT/2 + 80, 220, 40, 'Save Game', ()=>{ saveGameState(); });
    const disableNext = currentLevel >= MAX_LEVELS;
    drawButton(WIDTH/2-110, HEIGHT/2 + 130, 220, 40, 'Next Level', ()=>{ proceedToNextLevel(); }, disableNext);
  }
}

function drawPause(){
  ctx.fillStyle='rgba(0,0,10,0.65)'; ctx.fillRect(0,0,WIDTH,HEIGHT);
  ctx.fillStyle=COLORS.hud; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.font='bold 44px system-ui, sans-serif'; ctx.fillText('Paused', WIDTH/2, HEIGHT/2 - 100);
  drawButton(WIDTH/2-110, HEIGHT/2 - 40, 220, 40, 'Resume', ()=>{ resumeGame(); });
  drawButton(WIDTH/2-110, HEIGHT/2 + 10, 220, 40, 'Save Game', ()=>{ saveGameState(); });
  drawButton(WIDTH/2-110, HEIGHT/2 + 60, 220, 40, 'Hangar', ()=>{ toHangar(); });
  drawButton(WIDTH/2-110, HEIGHT/2 + 110, 220, 40, 'Main Menu', ()=>{ toMain(); });
}
function drawGameOver(){
  ctx.fillStyle='rgba(0,0,10,0.65)'; ctx.fillRect(0,0,WIDTH,HEIGHT);
  ctx.fillStyle = COLORS.warning; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = 'bold 44px system-ui, sans-serif'; 
  
  if (currentLevel >= MAX_LEVELS && currentWave > WAVES_PER_LEVEL){
    ctx.fillText('Victory!', WIDTH/2, HEIGHT/2 - 56);
    ctx.fillStyle = COLORS.hud; ctx.font = '20px system-ui, sans-serif';
    ctx.fillText('All levels completed!', WIDTH/2, HEIGHT/2 - 20);
  } else {
    ctx.fillText('Game Over', WIDTH/2, HEIGHT/2 - 56);
  }
  
  ctx.fillStyle = COLORS.hud; ctx.font = '20px system-ui, sans-serif';
  ctx.fillText('Final Score: ' + score, WIDTH/2, HEIGHT/2 + 0);
  drawButton(WIDTH/2 - 110, HEIGHT/2 + 50, 220, 40, 'Main Menu', ()=>{ toMain(); });
}

function getShip(){
  const base = SHIPS.find(s=>s.id===selectedShipId) || SHIPS[0];
  const level = shipLevels[selectedShipId] || 1;
  const stats = statsFor(base, level);
  return { ...base, level, stats };
}
function tryBuy(ship){
  if (owned.has(ship.id)) return;
  if (credits >= ship.cost){
    credits -= ship.cost;
    owned.add(ship.id);
    selectedShipId = ship.id;
    shipLevels[ship.id] = shipLevels[ship.id] || 1;
    const hp = statsFor(ship, shipLevels[ship.id]).hp;
    if (player){ player.maxHp = hp; player.hp = hp; player.shield = 0; }
    saveProgress();
  }
}
function upgradeShip(ship){
  const lvl = shipLevels[ship.id] || 1;
  if (lvl >= MAX_SHIP_LEVEL) return;
  const cost = UPGRADE_COSTS[lvl+1] || 0;
  if (credits >= cost){
    credits -= cost;
    shipLevels[ship.id] = lvl+1;
    if (ship.id === selectedShipId){
      const hp = statsFor(ship, shipLevels[ship.id]).hp;
      if (player){ player.maxHp = hp; player.hp = hp; }
    }
    saveProgress();
  }
}
function selectFocused(){
  const idx = Math.max(0, Math.min(SHIPS.length-1, Math.round(hangarTarget/(CARD_W+CARD_GAP))));
  const ship = SHIPS[idx];
  if (owned.has(ship.id)){ selectedShipId = ship.id; saveProgress(); }
}
function focusBy(d){ const step=CARD_W+CARD_GAP; const idx = Math.round(hangarTarget/step)+d; hangarTarget = Math.max(0, Math.min(SHIPS.length-1, idx))*step; }
function snapHangar(){ const step=CARD_W+CARD_GAP; const idx = Math.round(hangarOffset/step); hangarTarget = Math.max(0, Math.min(SHIPS.length-1, idx))*step; }

function addShake(a,d){ shakeA=a; shakeT=Math.min(2, d); }
function spawnExplosion(x,y,s){ const n=10+(s|0); for (let i=0;i<n;i++){ const a=Math.random()*Math.PI*2; const sp=randRange(60,220)*(0.6+s/30); particles.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,r:randRange(1.2,2.8),life:randRange(0.25,0.6),maxLife:0.6}); } }
function randRange(a,b){ return Math.random()*(b-a)+a; }
function circleHit(ax,ay,ar,bx,by,br){ const dx=ax-bx, dy=ay-by; const rr=ar+br; return dx*dx+dy*dy<=rr*rr; }
function pseudoNoise(n){ return ((Math.sin(n*12.9898+78.233)*43758.5453)%1+1)%1; }
function drawVignette(){ const g = ctx.createRadialGradient(WIDTH/2, HEIGHT/2, Math.min(WIDTH,HEIGHT)*0.35, WIDTH/2, HEIGHT/2, Math.max(WIDTH,HEIGHT)*0.7); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)'); ctx.fillStyle = g; ctx.fillRect(0,0,WIDTH,HEIGHT); }
function drawScanlines(){ ctx.save(); ctx.globalAlpha = 0.08; ctx.fillStyle = '#000'; for (let y=0; y<HEIGHT; y+=2){ ctx.fillRect(0,y,WIDTH,1); } ctx.restore(); }

function makeAsteroid(x,y,r,v){
  const pts=[]; const N = 8 + (r|0)%5;
  for (let i=0;i<N;i++){ const ang=(i/N)*Math.PI*2; const rr = r*(0.78+Math.random()*0.35); pts.push({x:Math.cos(ang)*rr,y:Math.sin(ang)*rr}); }
  return { x,y,r,v,rot:0,rotV:randRange(-1,1), points:pts };
}

init();

