// grid.js
class Grid {
    constructor(w, h) {
        this.width = w;
        this.height = h;
        
        // 1. CÁLCULO DIMENSIONAL ÚNICO (Sin Resize)
        // Calculamos la celda para que el grid quepa en la pantalla manteniendo aspecto cuadrado
        this.cellSize = Math.min(w / CONFIG.COLS, h / CONFIG.ROWS);
        
        // Calculamos márgenes fijos para centrarlo estéticamente
        this.marginLeft = (w - (this.cellSize * CONFIG.COLS)) / 2;
        this.marginTop = (h - (this.cellSize * CONFIG.ROWS)) / 2;
        
        // Datos del mapa
        this.map = []; 
        this.destructibles = []; 
        this.spawnPoints = [];   

        // Buffer Gráfico
        this.staticLayer = document.createElement('canvas');
        this.staticLayer.width = w;
        this.staticLayer.height = h;
        this.staticCtx = this.staticLayer.getContext('2d');
    }

    generate() {
        // 1. Reset: Todo a Muro (1)
        this.map = Array(CONFIG.ROWS).fill().map(() => Array(CONFIG.COLS).fill(1));
        this.destructibles = [];
        this.spawnPoints = [];

        // 2. Excavación (Recursive Backtracker)
        const wCorr = CONFIG.MAZE_CORRIDOR_WIDTH;
        const step = wCorr * 2;
        const stack = [{ c: 1, r: 1 }];

        const carve = (r, c) => {
            for (let dr = 0; dr < wCorr; dr++) {
                for (let dc = 0; dc < wCorr; dc++) {
                    if (this.isValid(r + dr, c + dc)) {
                        this.map[r + dr][c + dc] = 0; // 0 = Aire puro
                    }
                }
            }
        };

        carve(1, 1);

        while (stack.length) {
            const cur = stack[stack.length - 1];
            // Randomizar direcciones
            const dirs = [[0, -step], [0, step], [-step, 0], [step, 0]]
                .sort(() => Math.random() - 0.5);
            
            let found = false;

            for (let [dc, dr] of dirs) {
                const nc = cur.c + dc;
                const nr = cur.r + dr;

                if (nc > 0 && nc < CONFIG.COLS - wCorr && 
                    nr > 0 && nr < CONFIG.ROWS - wCorr && 
                    this.map[nr][nc] === 1) { // Si es muro virgen
                    
                    const path_c = cur.c + dc / 2;
                    const path_r = cur.r + dr / 2;
                    carve(path_r, path_c); // Tunel
                    carve(nr, nc);         // Habitación
                    
                    stack.push({ c: nc, r: nr });
                    found = true;
                    break;
                }
            }
            if (!found) stack.pop();
        }

        // 3. Generar Muros Destructibles (CRÍTICO: HACERLO ANTES DE CALCULAR SPAWNS)
        for (let r = 1; r < CONFIG.ROWS - 1; r++) {
            for (let c = 1; c < CONFIG.COLS - 1; c++) {
                // Solo si es aire (0)
                if (this.map[r][c] === 0 && Math.random() < CONFIG.MAZE_BREAKABLE_CHANCE) {
                    // Protegemos mínimamente la esquina 1,1 por si acaso falla el spawn logic
                    if (r < 5 && c < 5) continue; 
                    
                    this.map[r][c] = 2; // 2 = Ocupado por Destructible
                    this.destructibles.push({ c, r, active: true });
                }
            }
        }

        // 4. Buscar Spawns Seguros (Estrategia Lejana)
        this.findStrategicSpawns();

        // 5. Pintar la capa estática
        this.bakeStaticLayer();
    }

    findStrategicSpawns() {
        const candidates = [];
        const centerX = CONFIG.COLS / 2;
        const centerY = CONFIG.ROWS / 2;

        // Barrido buscando SOLO ceros (Aire real)
        for (let r = 1; r < CONFIG.ROWS - 1; r++) {
            for (let c = 1; c < CONFIG.COLS - 1; c++) {
                // AQUÍ ESTÁ LA CLAVE: 
                // Si es 1 (Muro) -> NO
                // Si es 2 (Destructible) -> NO
                // Solo 0 pasa.
                if (this.map[r][c] === 0) {
                    // Distancia al centro
                    const dist = Math.pow(c - centerX, 2) + Math.pow(r - centerY, 2);
                    candidates.push({ r, c, dist });
                }
            }
        }

        // Ordenar: Los más lejanos primero (Distancia descendente)
        candidates.sort((a, b) => b.dist - a.dist);

        // Nos quedamos con los top 12 candidatos más lejanos
        this.spawnPoints = candidates.slice(0, 12).map(p => ({ r: p.r, c: p.c }));
        
        console.log(`📍 Spawns Calculados: ${this.spawnPoints.length} puntos seguros en periferia.`);
    }

