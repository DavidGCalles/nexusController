// ==========================================
// 3. GENERACIÓN
// ==========================================
function generateMaze() {
    // Parameterized corridor carving
    grid = Array(ROWS).fill().map(() => Array(COLS).fill(0));
    destWalls = [];
    openBlocks = [];

    const wCorr = Math.max(2, Math.floor(CONFIG.mazeCorridorWidth || 2));
    const step = CONFIG.mazeCarveSpacing && CONFIG.mazeCarveSpacing > 0 ? CONFIG.mazeCarveSpacing : wCorr * 2;

    const carve_block = (r, c) => {
        for (let dr = 0; dr < wCorr; dr++) {
            for (let dc = 0; dc < wCorr; dc++) {
                if (grid[r+dr] && grid[r+dr][c+dc] !== undefined) grid[r+dr][c+dc] = 1;
            }
        }
        openBlocks.push({ r: r, c: c });
    };

    const stack = [{ c: 1, r: 1 }];
    carve_block(1, 1);

    while (stack.length) {
        const cur = stack[stack.length - 1];
        const dirs = [[0, -step], [0, step], [-step, 0], [step, 0]].sort(() => Math.random() - 0.5);
        let found = false;

        for (let [dc, dr] of dirs) {
            const nc = cur.c + dc;
            const nr = cur.r + dr;

            if (nc > 0 && nc < COLS - wCorr && nr > 0 && nr < ROWS - wCorr && grid[nr][nc] === 0) {
                const path_c = cur.c + dc / 2;
                const path_r = cur.r + dr / 2;
                carve_block(path_r, path_c);
                carve_block(nr, nc);
                stack.push({ c: nc, r: nr });
                found = true;
                break;
            }
        }
        if (!found) stack.pop();
    }

    // Paredes destruibles (block-sized)
    const chance = Math.max(0, Math.min(1, CONFIG.mazeBreakableBlockChance || 0.12));
    for (let r = 1; r < ROWS - wCorr; r += step) {
        for (let c = 1; c < COLS - wCorr; c += step) {
            // check block area
            let isWallBlock = true;
            for (let dr = 0; dr < wCorr; dr++) {
                for (let dc = 0; dc < wCorr; dc++) {
                    if (grid[r + dr][c + dc] === 1) { isWallBlock = false; break; }
                }
                if (!isWallBlock) break;
            }
            if (isWallBlock && Math.random() < chance) {
                for (let dr = 0; dr < wCorr; dr++) {
                    for (let dc = 0; dc < wCorr; dc++) {
                        destWalls.push({ c: c + dc, r: r + dr, active: true });
                    }
                }
            }
        }
    }
}
