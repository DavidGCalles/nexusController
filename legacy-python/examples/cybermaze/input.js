// ==========================================
// 1. NEXUS INPUT
// ==========================================
const WS_URL = 'ws://localhost:8765';
let nexus = { lx: 0, ly: 0, rx: 0, ry: 0, start: false, rt: 0, lt: 0 };
let lastNexus = { ...nexus };

function connect() {
    const socket = new WebSocket(WS_URL);
    socket.onmessage = e => { 
        try { 
            nexus = JSON.parse(e.data); 
            if (typeof nexus.rt === 'undefined') nexus.rt = 0;
            if (typeof nexus.lt === 'undefined') nexus.lt = 0;
        } catch(err){} 
    };
    socket.onclose = () => setTimeout(connect, 2000);
}
connect();

// Debug Teclado
window.addEventListener('keydown', e => {
    if(e.key==='Enter') nexus.start=true;
    if(e.key==='ArrowRight') nexus.lx = 1;
    if(e.key==='ArrowDown') nexus.ly = 1;
});
window.addEventListener('keyup', e => {
    if(e.key==='Enter') nexus.start=false;
    if(['ArrowRight','ArrowDown'].includes(e.key)) { nexus.lx=0; nexus.ly=0; }
});
