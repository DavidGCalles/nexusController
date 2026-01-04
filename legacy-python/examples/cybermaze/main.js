// ==========================================
// 4. RENDERING OPTIMIZADO (BUFFER)
// ==========================================
function prerenderMaze() {
    mazeCanvas.width = w;
    mazeCanvas.height = h;

    // Fondo
    mazeCtx.fillStyle = '#050505';
    mazeCtx.fillRect(0, 0, w, h);

    // Muros estáticos
    mazeCtx.strokeStyle = '#222';
    mazeCtx.lineWidth = 1;
    mazeCtx.beginPath();
    for(let x=0; x<=w; x+=cellSize) { mazeCtx.moveTo(x,0); mazeCtx.lineTo(x,h); }
    for(let y=0; y<=h; y+=cellSize) { mazeCtx.moveTo(0,y); mazeCtx.lineTo(w,y); }
    mazeCtx.stroke();

    // Neon Walls
    mazeCtx.shadowBlur = 10;
    mazeCtx.shadowColor = '#0044ff';
    mazeCtx.strokeStyle = '#0088ff';
    mazeCtx.lineWidth = 2;
    mazeCtx.lineCap = 'round';
    mazeCtx.beginPath();

    for(let r=0; r<ROWS; r++) {
        for(let c=0; c<COLS; c++) {
            if(grid[r][c] === 0) {
                // Don't pre-render walls that are destructible
                const isDestWall = destWalls.some(d => d.c === c && d.r === r);
                if (!isDestWall) {
                    const x = c*cellSize + cellSize/2;
                    const y = r*cellSize + cellSize/2;
                    const s = cellSize/3;
                    mazeCtx.moveTo(x-s, y-s); mazeCtx.lineTo(x+s, y+s);
                    mazeCtx.moveTo(x+s, y-s); mazeCtx.lineTo(x-s, y+s);
                }
            }
        }
    }
    mazeCtx.stroke();
    mazeCtx.shadowBlur = 0;
}

function initLevel(resetProgress = false) {
    gameState = 'playing'; // Set state to playing once initialized
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
    cellSize = Math.min(w/COLS, h/ROWS);
    
    player.r = cellSize * 0.3;
    player.x = cellSize * 1.5;
    player.y = cellSize * 1.5;

    generateMaze();
    prerenderMaze();

    // Select goal and spawn points from carved open blocks (if available)
    if (openBlocks && openBlocks.length) {
        const first = openBlocks[0];
        const middle = openBlocks[Math.floor(openBlocks.length / 2)];
        const last = openBlocks[openBlocks.length - 1];
        goal.c = last.c; goal.r = last.r;
        spawnPoints = [
            { c: last.c, r: last.r },
            { c: middle.c, r: middle.r },
            { c: first.c, r: first.r }
        ];
    } else {
        const goal_c = 1 + 4 * Math.floor((COLS - 4) / 4);
        const goal_r = 1 + 4 * Math.floor((ROWS - 4) / 4);
        goal.c = goal_c; goal.r = goal_r;
        spawnPoints = [
            { c: goal_c, r: goal_r }, // bottom-right
            { c: goal_c, r: 1 },  // top-right
            { c: 1, r: goal_r }   // bottom-left
        ];
    }
    
    enemies = [];
    lastSpawn = Date.now();
    
    // Difficulty scaling based on starting level
    spawnRate = CONFIG.initialSpawnRate * Math.pow(0.95, level - 1);
    spawnRate = Math.max(CONFIG.minSpawnRate, spawnRate);
    CONFIG.maxEnemies = Math.min(10, 3 + Math.floor((level - 1) / 3));


    // Player progression should be independent from scene number.
    // `resetProgress===true` indicates a full restart (e.g., after game over).
    if (resetProgress) {
        player.level = 1;
        player.xp = 0;
        player.xpToNextLevel = CONFIG.xpLevelBase;
        player.pendingXP = 0;
    } else {
        // Keep existing player.level/xp. Ensure xpToNextLevel is set for current level.
        if (!player.xpToNextLevel) player.xpToNextLevel = Math.floor(CONFIG.xpLevelBase * Math.pow(CONFIG.xpLevelMultiplier, Math.max(0, player.level - 1)));
    }


    document.getElementById('levelDisplay').innerText = `LEVEL ${level.toString().padStart(2,'0')}`;
    bullets = [];
    rays = [];
    particles = [];
}

