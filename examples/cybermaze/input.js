// input.js
const WS_URL = 'ws://localhost:8765';

// Almacén de estados. 
// Key: ID del mando (según Rust). Value: Struct completo.
const controllers = {}; 

function connect() {
    console.log("📡 Intentando conectar al WebSocket...");
    const socket = new WebSocket(WS_URL);
    
    socket.onopen = () => console.log("✅ Conectado al Backend Rust");
    
    socket.onmessage = e => { 
        try { 
            // Asumimos que llega un JSON con la estructura ControllerState
            const state = JSON.parse(e.data);
            
            // Gestión básica de conexión/desconexión
            if (state.connected) {
                controllers[state.id] = state;
            } else {
                delete controllers[state.id];
            }
        } catch(err) {
            console.error("❌ Error parseando input:", err);
        } 
    };

    socket.onerror = (err) => console.error("⚠️ Error WS:", err);

    socket.onclose = () => {
        console.warn("🔌 Desconectado. Reintentando en 2s...");
        setTimeout(connect, 2000);
    };
}

connect();

// API Pública para el resto del juego
window.getController = (id) => controllers[id] || null;
window.getAllControllers = () => Object.values(controllers);