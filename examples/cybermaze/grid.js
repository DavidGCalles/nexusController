// grid.js
// ==========================================
// GESTOR DEL MAPA, PARSER Y FÍSICA ESTÁTICA
// ==========================================

class Grid {
    constructor(w, h) {
        this.width = w;
        this.height = h;
        this.cellSize = 0; // Se calcula al cargar el nivel
        
        // DATOS DEL MAPA
        this.map = []; 
        
        // Listas de entidades lógicas
        this.destructibles = []; 
        this.playerSpawns = [null, null, null, null]; // Slots fijos P1-P4 (Manual)
        this.enemySpawners = [];      // Emisores fijos (Manual)
        this.enemySpawnCandidates = []; // Candidatos heurísticos (Procedural)

        // SISTEMAS
        this.pathfinder = new Pathfinder(); 

        // BUFFER GRÁFICO
        this.staticLayer = document.createElement('canvas');
        this.staticLayer.width = w;
        this.staticLayer.height = h;
        this.staticCtx = this.staticLayer.getContext('2d');
    }

    // ==========================================
    // 1. PUNTO DE ENTRADA (CARGA DE NIVEL)
    // ==========================================
    loadLevel(levelId) {
        console.log(`🗺️ CARGANDO NIVEL: ${levelId}`);
        
        // 1. Resetear estado anterior
        this.reset();

        // 2. Determinar fuente del mapa
        if (typeof LEVELS !== 'undefined' && LEVELS[levelId]) {
            // MODO ARQUITECTO (Manual)
            // Calculamos cellSize basado en las dimensiones del ASCII map
            const layout = LEVELS[levelId];
            const rows = layout.length;
            const cols = layout[0].length;
            
            // Ajustamos el tamaño de celda para que quepa en pantalla manteniendo aspect ratio
            this.cellSize = Math.min(this.width / cols, this.height / rows);
            this.marginLeft = (this.width - (this.cellSize * cols)) / 2;
            this.marginTop = (this.height - (this.cellSize * rows)) / 2;
            
            this.parseSchematic(layout);
        } else {
            // MODO ROBOT (Procedural)
            // Usamos las constantes de configuración global
            this.cellSize = Math.min(this.width / CONFIG.COLS, this.height / CONFIG.ROWS);
            this.marginLeft = (this.width - (this.cellSize * CONFIG.COLS)) / 2;
            this.marginTop = (this.height - (this.cellSize * CONFIG.ROWS)) / 2;
            
            this.generateProcedural();
        }

        // 3. Bakeado Final (Común)
        this.bakeStaticLayer();
        
        // Devolvemos cell size para que main.js recalcule físicas
        return this.cellSize;
    }

    reset() {
        this.map = [];
        this.destructibles = [];
        this.playerSpawns = [null, null, null, null];
        this.enemySpawners = [];
        this.enemySpawnCandidates = [];
        // Limpiar canvas
        this.staticCtx.clearRect(0, 0, this.width, this.height);
    }

