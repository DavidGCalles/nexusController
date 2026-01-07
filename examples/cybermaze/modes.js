// modes.js
const GAME_MODES = [
    { id: 'clear', name: 'LIMPIEZA DE ZONA', desc: 'Elimina todos los objetivos hostiles.' },
    { id: 'survival', name: 'SUPERVIVENCIA', desc: '[MOCK] Resiste oleadas infinitas.' },
    { id: 'ctf', name: 'CAPTURAR BANDERA', desc: '[MOCK] Roba la bandera enemiga.' },
    { id: 'pvp', name: 'DEATHMATCH', desc: '[MOCK] Combate todos contra todos.' }
];

let selectedModeIdx = 0;
let modeSelectCooldown = 0;
let modePlayers = []; // Referencia a los jugadores del lobby

function initModeSelect(players) {
    modePlayers = players;
    selectedModeIdx = 0;
    modeSelectCooldown = 20; // Pequeño delay para no seleccionar nada por accidente al entrar
}

function updateModeSelect() {
    if (modeSelectCooldown > 0) modeSelectCooldown--;
    
    // Solo el Host (Player 0 de la lista de lobby) controla el menú
    if (modePlayers.length === 0) return;
    const hostId = modePlayers[0].id;
    const pad = window.getController(hostId);
    
    if (!pad) return;

    // NAVEGACIÓN
    // Asumiendo tu mando "Aviación" donde Arriba físico da valor Positivo (+1)
    // Arriba (+1) -> Subir en la lista (Índice menor)
    // Abajo (-1) -> Bajar en la lista (Índice mayor)
    
    if (modeSelectCooldown === 0) {
        if (pad.axes.ly > 0.5 || pad.buttons.d_up) { 
            // Stick Arriba o D-Pad Arriba -> ANTERIOR
            selectedModeIdx = (selectedModeIdx - 1 + GAME_MODES.length) % GAME_MODES.length;
            modeSelectCooldown = 12; // Velocidad de scroll
        } 
        else if (pad.axes.ly < -0.5 || pad.buttons.d_down) {
            // Stick Abajo o D-Pad Abajo -> SIGUIENTE
            selectedModeIdx = (selectedModeIdx + 1) % GAME_MODES.length;
            modeSelectCooldown = 12;
        }
    }

    // CONFIRMAR (Botón A/South o Start)
    if ((pad.buttons.south || pad.buttons.start) && modeSelectCooldown === 0) {
        // Lanzamos el juego
        const modeId = GAME_MODES[selectedModeIdx].id;
        window.launchGame(modeId);
    }
}

function drawModeSelect(ctx, w, h) {
    // Fondo oscuro sobre el lobby
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, w, h);

    ctx.textAlign = 'center';
    
    // Título
    ctx.fillStyle = '#fff';
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 10;
    ctx.font = 'bold 60px Segoe UI';
    ctx.fillText("SELECCIONAR MISIÓN", w/2, h * 0.2);
    ctx.shadowBlur = 0;

    // Lista de Modos
    const startY = h * 0.4;
    const gap = 70;

    GAME_MODES.forEach((mode, i) => {
        const isSelected = i === selectedModeIdx;
        const y = startY + i * gap;

        if (isSelected) {
            // Opción Seleccionada
            ctx.fillStyle = '#00ffff';
            ctx.font = 'bold 45px Segoe UI';
            ctx.fillText(`> ${mode.name} <`, w/2, y);
            
            // Descripción
            ctx.fillStyle = '#aaaaaa';
            ctx.font = 'italic 24px Segoe UI';
            ctx.fillText(mode.desc, w/2, h * 0.85); // Descripción abajo del todo
            
            // Efecto Box (Opcional)
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 2;
            ctx.strokeRect(w/2 - 250, y - 40, 500, 55);

        } else {
            // Opción Normal
            ctx.fillStyle = '#444';
            ctx.font = '30px Segoe UI';
            ctx.fillText(mode.name, w/2, y);
        }
    });

    // Footer Instrucciones
    ctx.fillStyle = '#ffff00';
    ctx.font = '20px monospace';
    ctx.fillText("HOST: SELECT MISSION & PRESS START", w/2, h - 50);
}