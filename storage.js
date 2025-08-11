/* ===========================
   Persistence
   =========================== */
function saveProgress(){
  try{
    localStorage.setItem('space_best', String(best));
    localStorage.setItem('space_credits', String(credits));
    localStorage.setItem('space_owned', JSON.stringify([...owned]));
    localStorage.setItem('space_selected', selectedShipId);
    localStorage.setItem('space_diff', difficulty);
    localStorage.setItem('space_music', musicOn?'1':'0');
    localStorage.setItem('space_sfx', sfxOn?'1':'0');
  }catch(e){}
}
function loadProgress(){
  try{
    best = +localStorage.getItem('space_best') || 0;
    credits = +localStorage.getItem('space_credits') || 0;
    const o = JSON.parse(localStorage.getItem('space_owned')||'["scout"]'); owned = new Set(Array.isArray(o)?o:['scout']);
    selectedShipId = localStorage.getItem('space_selected') || 'scout';
    if (!SHIPS.some(s=>s.id===selectedShipId)) selectedShipId = 'scout';
    const d = localStorage.getItem('space_diff'); if (d && DIFFS[d]) difficulty = d;
    musicOn = localStorage.getItem('space_music') !== '0';
    sfxOn = localStorage.getItem('space_sfx') !== '0';
  }catch(e){}
}
function hasSaveSlot(){ return !!localStorage.getItem('space_save_slot'); }
function saveGameState(){
  try{
    const slot = { best, credits, owned:[...owned], selectedShipId, difficulty, player, bullets, asteroids, enemies, enemyBullets, powerups, score, currentLevel, currentWave, waveState, elapsed, lastShotAt, state };
    localStorage.setItem('space_save_slot', JSON.stringify(slot));
  }catch(e){}
}
function loadGameState(){
  try{
    const raw = localStorage.getItem('space_save_slot'); if (!raw) return false;
    const s = JSON.parse(raw);
    best = +s.best || 0; credits = +s.credits || 0; owned = new Set(Array.isArray(s.owned)?s.owned:['scout']);
    selectedShipId = SHIPS.some(sh=>sh.id===s.selectedShipId) ? s.selectedShipId : 'scout';
    difficulty = DIFFS[s.difficulty] ? s.difficulty : 'medium';
    player = s.player || {x:WIDTH/2,y:HEIGHT-80,r:PLAYER_R,maxHp:110,hp:110,iTime:0,shield:0};
    if (player.shield === undefined) player.shield = 0;
    bullets = Array.isArray(s.bullets)? s.bullets : [];
    asteroids = Array.isArray(s.asteroids)? s.asteroids : [];
    enemies = Array.isArray(s.enemies)? s.enemies : [];
    enemyBullets = Array.isArray(s.enemyBullets)? s.enemyBullets : [];
    powerups = Array.isArray(s.powerups)? s.powerups : [];
    score = +s.score || 0;
    currentLevel = +s.currentLevel || 1;
    currentWave = +s.currentWave || 1;
    waveState = s.waveState || 'preparing';
    elapsed = +s.elapsed || 0;
    lastShotAt = +s.lastShotAt || -999;
    const st = s.state || 'playing';
    saveProgress();
    return st;
  }catch(e){ return false; }
}