const audioCtx = window.AudioContext ? new AudioContext() : null;
function playLevelUpSound() {
    if (!audioCtx) return;
    // A simple rising synth sound
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.type = 'triangle';
    gain.gain.setValueAtTime(0, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.4, audioCtx.currentTime + 0.1);
    gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.8);
    
    osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
    osc.frequency.linearRampToValueAtTime(1046.50, audioCtx.currentTime + 0.6); // C6
    
    osc.start();
    osc.stop(audioCtx.currentTime + 1);
}

function checkLevelUp() {
    while (player.xp >= player.xpToNextLevel) {
        player.level++;
        player.xp -= player.xpToNextLevel;
        player.xpToNextLevel = Math.floor(player.xpToNextLevel * CONFIG.xpLevelMultiplier);
        
        player.levelUpGlow = 150; // Set glow duration (in frames)
        playLevelUpSound();

        // Visual feedback for level up (particles)
        for(let k=0;k<60;k++) particles.push({
            x: player.x, y: player.y,
            vx:(Math.random()-.5)*9, vy:(Math.random()-.5)*9,
            life:50, color:'#ffffaa'
        });
    }
}

// ==========================================
// 5. LÓGICA
// ==========================================
function getPath(sx, sy, tx, ty) {
    const sc = Math.floor(sx/cellSize), sr = Math.floor(sy/cellSize);
    const tc = Math.floor(tx/cellSize), tr = Math.floor(ty/cellSize);
    const queue = [{c:sc, r:sr, p:[]}];
    const visited = new Set([`${sc},${sr}`]);
    
    let safeLoop = 0;
    while(queue.length && safeLoop++ < 2000) {
        const cur = queue.shift();
        if(cur.c === tc && cur.r === tr) return cur.p;
        
        [[0,1],[0,-1],[1,0],[-1,0]].forEach(([dc, dr]) => {
            const nc = cur.c+dc, nr = cur.r+dr;
            const isDestWall = destWalls.some(d => d.active && d.c === nc && d.r === nr);
            
            if(grid[nr] && grid[nr][nc] === 1 && !isDestWall) {
                const key = `${nc},${nr}`;
                if(!visited.has(key)) {
                    visited.add(key);
                    queue.push({c:nc, r:nr, p:[...cur.p, {c:nc, r:nr}]});
                }
            }
        });
    }
    return [];
}

let selectedLevel = 1;
let lastLevelChange = 0;