    bakeStaticLayer() {
        const ctx = this.staticCtx;
        ctx.clearRect(0, 0, this.width, this.height);
        
        // Fondo General
        ctx.fillStyle = '#050505';
        ctx.fillRect(0, 0, this.width, this.height);

        // Estilo Neon
        ctx.shadowBlur = 10;
        ctx.shadowColor = CONFIG.WALL_NEON;
        ctx.strokeStyle = CONFIG.WALL_NEON;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';

        ctx.beginPath();
        for (let r = 0; r < CONFIG.ROWS; r++) {
            for (let c = 0; c < CONFIG.COLS; c++) {
                if (this.map[r][c] === 1) { // Muros Indestructibles
                    const x = this.marginLeft + c * this.cellSize;
                    const y = this.marginTop + r * this.cellSize;
                    ctx.rect(x, y, this.cellSize, this.cellSize);
                }
            }
        }
        ctx.stroke();
        ctx.shadowBlur = 0; 
    }

    draw(ctx) {
        // 1. Capa Estática (Buffer)
        ctx.drawImage(this.staticLayer, 0, 0);

        // 2. Muros Destructibles (Dinámicos porque pueden desaparecer)
        ctx.strokeStyle = CONFIG.DEST_WALL_COLOR;
        ctx.shadowColor = CONFIG.DEST_WALL_COLOR;
        ctx.shadowBlur = 5;
        
        ctx.beginPath();
        this.destructibles.forEach(d => {
            if (d.active) {
                const x = this.marginLeft + d.c * this.cellSize;
                const y = this.marginTop + d.r * this.cellSize;
                
                // Dibujo visual diferenciado (X dentro del cuadro)
                const pad = 4;
                const size = this.cellSize - (pad * 2);
                ctx.rect(x + pad, y + pad, size, size);
                ctx.moveTo(x + pad, y + pad);
                ctx.lineTo(x + pad + size, y + pad + size);
                ctx.moveTo(x + pad + size, y + pad);
                ctx.lineTo(x + pad, y + pad + size);
            }
        });
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    // --- FÍSICA Y UTILIDADES ---

    isValid(r, c) {
        return r >= 0 && r < CONFIG.ROWS && c >= 0 && c < CONFIG.COLS;
    }

    checkCollision(x, y, radius) {
        // 1. Normalizar coordenada de Pantalla -> Coordenada Grid
        // RESTAMOS EL MARGEN FIJO ANTES DE CALCULAR LA CELDA
        const localX = x - this.marginLeft;
        const localY = y - this.marginTop;

        // Bounding Box del Jugador en coords grid
        const startC = Math.floor((localX - radius) / this.cellSize);
        const endC = Math.floor((localX + radius) / this.cellSize);
        const startR = Math.floor((localY - radius) / this.cellSize);
        const endR = Math.floor((localY + radius) / this.cellSize);

        for (let r = startR; r <= endR; r++) {
            for (let c = startC; c <= endC; c++) {
                // Si se sale del array, es colisión (Muro exterior invisible)
                if (!this.isValid(r, c)) return true; 

                const cellValue = this.map[r][c];
                
                // Colisión si es 1 (Muro) o 2 (Destructible Activo)
                if (cellValue === 1 || cellValue === 2) {
                    const cellX = c * this.cellSize;
                    const cellY = r * this.cellSize;
                    
                    // AABB Check simple
                    if (localX + radius > cellX && localX - radius < cellX + this.cellSize &&
                        localY + radius > cellY && localY - radius < cellY + this.cellSize) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    getSafeSpawn() {
        if (this.spawnPoints.length > 0) {
            // Extraer un punto aleatorio de los candidatos lejanos
            const idx = Math.floor(Math.random() * this.spawnPoints.length);
            const pt = this.spawnPoints.splice(idx, 1)[0];
            
            // Convertir Grid -> Pixels Reales (Sumando márgenes)
            return { 
                x: this.marginLeft + (pt.c * this.cellSize) + (this.cellSize / 2), 
                y: this.marginTop + (pt.r * this.cellSize) + (this.cellSize / 2) 
            };
        }
        
        // Fallback pánico (Esquina superior izquierda ajustada)
        return { 
            x: this.marginLeft + (this.cellSize * 1.5), 
            y: this.marginTop + (this.cellSize * 1.5) 
        };
    }
}