    // ==========================================
    // 2. PARSER ASCII (MODO MANUAL)
    // ==========================================
    parseSchematic(layout) {
        const rows = layout.length;
        const cols = layout[0].length;
        
        // Inicializar matriz vacía
        this.map = Array(rows).fill().map(() => Array(cols).fill(0));

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const char = layout[r][c];
                let val = 0; // Por defecto suelo (.)

                switch(char) {
                    case '#': val = 1; break; // Muro Indestructible
                    case '+': // Muro Destructible
                        val = 2; 
                        this.destructibles.push({ c, r, active: true });
                        break;
                    case '_': val = 3; break; // Base Aliada
                    case '^': val = 4; break; // Base Enemiga
                    
                    // ENTIDADES (No dejan rastro físico, ponen suelo '0')
                    case 'S': 
                        this.enemySpawners.push({ c, r }); 
                        val = 0; 
                        break;
                    case '1': this.playerSpawns[0] = { c, r }; val = 0; break;
                    case '2': this.playerSpawns[1] = { c, r }; val = 0; break;
                    case '3': this.playerSpawns[2] = { c, r }; val = 0; break;
                    case '4': this.playerSpawns[3] = { c, r }; val = 0; break;
                    
                    default: val = 0; // '.' o espacio es suelo
                }
                this.map[r][c] = val;
            }
        }
    }

    // ==========================================
    // 3. GENERADOR PROCEDURAL (MODO ROBOT)
    // ==========================================
    generateProcedural() {
        // Inicializar todo como muros
        this.map = Array(CONFIG.ROWS).fill().map(() => Array(CONFIG.COLS).fill(1));
        
        // Algoritmo Recursive Backtracker
        const wCorr = CONFIG.MAZE_CORRIDOR_WIDTH || 2;
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
                
                // Chequeo de límites y si es muro
                if (nc > 0 && nc < CONFIG.COLS - wCorr && 
                    nr > 0 && nr < CONFIG.ROWS - wCorr && 
                    this.map[nr][nc] === 1) { 
                    
                    carve(cur.r + dr/2, cur.c + dc/2); // Pasillo intermedio
                    carve(nr, nc); // Celda destino
                    stack.push({ c: nc, r: nr });
                    found = true;
                    break;
                }
            }
            if (!found) stack.pop();
        }

        // Fase de Decadencia (Muros destructibles)
        for (let r = 1; r < CONFIG.ROWS - 1; r++) {
            for (let c = 1; c < CONFIG.COLS - 1; c++) {
                if (this.map[r][c] === 1) {
                    // Evitar bordes del mapa
                    if (r===0 || c===0 || r===CONFIG.ROWS-1 || c===CONFIG.COLS-1) continue;
                    
                    if (Math.random() < (CONFIG.MAZE_WALL_WEAKNESS_RATIO || 0.3)) {
                        this.map[r][c] = 2; 
                        this.destructibles.push({ c, r, active: true });
                    }
                }
            }
        }

        // Calcular Spawns Heurísticos (porque no hay manuales)
        this.findStrategicSpawns();
    }

    // ==========================================
    // 4. SPAWNS & UTILIDADES
    // ==========================================
    
    // Calcula candidatos heurísticos (solo para procedural)
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
        // Guardamos candidatos para player (aunque getPlayerSpawn tiene lógica random)
        this.playerSpawnCandidates = candidates.slice(0, 16);

        // Enemigos: Cerca del centro (50% central)
        candidates.sort((a, b) => a.dist - b.dist);
        const enemyCount = Math.floor(candidates.length * 0.5);
        this.enemySpawnCandidates = candidates.slice(0, enemyCount);
    }

    getPlayerSpawn(playerIndex) {
        // 1. Prioridad: Spawn Fijo Manual (Símbolos '1', '2', etc.)
        if (playerIndex !== undefined && this.playerSpawns[playerIndex]) {
            const pt = this.playerSpawns[playerIndex];
            return this.gridToPixel(pt.r, pt.c);
        }

        // 2. Fallback: Heurístico (Procedural)
        if (this.playerSpawnCandidates && this.playerSpawnCandidates.length > 0) {
            const idx = Math.floor(Math.random() * this.playerSpawnCandidates.length);
            const pt = this.playerSpawnCandidates[idx];
            return this.gridToPixel(pt.r, pt.c);
        }

        // 3. Fallback Final: Esquina superior izquierda
        return this.gridToPixel(1, 1);
    }

    getEnemySpawn() {
        // 1. Prioridad: Spawners Manuales (Símbolo 'S')
        if (this.enemySpawners.length > 0) {
            const s = this.enemySpawners[Math.floor(Math.random() * this.enemySpawners.length)];
            return this.gridToPixel(s.r, s.c);
        }

        // 2. Fallback: Heurístico (Procedural)
        if (this.enemySpawnCandidates && this.enemySpawnCandidates.length > 0) {
            const idx = Math.floor(Math.random() * this.enemySpawnCandidates.length);
            const pt = this.enemySpawnCandidates[idx];
            return this.gridToPixel(pt.r, pt.c);
        }

        // 3. Fallback Final: Centro
        return this.gridToPixel(Math.floor(this.map.length/2), Math.floor(this.map[0].length/2));
    }

    // ==========================================
    // 5. RENDER & FÍSICA
    // ==========================================
    bakeStaticLayer() {
        const ctx = this.staticCtx;
        ctx.clearRect(0, 0, this.width, this.height);
        
        // Fondo base
        ctx.fillStyle = '#050505';
        ctx.fillRect(0, 0, this.width, this.height);

        // Estilos
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';

        const rows = this.map.length;
        const cols = this.map[0].length;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const x = this.marginLeft + c * this.cellSize;
                const y = this.marginTop + r * this.cellSize;
                const val = this.map[r][c];

                if (val === 1) { // Muro Indestructible
                    ctx.strokeStyle = CONFIG.WALL_NEON || '#0088ff';
                    ctx.shadowColor = CONFIG.WALL_NEON || '#0088ff';
                    ctx.shadowBlur = 10;
                    ctx.strokeRect(x, y, this.cellSize, this.cellSize);
                    ctx.shadowBlur = 0;
                } 
                else if (val === 3) { // Base Aliada (Zona Segura)
                    ctx.fillStyle = 'rgba(0, 255, 255, 0.15)';
                    ctx.fillRect(x, y, this.cellSize, this.cellSize);
                    
                    ctx.strokeStyle = '#00ffff';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(x+4, y+4, this.cellSize-8, this.cellSize-8);
                    
                    // Icono de base (opcional)
                    ctx.fillStyle = '#00ffff';
                    ctx.font = `${this.cellSize/2}px monospace`;
                    ctx.textAlign = 'center';
                    ctx.fillText("A", x + this.cellSize/2, y + this.cellSize/1.5);
                }
                else if (val === 4) { // Base Enemiga (Zona Hostil)
                    ctx.fillStyle = 'rgba(255, 0, 50, 0.15)';
                    ctx.fillRect(x, y, this.cellSize, this.cellSize);
                    
                    ctx.strokeStyle = '#ff0033';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(x+4, y+4, this.cellSize-8, this.cellSize-8);

                    ctx.fillStyle = '#ff0033';
                    ctx.font = `${this.cellSize/2}px monospace`;
                    ctx.textAlign = 'center';
                    ctx.fillText("E", x + this.cellSize/2, y + this.cellSize/1.5);
                }
            }
        }
    }

    draw(ctx) {
        // 1. Capa Estática (Bakeada)
        ctx.drawImage(this.staticLayer, 0, 0);
        
        // 2. Muros Destructibles (Dinámicos)
        ctx.strokeStyle = CONFIG.DEST_WALL_COLOR || '#ffcc00';
        ctx.shadowColor = CONFIG.DEST_WALL_COLOR || '#ffcc00';
        ctx.shadowBlur = 5;
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        this.destructibles.forEach(d => {
            if (d.active) {
                const x = this.marginLeft + d.c * this.cellSize;
                const y = this.marginTop + d.r * this.cellSize;
                const pad = 4;
                const size = this.cellSize - (pad * 2);
                
                // Dibujo de caja con X dentro
                ctx.rect(x + pad, y + pad, size, size);
                ctx.moveTo(x + pad, y + pad);
                ctx.lineTo(x + pad + size, y + pad + size);
                ctx.moveTo(x + pad + size, y + pad);
                ctx.lineTo(x + pad, y + pad + size);
            }
        });
        ctx.stroke();
        ctx.shadowBlur = 0;

        // 3. Debug Spawners (Solo si quieres verlos invisible)
        /*
        ctx.fillStyle = 'rgba(255, 255, 0, 0.5)';
        this.enemySpawners.forEach(s => {
            const pt = this.gridToPixel(s.r, s.c);
            ctx.fillRect(pt.x-5, pt.y-5, 10, 10);
        });
        */
    }

    // ==========================================
    // 6. COLISIONES
    // ==========================================
    checkCollision(x, y, radius) {
        const localX = x - this.marginLeft;
        const localY = y - this.marginTop;
        
        // Optimización: Solo chequear celdas vecinas
        const startC = Math.floor((localX - radius) / this.cellSize);
        const endC = Math.floor((localX + radius) / this.cellSize);
        const startR = Math.floor((localY - radius) / this.cellSize);
        const endR = Math.floor((localY + radius) / this.cellSize);

        for (let r = startR; r <= endR; r++) {
            for (let c = startC; c <= endC; c++) {
                if (!this.isValid(r, c)) return true; // Fuera de mapa es sólido
                
                const val = this.map[r][c];
                // 1=Muro, 2=Destructible. (0, 3, 4 son pasables)
                if (val === 1 || val === 2) {
                    const cellX = c * this.cellSize;
                    const cellY = r * this.cellSize;
                    
                    // AABB vs Círculo simple (Box check)
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
        if (cell === 1) return 'SOLID'; // Muro indestructible
        
        if (cell === 2) { 
            this.map[pt.r][pt.c] = 0; // Romper muro -> Aire
            const target = this.destructibles.find(d => d.c === pt.c && d.r === pt.r);
            if (target) target.active = false;
            return 'DESTROYED_WALL';
        }
        return null;
    }

    // Delegado al pathfinder
    getPath(startX, startY, targetX, targetY) {
        const start = this.pixelToGrid(startX, startY);
        const end = this.pixelToGrid(targetX, targetY);
        const pathNodes = this.pathfinder.findPath(this.map, start, end);
        return pathNodes.map(node => this.gridToPixel(node.r, node.c));
    }
    
    // Line of Sight (Raycasting simple sobre grid)
    hasLineOfSight(x0, y0, x1, y1) {
        const start = this.pixelToGrid(x0, y0);
        const end = this.pixelToGrid(x1, y1);
        
        let x = start.c;
        let y = start.r;
        const dx = Math.abs(end.c - start.c);
        const dy = Math.abs(end.r - start.r);
        const sx = (start.c < end.c) ? 1 : -1;
        const sy = (start.r < end.r) ? 1 : -1;
        let err = dx - dy;

        while (true) {
            // Si chocamos con Muro (1) o Destructible (2), bloquea visión
            const val = this.map[y][x];
            if (val === 1 || val === 2) return false;
            
            if (x === end.c && y === end.r) break;
            
            const e2 = 2 * err;
            if (e2 > -dy) { err -= dy; x += sx; }
            if (e2 < dx) { err += dx; y += sy; }
            
            if (!this.isValid(y, x)) return false;
        }
        return true;
    }

    // ==========================================
    // 7. HELPERS COORDENADAS
    // ==========================================
    isValid(r, c) {
        return r >= 0 && r < this.map.length && c >= 0 && c < this.map[0].length;
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