function update() {
    if (gameState === 'level-select') {
        const now = Date.now();
        const levelSelectUI = document.getElementById('levelSelect');
        levelSelectUI.style.display = 'flex';

        if (now - lastLevelChange > 200) {
            if (nexus.lx > 0.8) {
                selectedLevel = Math.min(99, selectedLevel + 1);
                lastLevelChange = now;
            } else if (nexus.lx < -0.8) {
                selectedLevel = Math.max(1, selectedLevel - 1);
                lastLevelChange = now;
            }
        }
        document.getElementById('levelSelectValue').innerText = selectedLevel;

        if (nexus.start && !lastNexus.start) {
            level = selectedLevel;
            levelSelectUI.style.display = 'none';
            initLevel();
        }
        lastNexus = { ...nexus };
        return;
    }

    if (nexus.start && !lastNexus.start) { // start was just pressed
        if (gameState === 'playing') gameState = 'paused';
        else if (gameState === 'paused') gameState = 'playing';
    }

    if (gameState === 'win' || gameState === 'gameover') {
        if (nexus.start) {
            if (gameState === 'win') {
                // Merge pending stage XP into player.xp before moving to next stage
                // and process level-ups now so overflow XP isn't stuck until next kill.
                if (player.pendingXP) {
                    player.xp += player.pendingXP;
                    player.pendingXP = 0;
                }
                // Process any level-ups from the merged XP before advancing scene
                checkLevelUp();
                level++;
                initLevel(false);
            } else {
                // Game over -> full restart, reset player progression
                level = 1;
                initLevel(true);
            }
        }
        return;
    }
    
    if (gameState !== 'playing') {
        lastNexus = { ...nexus };
        return; // Catches 'paused' state
    }


    // Jugador
    let dx = 0, dy = 0;
    const now = Date.now();
    const canDash = now - player.lastDash > CONFIG.playerDashCooldown;
    const canFireRay = player.level >= CONFIG.rayUnlockLevel && now - player.lastRay > CONFIG.rayCooldown;

    // --- SKILLS & STATE ---
        if (nexus.lt > 0.5 && canDash && !player.isDashing) {
            player.isDashing = true;
            player.isRayDashing = player.isRayModeActive; // Check for synergy
            player.lastDash = now;
            const moveMag = Math.hypot(nexus.lx, nexus.ly);
            if (moveMag > 0.1) player.dashAngle = Math.atan2(nexus.ly, nexus.lx);
            else if (Math.hypot(nexus.rx, nexus.ry) > 0.1) player.dashAngle = Math.atan2(nexus.ry, nexus.rx);
            else player.dashAngle = 0; 
        }    player.isRayModeActive = player.level >= CONFIG.rayUnlockLevel && nexus.rt > 0.5;

    // --- MOVEMENT ---
        if (player.isDashing) {
            const dashDuration = player.isRayDashing ? CONFIG.rayDashDuration : CONFIG.playerDashDuration;

            if (now - player.lastDash > dashDuration) {
                player.isDashing = false;
                player.isRayDashing = false;

                // Dash-end explosion
                const explosionRadius = player.isRayDashing 
                    ? cellSize * CONFIG.rayDashExplosionRadius 
                    : cellSize * CONFIG.playerDashExplosionRadius;
                const enemiesToKill = enemies.filter(en => Math.hypot(player.x - en.x, player.y - en.y) < explosionRadius);

                if (enemiesToKill.length > 0) {
                    enemiesToKill.forEach(en => {
                        player.xp += en.xpValue || CONFIG.xpPerEnemy;
                        for(let k=0; k<15; k++) particles.push({ x: en.x, y: en.y, vx:(Math.random()-.5)*6, vy:(Math.random()-.5)*6, life:30, color: en.color });
                    });
                    enemies = enemies.filter(en => !enemiesToKill.includes(en));
                    if (player.pendingXP) { player.xp += player.pendingXP; player.pendingXP = 0; }
                    checkLevelUp();
                }
                // Visual feedback for explosion
                for(let k=0; k<40; k++) {
                    const angle = Math.random() * Math.PI * 2;
                    const dist = Math.random() * explosionRadius;
                    particles.push({
                        x: player.x + Math.cos(angle) * dist, y: player.y + Math.sin(angle) * dist,
                        vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4,
                        life: 40, color: player.isRayDashing ? CONFIG.rayModeColor : player.color
                    });
                }
            } else {
                const dashSpeed = cellSize * (player.isRayDashing ? CONFIG.rayDashSpeed : CONFIG.playerDashSpeed);
                dx = Math.cos(player.dashAngle) * dashSpeed;
                dy = Math.sin(player.dashAngle) * dashSpeed;
                particles.push({ x: player.x, y: player.y, vx:0,vy:0, life:15, color: player.isRayDashing ? CONFIG.rayModeColor : player.color });

                if (CONFIG.playerDashIsDestructive) {
                    const nextX = player.x + dx;
                    const nextY = player.y + dy;
                    // ... (rest of destructive dash logic is unchanged)
                    const hitEnemies = enemies.filter(en => Math.hypot(nextX - en.x, nextY - en.y) < player.r + (en.size || player.r));
                    if (hitEnemies.length > 0) {
                        hitEnemies.forEach(en => {
                            player.xp += en.xpValue || CONFIG.xpPerEnemy;
                            for(let k=0;k<15;k++) particles.push({ x: en.x, y: en.y, vx:(Math.random()-.5)*6, vy:(Math.random()-.5)*6, life:30, color: en.color });
                        });
                        enemies = enemies.filter(en => !hitEnemies.includes(en));
                        if (player.pendingXP) { player.xp += player.pendingXP; player.pendingXP = 0; }
                        checkLevelUp();
                    }
                    const c = Math.floor(nextX / cellSize);
                    const r = Math.floor(nextY / cellSize);
                    const wallIdx = destWalls.findIndex(d => d.active && d.c === c && d.r === r);
                    if (wallIdx !== -1) {
                        destWalls[wallIdx].active = false;
                        grid[r][c] = 1;
                        for(let k=0;k<8;k++) particles.push({ x: (c + 0.5) * cellSize, y: (r + 0.5) * cellSize, vx:(Math.random()-.5)*5, vy:(Math.random()-.5)*5, life:20, color:'#ffff00' });
                    }
                }
            }
        } else {
            const speed = cellSize * CONFIG.playerSpeed;
            dx = (Math.abs(nexus.lx) > 0.1 ? nexus.lx : 0) * speed;
            dy = (Math.abs(nexus.ly) > 0.1 ? nexus.ly : 0) * speed;
        }    const checkCol = (x, y) => {
        const c = Math.floor(x/cellSize), r = Math.floor(y/cellSize);
        if(r<0||r>=ROWS||c<0||c>=COLS) return true;
        if(grid[r][c] === 0) return true; 
        if(destWalls.some(d => d.active && d.c === c && d.r === r)) return true;
        return false;
    };

    if(!checkCol(player.x + dx, player.y)) player.x += dx;
    if(!checkCol(player.x, player.y + dy)) player.y += dy;

    // --- WEAPONS ---
    const canFire = !player.isDashing && Math.hypot(nexus.rx, nexus.ry) > 0.5;
    
    if (player.isRayModeActive) {
        if (canFire && now - (player.lastShot||0) > CONFIG.rayFireRate) {
            const rayAngle = Math.atan2(nexus.ry, nexus.rx);
            player.lastShot = now;
            rays.push({ x: player.x, y: player.y, angle: rayAngle, life: CONFIG.rayLifetime });
            
            // Instant collision detection for the ray
            const hitEnemies = new Set();
            for (let dist = player.r; dist < w; dist += player.r) {
                const checkX = player.x + Math.cos(rayAngle) * dist;
                const checkY = player.y + Math.sin(rayAngle) * dist;
                if (checkCol(checkX, checkY)) break;
                enemies.forEach(en => {
                    if (Math.hypot(checkX - en.x, checkY - en.y) < (en.size || player.r) + CONFIG.rayWidth / 2) {
                        hitEnemies.add(en);
                    }
                });
            }
            
                if (hitEnemies.size > 0) {
                    enemies = enemies.filter(en => !hitEnemies.has(en));
                    hitEnemies.forEach(en => {
                        player.xp += en.xpValue || CONFIG.xpPerEnemy;
                        for(let k=0;k<15;k++) particles.push({ x: en.x, y: en.y, vx:(Math.random()-.5)*6, vy:(Math.random()-.5)*6, life:30, color: en.color });
                    });
                    if (player.pendingXP) { player.xp += player.pendingXP; player.pendingXP = 0; }
                    checkLevelUp();
                }
        }
    } else { // Normal bullets
        if (canFire && now - (player.lastShot||0) > CONFIG.playerFireRate) {
            const ang = Math.atan2(nexus.ry, nexus.rx);
            bullets.push({x: player.x, y: player.y, vx: Math.cos(ang)*10, vy: Math.sin(ang)*10});
            player.lastShot = now;
        }
    }

    // Balas
    bullets.forEach((b, i) => {
        b.x += b.vx; b.y += b.vy;
        const c = Math.floor(b.x/cellSize), r = Math.floor(b.y/cellSize);
        
        const wallIdx = destWalls.findIndex(d => d.active && d.c === c && d.r === r);
        if(wallIdx !== -1) {
            destWalls[wallIdx].active = false; grid[r][c] = 1; bullets.splice(i, 1);
            for(let k=0;k<8;k++) particles.push({ x: b.x, y: b.y, vx:(Math.random()-.5)*5, vy:(Math.random()-.5)*5, life:20, color:'#ffff00' });
        } else if (checkCol(b.x, b.y)) { 
            bullets.splice(i, 1);
        } else {
            enemies.forEach((en, j) => {
                if (Math.hypot(b.x - en.x, b.y - en.y) < (en.size || player.r)) {
                    player.xp += en.xpValue || CONFIG.xpPerEnemy;
                    if (player.pendingXP) { player.xp += player.pendingXP; player.pendingXP = 0; }
                    checkLevelUp();
                    enemies.splice(j, 1);
                    bullets.splice(i, 1);
                    for(let k=0;k<15;k++) particles.push({ x: b.x, y: b.y, vx:(Math.random()-.5)*6, vy:(Math.random()-.5)*6, life:30, color: en.color });
                }
            });
        }
    });

    // Update rays (visual only)
    rays.forEach((r, i) => {
        r.life--;
        if (r.life <= 0) rays.splice(i, 1);
    });

    // Spawner
    if(now - lastSpawn > spawnRate && enemies.length < CONFIG.maxEnemies) {
        const spawnPoint = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
        const speedVar = 1 - (CONFIG.enemySpeedVariation/2) + Math.random() * CONFIG.enemySpeedVariation;
        const sizeVar = 1 - (CONFIG.enemySizeVariation/2) + Math.random() * CONFIG.enemySizeVariation;
        
        enemies.push({
             x: spawnPoint.c * cellSize + cellSize / 2,
             y: spawnPoint.r * cellSize + cellSize / 2,
             path: [], 
             speed: (CONFIG.enemyBaseSpeed + (level * CONFIG.enemySpeedLevelScale)) * speedVar,
             size: player.r * sizeVar,
             color: '#ff0055', 
             tick: 0,
             accuracy: CONFIG.enemyMinAccuracy + Math.random() * CONFIG.enemyAccuracyVariation,
             xpValue: CONFIG.xpPerEnemy
        });
        lastSpawn = now;
        if(spawnRate > CONFIG.minSpawnRate) spawnRate *= CONFIG.spawnRateDecay;
    }

    // IA
    enemies.forEach(enemy => {
        if(!enemy.path.length || (enemy.tick++ % CONFIG.aiUpdateTicks === 0)) { 
            let targetX = player.x; let targetY = player.y;
            if (Math.random() > enemy.accuracy) {
                targetX += (Math.random() - 0.5) * CONFIG.aiTargetingFuzz * cellSize;
                targetY += (Math.random() - 0.5) * CONFIG.aiTargetingFuzz * cellSize;
            }
            enemy.path = getPath(enemy.x, enemy.y, targetX, targetY);
            enemy.tick = 1 + Math.floor(Math.random() * CONFIG.aiUpdateStagger);
        }

        if(enemy.path.length) {
            const next = enemy.path[0];
            const tx = next.c * cellSize + cellSize/2, ty = next.r * cellSize + cellSize/2;
            const ang = Math.atan2(ty - enemy.y, tx - enemy.x);
            enemy.x += Math.cos(ang) * enemy.speed, enemy.y += Math.sin(ang) * enemy.speed;
            if(Math.hypot(tx-enemy.x, ty-enemy.y) < enemy.speed) enemy.path.shift();
        }
    });

    // Win/Lose
    const pc = Math.floor(player.x/cellSize), pr = Math.floor(player.y/cellSize);
    if(pc >= goal.c && pc <= goal.c + 1 && pr >= goal.r && pr <= goal.r + 1) {
        if (gameState !== 'win') {
            player.pendingXP = (player.pendingXP || 0) + CONFIG.xpPerStage;
        }
        gameState = 'win';
    }
    if(enemies.some(en => Math.hypot(player.x-en.x, player.y-en.y) < player.r + (en.size || player.r))) gameState = 'gameover';
    
    lastNexus = { ...nexus };
}

