/* ===========================
   Constants
   =========================== */
const WIDTH = 800, HEIGHT = 600;
const PLAYER_R = 18, BASE_SPEED = 240;
const BULLET_SPEED = 460, BULLET_R = 3, BASE_COOLDOWN = 0.14;
const AST_MIN_R = 16, AST_MAX_R = 36, AST_MIN_V = 90, AST_MAX_V = 180;
const COLORS = {
  hud:'#bff', bullet:'#c8f6ff', star:'#9ff', accent:'#7af', warning:'#fba',
  shipStroke:'#9ff', shipFill:'rgba(0,220,255,0.16)',
  asteroidFill:'#0f1a22', asteroidStroke:'#58e',
  enemyFill:'#4a0a0a', enemyStroke:'#f44'
};
const DIFFS = {
  easy:   { spawnMul: 1.10, speedMul: 0.9, healthMul: 0.8 },
  medium: { spawnMul: 1.00, speedMul: 1.0, healthMul: 1.0 },
  hard:   { spawnMul: 0.85, speedMul: 1.15, healthMul: 1.2 }
};

// Wave System Constants
const WAVE_TYPES = {
  ASTEROIDS: 1,
  ENEMIES: 2,
  MINIBOSS: 3
};
const WAVE_REWARDS = [50, 70, 100];
const MAX_LEVELS = 9;
const WAVES_PER_LEVEL = 3;

// Ship upgrade system
const MAX_SHIP_LEVEL = 3;
const UPGRADE_COSTS = [0, 200, 500, 1000]; // index by target level

/* ===========================
   Enemy Types
   =========================== */
const ENEMY_TYPES = {
  SCOUT: {
    hp: 30, speed: 150, size: 12, color: '#ff4444', shootCooldown: 1.0,
    bulletSpeed: 300, score: 25
  },
  CRUISER: {
    hp: 80, speed: 80, size: 16, color: '#ff8844', shootCooldown: 1.5,
    bulletSpeed: 250, score: 50
  },
  INTERCEPTOR: {
    hp: 50, speed: 120, size: 14, color: '#ff44ff', shootCooldown: 0.8,
    bulletSpeed: 350, score: 35
  },
  MINIBOSS: {
    hp: 300, speed: 60, size: 24, color: '#ff0000', shootCooldown: 0.5,
    bulletSpeed: 280, score: 200
  },
  BOSS3: {
    hp: 900, speed: 60, size: 30, color: '#ff33ff', shootCooldown: 1.0,
    bulletSpeed: 300, score: 700
  },
  BOSS6: {
    hp: 1300, speed: 55, size: 32, color: '#00ffcc', shootCooldown: 1.2,
    bulletSpeed: 320, score: 1100
  },
  BOSS9: {
    hp: 2000, speed: 50, size: 36, color: '#ffee00', shootCooldown: 1.5,
    bulletSpeed: 340, score: 2000
  }
};

/* ===========================
   Ships with Visual Designs
   =========================== */
const SHIPS = [
  {
    id:'scout', name:'SCOUT', cost:0,
    desc:'Balanced starter ship.',
    stats:{ hp:110, speedMul:1.00, cooldownMul:1.00, bulletMul:1.00 },
    colors: { primary:'#00dcff', secondary:'#0099cc', core:'#66efff', thruster:'#00aaff' }
  },
  {
    id:'raptor', name:'RAPTOR', cost:150,
    desc:'Faster firing assault craft.',
    stats:{ hp:140, speedMul:1.05, cooldownMul:0.85, bulletMul:1.00 },
    colors: { primary:'#ff6600', secondary:'#cc4400', core:'#ffaa00', thruster:'#ff8800' }
  },
  {
    id:'nova', name:'NOVA', cost:400,
    desc:'Upgraded cannons pack a punch.',
    stats:{ hp:170, speedMul:1.10, cooldownMul:0.70, bulletMul:1.10 },
    colors: { primary:'#aa00ff', secondary:'#6600aa', core:'#dd55ff', thruster:'#cc44ff' }
  },
  {
    id:'zenith', name:'ZENITH', cost:1000,
    desc:'Elite fighter with rapid fire.',
    stats:{ hp:200, speedMul:1.15, cooldownMul:0.55, bulletMul:1.15 },
    colors: { primary:'#ffaa00', secondary:'#cc7700', core:'#ffdd44', thruster:'#ffcc22' }
  },
  {
    id:'aurora', name:'AURORA', cost:2000,
    desc:'Advanced craft with powerful guns.',
    stats:{ hp:240, speedMul:1.22, cooldownMul:0.45, bulletMul:1.20 },
    colors: { primary:'#00ffaa', secondary:'#00cc77', core:'#55ffcc', thruster:'#22ffaa' }
  },
  {
    id:'eclipse', name:'ECLIPSE', cost:3500,
    desc:'Top tier ship for seasoned pilots.',
    stats:{ hp:280, speedMul:1.30, cooldownMul:0.35, bulletMul:1.25 },
    colors: { primary:'#ff00aa', secondary:'#cc0088', core:'#ff55cc', thruster:'#ff0099' }
  },
];

const BOSSES = [
  { type:'MINIBOSS', name:'Miniboss', desc:'Tough mid-wave foe.' },
  { type:'BOSS3', name:'Sector 3 Boss', desc:'Rotating guardian.' },
  { type:'BOSS6', name:'Sector 6 Boss', desc:'Shielded warship.' },
  { type:'BOSS9', name:'Final Boss', desc:'The ultimate challenge.' },
];
