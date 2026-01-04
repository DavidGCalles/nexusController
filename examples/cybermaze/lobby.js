// lobby.js
const PLAYER_COLORS = ['#00ffff', '#ff0055', '#ffff00', '#00ff00']; // Cyan, Magenta, Yellow, Lime
let joinedPlayers = []; // Array de objetos { id: int, color: string }

function updateLobby() {
    // 1. Escanear inputs para nuevos jugadores
    const activePads = window.getAllControllers();
    
    activePads.forEach(pad => {
        const isAlreadyJoined = joinedPlayers.some(p => p.id === pad.id);
        
        // JOIN: Si pulsa 'South' (A/X) y no está unido
        if (pad.buttons.south && !isAlreadyJoined) {
            if (joinedPlayers.length < 4) {
                joinedPlayers.push({
                    id: pad.id,
                    color: PLAYER_COLORS[joinedPlayers.length],
                    ready: true
                });
                // Pequeño feedback sonoro o visual aquí sería ideal
            }
        }
    });

    // 2. START: Solo el Jugador 1 (Host) puede iniciar la partida
    if (joinedPlayers.length > 0) {
        const hostId = joinedPlayers[0].id;
        const hostPad = window.getController(hostId);
        
        if (hostPad && hostPad.buttons.start) {
            startGame(joinedPlayers);
        }
    }
}

function drawLobby(ctx, w, h) {
    // Fondo oscuro
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, w, h);

    // Título
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 40px Segoe UI';
    ctx.fillText("LOBBY", w/2, 100);
    ctx.font = '20px Segoe UI';
    ctx.fillStyle = '#888';
    ctx.fillText("PRESS 'A' TO JOIN", w/2, 140);

    // Slots de Jugadores
    const slotW = 200;
    const slotH = 300;
    const gap = 40;
    const totalW = (slotW * 4) + (gap * 3);
    const startX = (w - totalW) / 2;
    const startY = h / 2 - slotH / 2;

    for (let i = 0; i < 4; i++) {
        const x = startX + i * (slotW + gap);
        const player = joinedPlayers[i];
        
        // Caja del Slot
        ctx.strokeStyle = player ? player.color : '#333';
        ctx.lineWidth = player ? 4 : 2;
        ctx.strokeRect(x, startY, slotW, slotH);

        // Contenido del Slot
        if (player) {
            ctx.fillStyle = player.color;
            ctx.globalAlpha = 0.2;
            ctx.fillRect(x, startY, slotW, slotH);
            ctx.globalAlpha = 1.0;
            
            ctx.font = 'bold 30px Segoe UI';
            ctx.fillStyle = '#fff';
            ctx.fillText(`P${i+1}`, x + slotW/2, startY + slotH/2);
            
            ctx.font = '16px Segoe UI';
            ctx.fillText(i === 0 ? "HOST" : "READY", x + slotW/2, startY + slotH - 20);
        } else {
            ctx.fillStyle = '#333';
            ctx.font = 'italic 20px Segoe UI';
            ctx.fillText("Empty", x + slotW/2, startY + slotH/2);
        }
    }

    // Mensaje de inicio
    if (joinedPlayers.length > 0) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 24px Segoe UI';
        ctx.fillText("HOST: PRESS 'START' TO BEGIN", w/2, h - 100);
    }
}