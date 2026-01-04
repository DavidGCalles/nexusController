// grid.js
class Grid {
    constructor(w, h) {
        this.width = w;
        this.height = h;
        
        // Dimensiones
        this.cellSize = Math.min(w / CONFIG.COLS, h / CONFIG.ROWS);
        this.marginLeft = (w - (this.cellSize * CONFIG.COLS)) / 2;
        this.marginTop = (h - (this.cellSize * CONFIG.ROWS)) / 2;
        
        this.map = []; 
        this.destructibles = []; 
        this.playerSpawns = [];
        this.enemySpawns = [];

        // Buffer Gráfico
        this.staticLayer = document.createElement('canvas');
        this.staticLayer.width = w;
        this.staticLayer.height = h;
        this.staticCtx = this.staticLayer.getContext('2d');
    }

    generate() {
        // 1. Reset & Inicialización (Todo Sólido)
        this.map = Array(CONFIG.ROWS).fill().map(() => Array(CONFIG.COLS).fill(1));
        this.destructibles = [];
        this.spawnPoints = [];

        // ---------------------------------------------------------
        // FASE 1: ESCULPIR LABERINTO (Recursive Backtracker)
        // ---------------------------------------------------------
        const wCorr = CONFIG.MAZE_CORRIDOR_WIDTH;
        const step = wCorr * 2;
        const stack = [{ c: 1, r: 1 }];

        const carve = (r, c) => {
            for (let dr = 0; dr < wCorr; dr++) {
                for (let dc = 0; dc < wCorr; dc++) {
                    if (this.isValid(r + dr, c + dc)) {
                        this.map[r + dr][c + dc] = 0; // Aire
                    }
                }
            }
        };

        carve(1, 1);

        while (stack.length) {
            const cur = stack[stack.length - 1];
            const dirs = [[0, -step], [0, step], [-step, 0], [step, 0]]
                .sort(() => Math.random() - 0.5);
            
            let found = false;

            for (let [dc, dr] of dirs) {
                const nc = cur.c + dc;
                const nr = cur.r + dr;

                // Solo excavamos si es Muro Sólido (1)
                if (nc > 0 && nc < CONFIG.COLS - wCorr && 
                    nr > 0 && nr < CONFIG.ROWS - wCorr && 
                    this.map[nr][nc] === 1) { 
                    
                    const path_c = cur.c + dc / 2;
                    const path_r = cur.r + dr / 2;
                    carve(path_r, path_c); 
                    carve(nr, nc);         
                    stack.push({ c: nc, r: nr });
                    found = true;
                    break;
                }
            }
            if (!found) stack.pop();
        }

        // ---------------------------------------------------------
        // FASE 2: DECADENCIA ESTRUCTURAL (NUEVO)
        // Convertimos parte de los muros estructurales en destructibles
        // ---------------------------------------------------------
        for (let r = 1; r < CONFIG.ROWS - 1; r++) {
            for (let c = 1; c < CONFIG.COLS - 1; c++) {
                // Si es un muro sólido (1)
                if (this.map[r][c] === 1) {
                    // Protegemos el marco exterior absoluto para que nadie se salga del mapa
                    if (r === 0 || c === 0 || r === CONFIG.ROWS - 1 || c === CONFIG.COLS - 1) continue;

                    if (Math.random() < CONFIG.MAZE_WALL_WEAKNESS_RATIO) {
                        this.map[r][c] = 2; // Degradamos a destructible
                        this.destructibles.push({ c, r, active: true });
                    }
                }
            }
        }

        // ---------------------------------------------------------
        // FASE 3: ESCOMBROS (DEBRIS)
        // Añadimos obstáculos en los pasillos vacíos
        // ---------------------------------------------------------
        for (let r = 1; r < CONFIG.ROWS - 1; r++) {
            for (let c = 1; c < CONFIG.COLS - 1; c++) {
                // Si es aire (0), a veces ponemos un bloque
                if (this.map[r][c] === 0 && Math.random() < CONFIG.MAZE_DEBRIS_CHANCE) {
                    // Protegemos zona de seguridad inicial (esquina 1,1)
                    if (r < 5 && c < 5) continue; 
                    
                    this.map[r][c] = 2; 
                    this.destructibles.push({ c, r, active: true });
                }
            }
        }

        // 4. Calcular Spawns Seguros (Ahora es más difícil porque hay más 2s)
        this.findStrategicSpawns();

        // 5. Render
        this.bakeStaticLayer();
    }

    

