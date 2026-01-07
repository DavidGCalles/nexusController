// ==========================================
// 2. CONFIGURACIÓN
// ==========================================
const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d', { alpha: false }); 

// Buffer para el laberinto estático
const mazeCanvas = document.createElement('canvas');
const mazeCtx = mazeCanvas.getContext('2d');

const CONFIG = {
    // Player
    playerSpeed: 0.10, // fraction of cellSize
    playerFireRate: 350, // ms
    playerDashSpeed: 0.6,
    playerDashDuration: 150, // ms
    playerDashCooldown: 500, // ms
    playerDashIsDestructive: true,
    playerDashExplosionRadius: 2.5, // times cellSize

    // Ray-Dash Synergy
    rayDashSpeed: 0.9,
    rayDashDuration: 250, // ms
    rayDashExplosionRadius: 4.0, // times cellSize

    // XP & Leveling
    xpPerEnemy: 15,
    xpPerStage: 50,
    xpLevelBase: 100,
    xpLevelMultiplier: 1.5,

    // Ray Skill (Hold RT)
    rayUnlockLevel: 2,
    rayModeColor: '#ff5555',
    rayFireRate: 100, // ms, faster than normal bullets
    rayWidth: 12,
    rayLifetime: 15, // frames
    rayColor: 'rgba(255, 80, 80, 0.8)',

    // Enemy Spawning
    maxEnemies: 3,
    initialSpawnRate: 9000, // ms
    minSpawnRate: 800, // ms
    spawnRateDecay: 0.99, // multiplier per spawn

    // Enemy Stats
    enemyBaseSpeed: 3.0,
    enemySpeedLevelScale: 0.15,
    enemySpeedVariation: 0.3, // e.g. 0.3 -> +/- 15%
    enemySizeVariation: 0.3,  // e.g. 0.3 -> +/- 15%
    enemyMinAccuracy: 0.75,
    enemyAccuracyVariation: 0.25,

    // AI
    aiUpdateTicks: 30, 
    aiUpdateStagger: 15, 
    aiTargetingFuzz: 5.0, // cells
    // Maze generation (parametrizable)
    mazeCorridorWidth: 2, // tiles (must be >=2, even recommended)
    mazeBreakableBlockChance: 0.12, // chance a wall-block becomes destructible
    mazeCarveSeed: null, // optional seed (null for random)
    mazeCarveSpacing: null, // optional override for carving step (null = corridorWidth*2)
};

let w, h, cellSize;
const COLS = 31; 
const ROWS = 17;

let grid = [];      
let destWalls = []; 
let openBlocks = []; // list of carved block top-left coords {r,c}

let level = 1;
let gameState = 'level-select'; 
let lastSpawn = 0;
let spawnRate = 5000; // ms
let spawnPoints = [];
