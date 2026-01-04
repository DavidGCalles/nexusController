// main.js

const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d');

let w, h;
let gameState = 'lobby'; 
let players = []; 
let bullets = []; // NUEVO: Array de balas
let gameGrid = null;     

// CONFIGURACIÓN DE PARTIDA
const FRIENDLY_FIRE = true; // Desactivado por defecto

function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

window.startGame = function(lobbyPlayers) {
    console.log("🚀 Iniciando Partida con Disparos...");
    
    gameGrid = new Grid(w, h); 
    gameGrid.generate();

    players = lobbyPlayers.map((p) => {
        const spawn = gameGrid.getSafeSpawn();
        return new Player(p.id, spawn.x, spawn.y, p.color);
    });
    
    bullets = []; // Limpiar balas viejas
    gameState = 'playing';
}

function loop() {
    requestAnimationFrame(loop);

    if (gameState === 'playing') {
        ctx.fillStyle = '#050505'; 
        ctx.fillRect(0, 0, w, h);

        if (!gameGrid) return; 

        gameGrid.draw(ctx);

        // --- UPDATE & DRAW BALAS ---
        // Iterar al revés para borrar seguro
        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            b.update(gameGrid, w, h);
            
            if (!b.alive) {
                bullets.splice(i, 1);
                continue;
            }

            // Colisiones Bala vs Jugador
            players.forEach(p => {
                // Lógica Fuego Amigo
                // 1. No te puedes disparar a ti mismo
                if (b.ownerId === p.id) return;

                // 2. Si Fuego Amigo está OFF, las balas traspasan a los otros
                if (!FRIENDLY_FIRE) return;

                // Si estuviera ON, comprobamos distancia
                const dx = b.x - p.x;
                const dy = b.y - p.y;
                const dist = Math.hypot(dx, dy);

                if (dist < p.radius + 4) { // 4 es radio bala aprox
                    // IMPACTO JUGADOR (De momento solo borramos bala, no hay HP)
                    b.alive = false;
                    console.log(`P${p.id} hit by P${b.ownerId}`);
                }
            });

            b.draw(ctx);
        }

        // --- UPDATE & DRAW JUGADORES ---
        players.forEach(player => {
            // Pasamos 'bullets' para que puedan añadir nuevas
            player.update(gameGrid, w, h, bullets); 
            player.draw(ctx);
        });
    }
    else if (gameState === 'lobby') {
        updateLobby();
        drawLobby(ctx, w, h);
    } 
}

loop();