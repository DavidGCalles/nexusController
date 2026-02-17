// main.js

const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d');

let w, h;
let gameState = 'lobby'; 
let players = []; 
let enemies = []; 
let bullets = []; 
let activeNoises = []; // Buffer de sonido para la IA
let gameGrid = null;     

// Datos temporales
let lobbyData = [];
let currentMode = null;

// CONFIGURACIÓN DE PARTIDA
const FRIENDLY_FIRE = false; 

// --- SETUP ---
function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// --- TRANSICIÓN 1: LOBBY -> MODE SELECT ---
window.goToModeSelect = function(playersFromLobby) {
    lobbyData = playersFromLobby; 
    window.initModeSelect(lobbyData); 
    gameState = 'mode-select';
}

// --- TRANSICIÓN 2: LANZAMIENTO ---
// Acepta levelId opcional (String de levels.js)
window.launchGame = function(modeId, levelId) {
    console.log(`🚀 LANZANDO: ${modeId} @ ${levelId || 'PROCEDURAL'}`);
    currentMode = modeId;

    gameGrid = new Grid(w, h); 
    
    // Si levelId es null/undefined, cargamos 'RANDOM' (Grid lo interpretará como procedural)
    const mapToLoad = levelId || 'RANDOM';
    
    // Carga el mapa y recalcula la escala de físicas según el tamaño de celda resultante
    const finalCellSize = gameGrid.loadLevel(mapToLoad);
    updateEntityScale(finalCellSize); 

    // 1. SPAWN JUGADORES
    players = lobbyData.map((p, index) => {
        // Pasamos index para usar spawns fijos (P1..P4) si existen en el mapa
        const spawn = gameGrid.getPlayerSpawn(index);
        return new Player(p.id, spawn.x, spawn.y, p.color);
    });
    
    bullets = []; 
    enemies = [];

    // 2. SPAWN ENEMIGOS
    // Si el mapa es manual, usamos sus Spawners. Si es procedural, generamos aleatorios.
    const numEnemies = 12; // Base para procedural

    // Si el Grid detectó spawners manuales, los usamos
    if (gameGrid.enemySpawners.length > 0) {
        // Spawnear un enemigo en cada spawner definido
        gameGrid.enemySpawners.forEach(sp => {
            const px = gameGrid.gridToPixel(sp.r, sp.c);
            // Tipo aleatorio o definir lógica en el futuro
            enemies.push(new Enemy(randomEnemyType(), px.x, px.y));
        });
    } else {
        // Procedural Spawning (Fallback)
        for (let i = 0; i < numEnemies; i++) {
            const spawn = gameGrid.getEnemySpawn(); // Heurístico
            enemies.push(new Enemy(randomEnemyType(), spawn.x, spawn.y));
        }
    }

    gameState = 'playing';
}

function randomEnemyType() {
    const r = Math.random();
    if (r > 0.7) return 'square';
    if (r > 0.9) return 'diamond';
    return 'circle';
}

// --- GAME LOOP ---
function loop() {
    requestAnimationFrame(loop);

    ctx.fillStyle = '#050505'; 
    ctx.fillRect(0, 0, w, h);
    
    activeNoises = []; // Reset ruidos por frame

    if (gameState === 'lobby') {
        updateLobby();
        drawLobby(ctx, w, h);
    }
    else if (gameState === 'mode-select') {
        updateModeSelect();       
        drawModeSelect(ctx, w, h); 
    } 
    else if (gameState === 'playing') {
        if (!gameGrid) return; 

        // 1. MAPA
        gameGrid.draw(ctx);

        // 2. BALAS
        const prevBulletCount = bullets.length;
        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            b.update(gameGrid, w, h);
            
            if (!b.alive) {
                bullets.splice(i, 1);
                continue;
            }

            // Colisiones Bala -> Enemigo
            if (b.ownerId !== 'enemy') {
                for (let e of enemies) {
                    if (e.alive && Math.hypot(b.x - e.x, b.y - e.y) < e.radius + 4) {
                        e.takeDamage(ENTITY_CONFIG.BULLET_DAMAGE);
                        b.alive = false;
                        break;
                    }
                }
            }

            // Colisiones Bala -> Jugador
            if (b.alive) {
                players.forEach(p => {
                    if (p.isDead) return;
                    if (b.ownerId === p.id) return; 
                    if (!FRIENDLY_FIRE && b.ownerId !== 'enemy') return; 

                    if (Math.hypot(b.x - p.x, b.y - p.y) < p.radius + 4) {
                        p.takeDamage(10); 
                        b.alive = false;
                    }
                });
            }
            b.draw(ctx);
        }

        // 3. JUGADORES (Generar Ruido)
        players.forEach(player => {
            if (!player.isDead) {
                const pad = window.getController(player.id);
                // Si disparó (simplificado: detectamos input de disparo validado)
                if (pad && pad.axes.rt > 0.5 && player.energy >= ENTITY_CONFIG.SHOT_COST && player.shotCooldown <= 0) {
                    activeNoises.push({ x: player.x, y: player.y, type: 'SHOT' });
                }
                player.update(gameGrid, w, h, bullets); 
                player.draw(ctx);
            }
        });

        // 4. ENEMIGOS (IA OODA)
        let activeEnemies = 0;
        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            if (!e.alive) continue;
            activeEnemies++;

            // Repulsión simple entre enemigos
            for (let j = i + 1; j < enemies.length; j++) {
                const other = enemies[j];
                if (!other.alive) continue;
                const dx = e.x - other.x;
                const dy = e.y - other.y;
                const dist = Math.hypot(dx, dy);
                const minDist = e.radius + other.radius;
                if (dist < minDist && dist > 0) {
                    const push = (minDist - dist) / 2;
                    const angle = Math.atan2(dy, dx);
                    e.x += Math.cos(angle) * push;
                    e.y += Math.sin(angle) * push;
                    other.x -= Math.cos(angle) * push;
                    other.y -= Math.sin(angle) * push;
                }
            }

            e.update(gameGrid, players, bullets, w, h);
            e.draw(ctx);

            // Daño por contacto
            players.forEach(p => {
                if (!p.isDead && Math.hypot(e.x - p.x, e.y - p.y) < e.radius + p.radius) {
                    p.takeDamage(1); 
                }
            });
        }

        // 5. HUD / VICTORIA
        // (Lógica simplificada por ahora)
        if (currentMode === 'clear' || currentMode === 'operations') {
            if (activeEnemies === 0 && gameGrid.enemySpawners.length === 0) {
                drawOverlay(ctx, w, h, '#00ff00', "MISSION ACCOMPLISHED");
                checkReset(players);
            } else if (players.every(p => p.isDead)) {
                drawOverlay(ctx, w, h, '#ff0000', "CRITICAL FAILURE");
                checkReset(players);
            }
        }
    }
}

function drawOverlay(ctx, w, h, color, text) {
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.2;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1.0;
    ctx.textAlign = 'center';
    ctx.font = 'bold 80px Segoe UI';
    ctx.fillStyle = '#fff';
    ctx.fillText(text, w/2, h/2);
    ctx.font = '30px Segoe UI';
    ctx.fillText("PRESS START TO RTB", w/2, h/2 + 60);
}

function checkReset(players) {
    if (players.length > 0) {
        const hostPad = window.getController(players[0].id);
        if (hostPad && hostPad.buttons.start) {
            window.goToModeSelect(lobbyData);
        }
    }
}

loop();