// main.js

const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d');

// --- VARIABLES GLOBALES ---
let w, h;
let gameState = 'lobby'; // 'lobby' | 'playing'
let players = []; 
let gameGrid = null;     // Instancia del Grid

// --- SETUP INICIAL ---
function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
    
    // Si redimensionamos en medio de la partida, habría que regenerar el grid
    // o reescalar, pero de momento asumimos pantalla completa fija.
}
window.addEventListener('resize', resize);
resize();

// --- START GAME (Llamado desde lobby.js) ---
window.startGame = function(lobbyPlayers) {
    console.log("🚀 Iniciando Partida...");

    // 1. Instanciar y Generar el Laberinto
    gameGrid = new Grid(w, h);
    gameGrid.generate();

    // 2. Crear las Entidades Jugador
    // Usamos los spawn points seguros que calculó el Grid
    players = lobbyPlayers.map((p) => {
        const spawn = gameGrid.getSafeSpawn();
        return new Player(p.id, spawn.x, spawn.y, p.color);
    });
    
    // 3. Cambiar estado
    gameState = 'playing';
}

// --- BUCLE PRINCIPAL ---
function loop() {
    requestAnimationFrame(loop);

    // Limpieza general
    // (Nota: Lobby tiene su propio fondo, pero limpiamos por seguridad)
    if (gameState === 'playing') {
        ctx.fillStyle = '#050505'; 
        ctx.fillRect(0, 0, w, h);
    }

    // MÁQUINA DE ESTADOS
    if (gameState === 'lobby') {
        updateLobby();
        drawLobby(ctx, w, h);
    } 
    else if (gameState === 'playing') {
        if (!gameGrid) return; // Seguridad

        // 1. Dibujar el Escenario (Grid)
        gameGrid.draw(ctx);

        // 2. Actualizar y Dibujar Jugadores
        players.forEach(player => {
            // IMPORTANTE: Pasamos gameGrid a update() para las colisiones
            player.update(gameGrid, w, h); 
            player.draw(ctx);
        });

        // 3. UI Global (Opcional, de momento vacía)
    }
}

// Arrancar el motor
loop();