    bakeStaticLayer() {
        const ctx = this.staticCtx;
        ctx.clearRect(0, 0, this.width, this.height);
        
        ctx.fillStyle = '#050505';
        ctx.fillRect(0, 0, this.width, this.height);

        ctx.shadowBlur = 10;
        ctx.shadowColor = CONFIG.WALL_NEON;
        ctx.strokeStyle = CONFIG.WALL_NEON;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';

        ctx.beginPath();
        for (let r = 0; r < CONFIG.ROWS; r++) {
            for (let c = 0; c < CONFIG.COLS; c++) {
                if (this.map[r][c] === 1) { 
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
        ctx.drawImage(this.staticLayer, 0, 0);

        ctx.strokeStyle = CONFIG.DEST_WALL_COLOR;
        ctx.shadowColor = CONFIG.DEST_WALL_COLOR;
        ctx.shadowBlur = 5;
        
        ctx.beginPath();
        this.destructibles.forEach(d => {
            if (d.active) {
                const x = this.marginLeft + d.c * this.cellSize;
                const y = this.marginTop + d.r * this.cellSize;
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

    // --- FÍSICA ---

    isValid(r, c) {
        return r >= 0 && r < CONFIG.ROWS && c >= 0 && c < CONFIG.COLS;
    }

    checkCollision(x, y, radius) {
        const localX = x - this.marginLeft;
        const localY = y - this.marginTop;

        const startC = Math.floor((localX - radius) / this.cellSize);
        const endC = Math.floor((localX + radius) / this.cellSize);
        const startR = Math.floor((localY - radius) / this.cellSize);
        const endR = Math.floor((localY + radius) / this.cellSize);

        for (let r = startR; r <= endR; r++) {
            for (let c = startC; c <= endC; c++) {
                if (!this.isValid(r, c)) return true; 

                const cellValue = this.map[r][c];
                if (cellValue === 1 || cellValue === 2) {
                    const cellX = c * this.cellSize;
                    const cellY = r * this.cellSize;
                    
                    if (localX + radius > cellX && localX - radius < cellX + this.cellSize &&
                        localY + radius > cellY && localY - radius < cellY + this.cellSize) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    // NUEVO: Lógica de Balas vs Muros
    checkProjectileHit(x, y) {
        const localX = x - this.marginLeft;
        const localY = y - this.marginTop;
        
        const c = Math.floor(localX / this.cellSize);
        const r = Math.floor(localY / this.cellSize);

        if (!this.isValid(r, c)) return 'SOLID'; // Borde del mundo

        const cell = this.map[r][c];

        if (cell === 1) return 'SOLID'; // Muro Indestructible (Rebote o Destroy)
        
        if (cell === 2) { 
            // IMPACTO DESTRUCTIBLE
            this.map[r][c] = 0; // Se convierte en aire
            // Buscar y desactivar visualmente
            const target = this.destructibles.find(d => d.c === c && d.r === r);
            if (target) target.active = false;
            
            return 'DESTROYED_WALL';
        }

        return null; // Aire
    }

    findStrategicSpawns() {
        const candidates = [];
        const centerX = CONFIG.COLS / 2;
        const centerY = CONFIG.ROWS / 2;

        // Barrido buscando suelo firme (0)
        for (let r = 1; r < CONFIG.ROWS - 1; r++) {
            for (let c = 1; c < CONFIG.COLS - 1; c++) {
                if (this.map[r][c] === 0) {
                    const dist = Math.pow(c - centerX, 2) + Math.pow(r - centerY, 2);
                    candidates.push({ r, c, dist });
                }
            }
        }

        // 1. SPAWNS DE JUGADORES (LEJOS DEL CENTRO)
        // Ordenamos descendente (Mayor distancia primero)
        candidates.sort((a, b) => b.dist - a.dist);
        // Nos quedamos con los 16 más lejanos para dar variedad
        this.playerSpawns = candidates.slice(0, 16).map(p => ({ r: p.r, c: p.c }));

        // 2. SPAWNS DE ENEMIGOS (CERCA DEL CENTRO)
        // Ordenamos ascendente (Menor distancia primero)
        candidates.sort((a, b) => a.dist - b.dist);
        // Nos quedamos con el 50% central de candidatos para que no salgan todos en el mismo pixel
        // pero que tiendan al centro.
        const enemyCandidateCount = Math.floor(candidates.length * 0.5);
        this.enemySpawns = candidates.slice(0, enemyCandidateCount).map(p => ({ r: p.r, c: p.c }));
        
        console.log(`📍 Spawns: ${this.playerSpawns.length} Player (Edge) / ${this.enemySpawns.length} Enemy (Center)`);
    }

    getPlayerSpawn() {
        if (this.playerSpawns.length > 0) {
            const idx = Math.floor(Math.random() * this.playerSpawns.length);
            // Ojo: No hacemos splice para permitir reusar si hay muchos jugadores,
            // pero idealmente deberíamos evitar superposición en main.js
            const pt = this.playerSpawns[idx]; 
            return this.gridToPixel(pt.r, pt.c);
        }
        return this.gridToPixel(1, 1); // Fallback
    }

    getEnemySpawn() {
        if (this.enemySpawns.length > 0) {
            const idx = Math.floor(Math.random() * this.enemySpawns.length);
            const pt = this.enemySpawns[idx];
            return this.gridToPixel(pt.r, pt.c);
        }
        return this.gridToPixel(CONFIG.ROWS/2, CONFIG.COLS/2); // Fallback centro
    }

    // Helper para no repetir fórmula
    gridToPixel(r, c) {
        return {
            x: this.marginLeft + (c * this.cellSize) + (this.cellSize / 2),
            y: this.marginTop + (r * this.cellSize) + (this.cellSize / 2)
        };
    }
}