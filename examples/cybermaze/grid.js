// grid.js
// ==========================================
// GESTOR DEL MAPA Y FÍSICA ESTÁTICA
// ==========================================

class Grid {
    constructor(w, h) {
        this.width = w;
        this.height = h;
        
        // CÁLCULO DE DIMENSIONES
        this.cellSize = Math.min(w / CONFIG.COLS, h / CONFIG.ROWS);
        this.marginLeft = (w - (this.cellSize * CONFIG.COLS)) / 2;
        this.marginTop = (h - (this.cellSize * CONFIG.ROWS)) / 2;
        
        // DATOS DEL MAPA
        this.map = []; 
        this.destructibles = []; 
        this.playerSpawns = [];
        this.enemySpawns = [];

        // SISTEMAS
        this.pathfinder = new Pathfinder(); // Instancia del nuevo motor

        // BUFFER GRÁFICO
        this.staticLayer = document.createElement('canvas');
        this.staticLayer.width = w;
        this.staticLayer.height = h;
        this.staticCtx = this.staticLayer.getContext('2d');
    }

    // ==========================================
    // 1. GENERACIÓN PROCEDIMENTAL
    // ==========================================
    generate() {
        // Reset
        this.map = Array(CONFIG.ROWS).fill().map(() => Array(CONFIG.COLS).fill(1));
        this.destructibles = [];
        this.spawnPoints = [];

        // FASE 1: ESCULPIR (Recursive Backtracker)
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
                if (nc > 0 && nc < CONFIG.COLS - wCorr && 
                    nr > 0 && nr < CONFIG.ROWS - wCorr && 
                    this.map[nr][nc] === 1) { 
                    carve(cur.r + dr/2, cur.c + dc/2); 
                    carve(nr, nc);         
                    stack.push({ c: nc, r: nr });
                    found = true;
                    break;
                }
            }
            if (!found) stack.pop();
        }

        // FASE 2: DECADENCIA (Rotura de muros estructurales)
        for (let r = 1; r < CONFIG.ROWS - 1; r++) {
            for (let c = 1; c < CONFIG.COLS - 1; c++) {
                if (this.map[r][c] === 1) {
                    if (r===0 || c===0 || r===CONFIG.ROWS-1 || c===CONFIG.COLS-1) continue;
                    if (Math.random() < CONFIG.MAZE_WALL_WEAKNESS_RATIO) {
                        this.map[r][c] = 2; 
                        this.destructibles.push({ c, r, active: true });
                    }
                }
            }
        }

        // FASE 3: ESCOMBROS (Obstáculos en pasillos)
        for (let r = 1; r < CONFIG.ROWS - 1; r++) {
            for (let c = 1; c < CONFIG.COLS - 1; c++) {
                if (this.map[r][c] === 0 && Math.random() < CONFIG.MAZE_DEBRIS_CHANCE) {
                    if (r < 5 && c < 5) continue; 
                    this.map[r][c] = 2; 
                    this.destructibles.push({ c, r, active: true });
                }
            }
        }

        // FASE 4: SPAWNS & RENDER
        this.findStrategicSpawns();
        this.bakeStaticLayer();
    }

    // ==========================================
    // 2. PATHFINDING (DELEGADO)
    // ==========================================
    getPath(startX, startY, targetX, targetY) {
        // Convertir mundo (pixels) -> grid (celdas)
        const start = this.pixelToGrid(startX, startY);
        const end = this.pixelToGrid(targetX, targetY);

        // Llamada al especialista
        const pathNodes = this.pathfinder.findPath(this.map, start, end);

        // Convertir respuesta (celdas) -> mundo (pixels centrado)
        return pathNodes.map(node => this.gridToPixel(node.r, node.c));
    }

    // ==========================================
    // 3. SPAWNS (Lógica Asimétrica)
    // ==========================================
    findStrategicSpawns() {
        const candidates = [];
        const centerX = CONFIG.COLS / 2;
        const centerY = CONFIG.ROWS / 2;

        for (let r = 1; r < CONFIG.ROWS - 1; r++) {
            for (let c = 1; c < CONFIG.COLS - 1; c++) {
                if (this.map[r][c] === 0) {
                    const dist = Math.pow(c - centerX, 2) + Math.pow(r - centerY, 2);
                    candidates.push({ r, c, dist });
                }
            }
        }

        // Jugadores: Lejos del centro
        candidates.sort((a, b) => b.dist - a.dist);
        this.playerSpawns = candidates.slice(0, 16).map(p => ({ r: p.r, c: p.c }));

        // Enemigos: Cerca del centro (50% central)
        candidates.sort((a, b) => a.dist - b.dist);
        const enemyCount = Math.floor(candidates.length * 0.5);
        this.enemySpawns = candidates.slice(0, enemyCount).map(p => ({ r: p.r, c: p.c }));
    }

    getPlayerSpawn() {
        if (this.playerSpawns.length > 0) {
            const idx = Math.floor(Math.random() * this.playerSpawns.length);
            const pt = this.playerSpawns[idx];
            return this.gridToPixel(pt.r, pt.c);
        }
        return this.gridToPixel(1, 1);
    }

    getEnemySpawn() {
        if (this.enemySpawns.length > 0) {
            const idx = Math.floor(Math.random() * this.enemySpawns.length);
            const pt = this.enemySpawns[idx];
            return this.gridToPixel(pt.r, pt.c);
        }
        return this.gridToPixel(CONFIG.ROWS/2, CONFIG.COLS/2);
    }

    // ==========================================
    // 4. FÍSICA & RENDER
    // ==========================================
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
        
        // Muros Destructibles
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
                const val = this.map[r][c];
                if (val === 1 || val === 2) {
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

    checkProjectileHit(x, y) {
        const pt = this.pixelToGrid(x, y);
        if (!this.isValid(pt.r, pt.c)) return 'SOLID';
        
        const cell = this.map[pt.r][pt.c];
        if (cell === 1) return 'SOLID';
        
        if (cell === 2) { 
            this.map[pt.r][pt.c] = 0; // Romper muro
            const target = this.destructibles.find(d => d.c === pt.c && d.r === pt.r);
            if (target) target.active = false;
            return 'DESTROYED_WALL';
        }
        return null;
    }

    // ==========================================
    // 5. HELPERS
    // ==========================================
    isValid(r, c) {
        return r >= 0 && r < CONFIG.ROWS && c >= 0 && c < CONFIG.COLS;
    }

    gridToPixel(r, c) {
        return {
            x: this.marginLeft + (c * this.cellSize) + (this.cellSize / 2),
            y: this.marginTop + (r * this.cellSize) + (this.cellSize / 2)
        };
    }

    pixelToGrid(x, y) {
        return {
            c: Math.floor((x - this.marginLeft) / this.cellSize),
            r: Math.floor((y - this.marginTop) / this.cellSize)
        };
    }
}