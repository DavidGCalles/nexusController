// Entidades
const player = { 
    x: 0, y: 0, r: 0, color: '#00ffff', lastShot: 0, 
    lastDash: 0, isDashing: false, isRayDashing: false, dashAngle: 0,
    isRayModeActive: false,
    level: 1, xp: 0, xpToNextLevel: CONFIG.xpLevelBase,
    pendingXP: 0, // XP awarded from stage completion, merged later
    levelUpGlow: 0 // For the level up animation
}; 
let enemies = [];
const goal = { c: 0, r: 0 };
let bullets = [];
let rays = [];
let particles = [];
