// main.js

const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d');

let w, h;
let gameState = 'lobby'; // 'lobby' | 'mode-select' | 'playing'
let players = []; 
let enemies = []; 
let bullets = []; 
let gameGrid = null;     

// Datos temporales de transición
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
    lobbyData = playersFromLobby; // Guardamos la lista de jugadores
    window.initModeSelect(lobbyData); // Inicializamos el menú
    gameState = 'mode-select';
}

// --- TRANSICIÓN 2: MODE SELECT -> JUEGO ---
window.launchGame = function(modeId) {
    console.log(`🚀 LANZANDO JUEGO EN MODO: ${modeId}`);
    currentMode = modeId;

    gameGrid = new Grid(w, h); 
    gameGrid.generate();

    // 1. SPAWN JUGADORES (Periferia)
    players = lobbyData.map((p) => {
        const spawn = gameGrid.getPlayerSpawn();
        return new Player(p.id, spawn.x, spawn.y, p.color);
    });
    
    bullets = []; 
    enemies = [];

    // 2. SPAWN ENEMIGOS (Centro + Seguridad)
    if (modeId === 'clear') {
        const numEnemies = 15; 
        const MIN_SPAWN_DIST = 250; // Distancia mínima de seguridad (pixeles)

        for (let i = 0; i < numEnemies; i++) {
            let spawn = null;
            let attempts = 0;
            let safe = false;

            // Intentamos encontrar un sitio seguro hasta 10 veces
            while (!safe && attempts < 10) {
                spawn = gameGrid.getEnemySpawn(); // Pide sitio céntrico
                safe = true;
                
                // Verificar distancia contra TODOS los jugadores
                for (let p of players) {
                    const dist = Math.hypot(spawn.x - p.x, spawn.y - p.y);
                    if (dist < MIN_SPAWN_DIST) {
                        safe = false;
                        break;
                    }
                }
                attempts++;
            }

            // Si tras 10 intentos falla, usamos el último spawn obtenido (fallback)
            
            // Elegir tipo aleatorio
            const rand = Math.random();
            let type = 'circle';
            if (rand > 0.6) type = 'square';
            if (rand > 0.85) type = 'diamond';
            
            enemies.push(new Enemy(type, spawn.x, spawn.y));
        }
    }

    gameState = 'playing';
}

// --- GAME LOOP ---
function loop() {
    requestAnimationFrame(loop);

    // Limpieza global
    ctx.fillStyle = '#050505'; 
    ctx.fillRect(0, 0, w, h);

    // MÁQUINA DE ESTADOS
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

        // 1. DIBUJAR MAPA
        gameGrid.draw(ctx);

        // 2. GESTIÓN DE BALAS
        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            b.update(gameGrid, w, h);
            
            if (!b.alive) {
                bullets.splice(i, 1);
                continue;
            }

            // Colisión Bala -> Enemigo
            if (b.ownerId !== 'enemy') {
                for (let e of enemies) {
                    if (e.alive && Math.hypot(b.x - e.x, b.y - e.y) < e.radius + 4) {
                        e.takeDamage(ENTITY_CONFIG.BULLET_DAMAGE);
                        b.alive = false;
                        break;
                    }
                }
            }

            // Colisión Bala -> Jugador (Fuego Amigo o Enemigo)
            if (b.alive) {
                players.forEach(p => {
                    if (p.isDead) return;
                    if (b.ownerId === p.id) return; // No te disparas a ti mismo
                    if (!FRIENDLY_FIRE && b.ownerId !== 'enemy') return; 

                    if (Math.hypot(b.x - p.x, b.y - p.y) < p.radius + 4) {
                        p.takeDamage(10); 
                        b.alive = false;
                    }
                });
            }

            b.draw(ctx);
        }

        // 3. GESTIÓN DE ENEMIGOS (Con Repulsión)
        let activeEnemies = 0;
        
        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            if (!e.alive) continue;
            
            activeEnemies++;

            // --- FÍSICA DE REPULSIÓN ENTRE ENEMIGOS ---
            for (let j = i + 1; j < enemies.length; j++) {
                const other = enemies[j];
                if (!other.alive) continue;

                const dx = e.x - other.x;
                const dy = e.y - other.y;
                const dist = Math.hypot(dx, dy);
                const minDist = e.radius + other.radius; // Distancia de contacto

                if (dist < minDist && dist > 0) {
                    // Empuje suave para separarlos
                    const push = (minDist - dist) / 2; 
                    const angle = Math.atan2(dy, dx);
                    
                    const pushX = Math.cos(angle) * push;
                    const pushY = Math.sin(angle) * push;

                    e.x += pushX;
                    e.y += pushY;
                    other.x -= pushX;
                    other.y -= pushY;
                }
            }

            e.update(gameGrid, players, bullets, w, h);
            e.draw(ctx);

            // Colisión Melee con Jugadores
            players.forEach(p => {
                if (!p.isDead && Math.hypot(e.x - p.x, e.y - p.y) < e.radius + p.radius) {
                    p.takeDamage(1); 
                }
            });
        }

        // 4. GESTIÓN DE JUGADORES
        let activePlayers = 0;
        players.forEach(player => {
            if (!player.isDead) {
                activePlayers++;
                player.update(gameGrid, w, h, bullets); 
                player.draw(ctx);
            }
        });

        // 5. ENDGAME UI
        if (currentMode === 'clear') {
            if (activeEnemies === 0) {
                // VICTORIA
                ctx.fillStyle = 'rgba(0, 255, 100, 0.2)';
                ctx.fillRect(0, 0, w, h);
                ctx.fillStyle = '#00ff00';
                ctx.textAlign = 'center';
                ctx.font = 'bold 80px Segoe UI';
                ctx.fillText("SECTOR CLEARED", w/2, h/2);
                ctx.font = '30px Segoe UI';
                ctx.fillStyle = '#fff';
                ctx.fillText("PRESS START TO RETURN", w/2, h/2 + 60);

                const hostId = lobbyData[0].id;
                const pad = window.getController(hostId);
                if (pad && pad.buttons.start) {
                    window.goToModeSelect(lobbyData);
                }
            } else if (activePlayers === 0) {
                // DERROTA
                ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
                ctx.fillRect(0, 0, w, h);
                ctx.fillStyle = '#ff0000';
                ctx.textAlign = 'center';
                ctx.font = 'bold 80px Segoe UI';
                ctx.fillText("MISSION FAILED", w/2, h/2);
                ctx.font = '30px Segoe UI';
                ctx.fillStyle = '#fff';
                ctx.fillText("PRESS START TO RETRY", w/2, h/2 + 60);
                
                const hostId = lobbyData[0].id;
                const pad = window.getController(hostId);
                if (pad && pad.buttons.start) {
                    window.goToModeSelect(lobbyData);
                }
            } else {
                // HUD
                ctx.fillStyle = '#fff';
                ctx.font = '20px monospace';
                ctx.textAlign = 'right';
                ctx.fillText(`HOSTILES: ${activeEnemies}`, w - 20, 40);
            }
        }
    }
}

// Arrancar motor
loop();