// ==========================================
// 6. DRAW LOOP
// ==========================================
function draw() {
    requestAnimationFrame(draw);
    update();

    // 1. Fondo Pre-renderizado
    ctx.drawImage(mazeCanvas, 0, 0);

    // 2. Paredes Destruibles
    ctx.strokeStyle = '#ffcc00'; ctx.lineWidth = 2; ctx.shadowBlur = 10; ctx.shadowColor = '#ffcc00';
    destWalls.forEach(d => {
        if(d.active) {
            const x = d.c*cellSize, y = d.r*cellSize;
            ctx.strokeRect(x+4, y+4, cellSize-8, cellSize-8);
        }
    });
    ctx.shadowBlur = 0;

    // 3. Meta
    const gx = goal.c*cellSize, gy = goal.r*cellSize;
    ctx.fillStyle = `rgba(0, 255, 0, ${0.3 + Math.sin(Date.now()/200)*0.2})`;
    ctx.fillRect(gx, gy, cellSize * 2, cellSize * 2);

    // 4. Jugador
    const pColor = player.isRayModeActive ? CONFIG.rayModeColor : player.color;
    ctx.shadowBlur = player.isRayDashing ? 35 : 15; 
    ctx.shadowColor = pColor; 
    ctx.fillStyle = pColor;
    ctx.beginPath(); ctx.arc(player.x, player.y, player.r, 0, Math.PI*2); ctx.fill();

    // 4.5 Rays
    rays.forEach(r => {
        const rayEndX = r.x + Math.cos(r.angle) * w;
        const rayEndY = r.y + Math.sin(r.angle) * h;
        const life = r.life / CONFIG.rayLifetime;

        ctx.strokeStyle = CONFIG.rayColor;
        ctx.globalAlpha = life;
        ctx.lineWidth = CONFIG.rayWidth * life;
        ctx.shadowBlur = 20;
        ctx.shadowColor = CONFIG.rayModeColor;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(r.x, r.y);
        ctx.lineTo(rayEndX, rayEndY);
        ctx.stroke();
    });
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.lineCap = 'butt';

    // 5. Enemigos
    enemies.forEach(enemy => {
        const enSize = enemy.size || player.r;
        ctx.shadowColor = enemy.color; ctx.fillStyle = enemy.color;
        ctx.beginPath(); 
        ctx.moveTo(enemy.x, enemy.y - enSize);
        ctx.lineTo(enemy.x + enSize, enemy.y + enSize);
        ctx.lineTo(enemy.x - enSize, enemy.y + enSize);
        ctx.fill();
    });
    ctx.shadowBlur = 0;

    // 6. Extras
    ctx.fillStyle = '#fff';
    bullets.forEach(b => { ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI*2); ctx.fill(); });
    
    particles.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy; p.life--;
        ctx.fillStyle = p.color; ctx.globalAlpha = p.life/30;
        ctx.fillRect(p.x, p.y, 3, 3);
        if(p.life<=0) particles.splice(i,1);
    });
    ctx.globalAlpha = 1;

    // --- UI ---
    const now = Date.now();
    ctx.textAlign = 'center';
    ctx.shadowColor = '#000'; ctx.shadowBlur = 7;

    // XP Bar (Bottom) - ENLARGED
    const xpBar = { w: 600, h: 30, y: h - 80 };
    ctx.fillStyle = 'rgba(80,80,80,0.7)';
    ctx.fillRect(w/2 - xpBar.w/2, xpBar.y, xpBar.w, xpBar.h);
    const xpPercent = player.xp / player.xpToNextLevel;
    ctx.fillStyle = player.color;
    ctx.fillRect(w/2 - xpBar.w/2, xpBar.y, xpBar.w * xpPercent, xpBar.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    ctx.strokeRect(w/2 - xpBar.w/2, xpBar.y, xpBar.w, xpBar.h);
    ctx.lineWidth = 1;
    
    // Level Text (Bottom) - ENLARGED
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 32px Segoe UI';
    ctx.fillText(`LVL ${player.level}`, w/2, h - 45);
    
    // Skill Indicators - ENLARGED
    const skillBoxSize = { w: 100, h: 80 };
    const emojiFontSize = '50px';

    // Dash (Left)
    const dashCooldown = now - player.lastDash;
    const dashReady = dashCooldown > CONFIG.playerDashCooldown;
    ctx.fillStyle = dashReady ? 'rgba(0,255,255,0.8)' : 'rgba(80,80,80,0.7)';
    ctx.fillRect(40, h - (skillBoxSize.h + 40), skillBoxSize.w, skillBoxSize.h);
    ctx.font = emojiFontSize;
    ctx.fillText("💨", 40 + skillBoxSize.w/2, h - (skillBoxSize.h/2) - 25);
    if(!dashReady) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        const cooldownPercent = dashCooldown / CONFIG.playerDashCooldown;
        ctx.fillRect(40, h - (skillBoxSize.h + 40), skillBoxSize.w, skillBoxSize.h * (1-cooldownPercent));
    }
    
    // Ray Mode Indicator (Right)
    if (player.level >= CONFIG.rayUnlockLevel) {
        ctx.fillStyle = player.isRayModeActive ? CONFIG.rayModeColor : 'rgba(80,80,80,0.7)';
        ctx.fillRect(w - (skillBoxSize.w + 40), h - (skillBoxSize.h + 40), skillBoxSize.w, skillBoxSize.h);
        ctx.font = emojiFontSize;
        ctx.fillText("🔥", w - (skillBoxSize.w/2 + 40), h - (skillBoxSize.h/2) - 25);
    }
    
    // --- LEVEL UP NOTIFICATION ---
    if (player.levelUpGlow > 0) {
        const glowAlpha = Math.sin((1 - (player.levelUpGlow / 150)) * Math.PI);
        ctx.fillStyle = `rgba(255, 255, 150, ${glowAlpha * 0.9})`;
        ctx.font = 'bold 80px Segoe UI';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#ffff00';
        ctx.shadowBlur = 30;
        ctx.fillText("LEVEL UP!", w/2, h/2 + 30);
        player.levelUpGlow--;
    }

    ctx.shadowBlur = 0;

    // --- OVERLAYS ---
    if(gameState !== 'playing') {
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(0, h/2 - 60, w, 120);
        ctx.textAlign = 'center';
        ctx.font = 'bold 40px Segoe UI';

        if (gameState === 'paused') {
            ctx.fillStyle = '#fff';
            ctx.fillText("PAUSED", w/2, h/2 -10);
            ctx.font = '20px Segoe UI';
            ctx.fillText("PRESS START TO RESUME", w/2, h/2 + 30);

        } else {
            ctx.fillStyle = gameState === 'win' ? '#0f0' : '#f00';
            ctx.fillText(gameState === 'win' ? "STAGE CLEARED" : "SYSTEM FAILURE", w/2, h/2 -10);
            ctx.font = '20px Segoe UI';
            ctx.fillStyle = '#fff';
            ctx.fillText("PRESS START", w/2, h/2 + 30);
        }
    }
}

// ARRANQUE
window.addEventListener('resize', initLevel);
initLevel();
draw();
