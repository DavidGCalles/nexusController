// grid.js
class Grid {
    constructor(w, h) {
        this.width = w;
        this.height = h;
        this.cellSize = Math.min(w / CONFIG.COLS, h / CONFIG.ROWS);
        
        // Datos
        this.map = []; // Matriz 2D: 0=Vacío, 1=Muro Fijo, 2=Destructible
        this.destructibles = []; // Array optimizado para renderizar muros rompibles
        this.spawnPoints = [];   // Puntos seguros para nacer

        // Buffer de Renderizado (Optimización masiva)
        this.staticLayer = document.createElement('canvas');
        this.staticLayer.width = w;
        this.staticLayer.height = h;
        this.staticCtx = this.staticLayer.getContext('2d');
    }

    generate() {
        // 1. Inicializar todo a Muro (1)
        this.map = Array(CONFIG.ROWS).fill().map(() => Array(CONFIG.COLS).fill(1));
        this.destructibles = [];
        this.spawnPoints = [];

        // 2. Algoritmo Recursive Backtracker (Adaptado de tu maze.js)
        const wCorr = CONFIG.MAZE_CORRIDOR_WIDTH;
        const step = wCorr * 2; // Salto para dejar paredes entre pasillos
        const stack = [{ c: 1, r: 1 }];

        // Función auxiliar para excavar un bloque gordo
        const carve = (r, c) => {
            for (let dr = 0; dr < wCorr; dr++) {
                for (let dc = 0; dc < wCorr; dc++) {
                    if (this.isValid(r + dr, c + dc)) {
                        this.map[r + dr][c + dc] = 0; // 0 = Aire
                    }
                }
            }
        };

        carve(1, 1); // Inicio

        while (stack.length) {
            const cur = stack[stack.length - 1];
            // Direcciones aleatorias: Arriba, Abajo, Izq, Der (saltando el step)
            const dirs = [[0, -step], [0, step], [-step, 0], [step, 0]]
                .sort(() => Math.random() - 0.5);
            
            let found = false;

            for (let [dc, dr] of dirs) {
                const nc = cur.c + dc;
                const nr = cur.r + dr;

                // Si es válido y es muro sólido (no visitado)
                // Verificamos el bloque entero de destino
                if (nc > 0 && nc < CONFIG.COLS - wCorr && 
                    nr > 0 && nr < CONFIG.ROWS - wCorr && 
                    this.map[nr][nc] === 1) {
                    
                    // Excavamos el pasillo intermedio
                    const path_c = cur.c + dc / 2;
                    const path_r = cur.r + dr / 2;
                    carve(path_r, path_c);
                    
                    // Excavamos el destino
                    carve(nr, nc);
                    
                    stack.push({ c: nc, r: nr });
                    found = true;
                    
                    // Guardamos puntos candidatos para spawn (zonas abiertas)
                    if (Math.random() > 0.9) {
                        this.spawnPoints.push({ 
                            x: (nc * this.cellSize) + (this.cellSize * wCorr / 2),
                            y: (nr * this.cellSize) + (this.cellSize * wCorr / 2)
                        });
                    }
                    break;
                }
            }
            if (!found) stack.pop();
        }

        // 3. Generar Muros Destructibles
        // Buscamos zonas vacías y tiramos dados
        for (let r = 1; r < CONFIG.ROWS - 1; r++) {
            for (let c = 1; c < CONFIG.COLS - 1; c++) {
                if (this.map[r][c] === 0 && Math.random() < CONFIG.MAZE_BREAKABLE_CHANCE) {
                    // Evitamos bloquear el spawn (0,0 aprox)
                    if (r < 5 && c < 5) continue;
                    
                    this.map[r][c] = 2; // 2 = Muro Destructible
                    this.destructibles.push({ c, r, active: true });
                }
            }
        }

        // 4. Pre-renderizar lo estático
        this.bakeStaticLayer();
    }

    bakeStaticLayer() {
        const ctx = this.staticCtx;
        ctx.clearRect(0, 0, this.width, this.height);
        
        // Fondo
        ctx.fillStyle = '#050505';
        ctx.fillRect(0, 0, this.width, this.height);

        // Estilo Neón
        ctx.shadowBlur = 10;
        ctx.shadowColor = CONFIG.WALL_NEON;
        ctx.strokeStyle = CONFIG.WALL_NEON;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';

        ctx.beginPath();
        for (let r = 0; r < CONFIG.ROWS; r++) {
            for (let c = 0; c < CONFIG.COLS; c++) {
                if (this.map[r][c] === 1) { // Solo muros fijos
                    const x = c * this.cellSize;
                    const y = r * this.cellSize;
                    // Dibujamos un cuadrado simple (se puede optimizar a líneas contiguas luego)
                    ctx.rect(x, y, this.cellSize, this.cellSize);
                }
            }
        }
        ctx.stroke();
        ctx.shadowBlur = 0; // Reset
    }

    draw(ctx) {
        // 1. Pintar la capa estática (Rapidísimo)
        ctx.drawImage(this.staticLayer, 0, 0);

        // 2. Pintar Muros Destructibles (Dinámicos)
        ctx.strokeStyle = CONFIG.DEST_WALL_COLOR;
        ctx.shadowColor = CONFIG.DEST_WALL_COLOR;
        ctx.shadowBlur = 5;
        
        ctx.beginPath();
        this.destructibles.forEach(d => {
            if (d.active) {
                const x = d.c * this.cellSize;
                const y = d.r * this.cellSize;
                // Dibujamos una "X" o caja diferente para diferenciar
                ctx.rect(x + 4, y + 4, this.cellSize - 8, this.cellSize - 8);
            }
        });
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    // --- FÍSICA Y UTILIDADES ---

    isValid(r, c) {
        return r >= 0 && r < CONFIG.ROWS && c >= 0 && c < CONFIG.COLS;
    }

    // Comprueba colisión contra un rectángulo (jugador)
    checkCollision(x, y, radius) {
        // Convertimos coords mundo a coords grid
        // Optimizacion: Solo miramos las celdas alrededor del punto
        const startC = Math.floor((x - radius) / this.cellSize);
        const endC = Math.floor((x + radius) / this.cellSize);
        const startR = Math.floor((y - radius) / this.cellSize);
        const endR = Math.floor((y + radius) / this.cellSize);

        for (let r = startR; r <= endR; r++) {
            for (let c = startC; c <= endC; c++) {
                if (!this.isValid(r, c)) return true; // Chocar con el borde del mundo

                const cellValue = this.map[r][c];
                
                // Si es Muro (1) o Destructible Activo (2)
                if (cellValue === 1 || cellValue === 2) {
                    // AABB vs AABB simplificado (Celda vs bounding box jugador)
                    const cellX = c * this.cellSize;
                    const cellY = r * this.cellSize;
                    
                    // Colisión simple de rectángulos
                    if (x + radius > cellX && x - radius < cellX + this.cellSize &&
                        y + radius > cellY && y - radius < cellY + this.cellSize) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    getSafeSpawn() {
        if (this.spawnPoints.length > 0) {
            // Devuelve uno random y lo quita para que no nazcan dos encima
            const idx = Math.floor(Math.random() * this.spawnPoints.length);
            return this.spawnPoints.splice(idx, 1)[0];
        }
        return { x: this.cellSize * 1.5, y: this.cellSize * 1.5 }; // Fallback
    }
}