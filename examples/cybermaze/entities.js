// entities.js

// 1. DEFINIMOS RATIOS (Proporción respecto al tamaño de una celda)
const ENTITY_RATIOS = {
    PLAYER_SPEED: 0.015,      // ~4.5px en tile de 30px
    PLAYER_RADIUS: 0.35,     // ~10.5px (Total ancho 70% del pasillo)
    
    BULLET_SPEED: 0.5,       // Rápido
    BULLET_RADIUS: 0.12,     
    
    ENEMY_SPEED: 0.009,       
    ENEMY_VISION: 12.0,      // Ve 12 celdas de distancia (en lugar de 400px fijos)
    
    // UI Scaling
    UI_BAR_WIDTH: 0.8,       // 80% del ancho del bicho
    UI_BAR_HEIGHT: 0.1,
    UI_OFFSET: 0.5           // Altura sobre la cabeza
};

// 2. CONFIGURACIÓN DE JUEGO (Se rellenará dinámicamente)
const ENTITY_CONFIG = {
    // Valores por defecto (se sobreescriben al iniciar)
    PLAYER_HP: 100,
    DASH_SPEED_MULT: 3.0,
    DASH_DURATION: 12,
    DASH_COST: 25,
    MAX_ENERGY: 100,
    ENERGY_REGEN: 0.8,
    SHOT_COST: 10,
    SHOT_COOLDOWN: 8,
    BULLET_DAMAGE: 25,
    ENEMY_FIRE_RATE: 60, // Ajustado a frames
    
    // Aquí se inyectarán los valores calculados:
    // PLAYER_SPEED, PLAYER_RADIUS, etc...
    // ENEMY_HEARING_RANGE...
};

// 3. FUNCIÓN DE ESCALADO (La llamaremos desde main.js)
function updateEntityScale(cellSize) {
    console.log(`⚖️ Recalculando físicas para celda de ${cellSize.toFixed(1)}px`);
    
    ENTITY_CONFIG.PLAYER_SPEED = cellSize * ENTITY_RATIOS.PLAYER_SPEED;
    ENTITY_CONFIG.PLAYER_RADIUS = cellSize * ENTITY_RATIOS.PLAYER_RADIUS;
    
    ENTITY_CONFIG.BULLET_SPEED = cellSize * ENTITY_RATIOS.BULLET_SPEED;
    ENTITY_CONFIG.BULLET_RADIUS = cellSize * ENTITY_RATIOS.BULLET_RADIUS;
    
    ENTITY_CONFIG.ENEMY_SPEED = cellSize * ENTITY_RATIOS.ENEMY_SPEED;
    ENTITY_CONFIG.ENEMY_VISION = cellSize * ENTITY_RATIOS.ENEMY_VISION;
    ENTITY_CONFIG.ENEMY_HEARING_RANGE = cellSize * 15.0; // Oye 15 celdas

    // Guardamos métricas de UI para uso en draw()
    ENTITY_CONFIG.UI_W = cellSize * ENTITY_RATIOS.UI_BAR_WIDTH;
    ENTITY_CONFIG.UI_H = cellSize * ENTITY_RATIOS.UI_BAR_HEIGHT;
    ENTITY_CONFIG.UI_Y_OFFSET = cellSize * ENTITY_RATIOS.UI_OFFSET;
}

// --- CLASES (Actualizadas para usar config dinámico) ---

class Bullet {
    constructor(x, y, angle, ownerId, color) {
        this.x = x;
        this.y = y;
        // Usamos el valor recalculado
        this.vx = Math.cos(angle) * ENTITY_CONFIG.BULLET_SPEED;
        this.vy = Math.sin(angle) * ENTITY_CONFIG.BULLET_SPEED;
        this.ownerId = ownerId;
        this.color = color;
        this.alive = true;
    }

    update(grid, w, h) {
        this.x += this.vx;
        this.y += this.vy;

        if (this.x < 0 || this.x > w || this.y < 0 || this.y > h) {
            this.alive = false;
            return;
        }

        const hit = grid.checkProjectileHit(this.x, this.y);
        if (hit) this.alive = false;
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        // Radio dinámico
        ctx.arc(this.x, this.y, ENTITY_CONFIG.BULLET_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

class Enemy {
    constructor(type, x, y) {
        this.type = type;
        this.x = x;
        this.y = y;
        this.alive = true;
        // Radio dinámico (ahora cabe en los pasillos)
        this.radius = ENTITY_CONFIG.PLAYER_RADIUS; // Mismo tamaño que jugador aprox

        if (type === 'square') {
            this.hp = this.maxHp = 100;
            this.speed = ENTITY_CONFIG.ENEMY_SPEED * 0.8;
            this.color = '#ff0055';
        } else if (type === 'circle') {
            this.hp = this.maxHp = 50;
            this.speed = ENTITY_CONFIG.ENEMY_SPEED * 1.3;
            this.color = '#ff9900';
        } else if (type === 'diamond') {
            this.hp = this.maxHp = 60;
            this.speed = ENTITY_CONFIG.ENEMY_SPEED * 0.9;
            this.color = '#cc00ff';
            this.shootTimer = 0;
        }
    }

    update(grid, players, bullets, w, h) {
        // ... (Lógica de IA mantenida igual, solo cambia la velocidad)
        
        // Ejemplo de uso de visión escalada
        let target = null;
        let minDist = Infinity;
        players.forEach(p => {
            if (!p.isDead) {
                const dist = Math.hypot(p.x - this.x, p.y - this.y);
                if (dist < minDist) {
                    minDist = dist;
                    target = p;
                }
            }
        });

        if (target && minDist < ENTITY_CONFIG.ENEMY_VISION) {
             // ... Lógica de persecución ...
             const dx = target.x - this.x;
             const dy = target.y - this.y;
             const angle = Math.atan2(dy, dx);
             const mx = Math.cos(angle) * this.speed;
             const my = Math.sin(angle) * this.speed;
             
             if (!grid.checkCollision(this.x + mx, this.y, this.radius)) this.x += mx;
             if (!grid.checkCollision(this.x, this.y + my, this.radius)) this.y += my;

             // ... Disparo Diamond ...
             if (this.type === 'diamond') {
                 if (this.shootTimer > 0) this.shootTimer--;
                 if (this.shootTimer <= 0) {
                     this.shoot(bullets, angle);
                 }
             }
        }
    }

    shoot(bullets, angle) {
        this.shootTimer = ENTITY_CONFIG.ENEMY_FIRE_RATE;
        bullets.push(new Bullet(this.x, this.y, angle, 'enemy', this.color));
    }

    takeDamage(amount) {
        this.hp -= amount;
        if (this.hp <= 0) this.alive = false;
    }

    draw(ctx) {
        // ... (Lógica de dibujo igual, usando this.radius escalado)
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 10;

        ctx.beginPath();
        if (this.type === 'circle') {
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        } else if (this.type === 'square') {
            ctx.rect(this.x - this.radius, this.y - this.radius, this.radius*2, this.radius*2);
        } else if (this.type === 'diamond') {
            const r = this.radius * 1.2;
            ctx.moveTo(this.x, this.y - r);
            ctx.lineTo(this.x + r, this.y);
            ctx.lineTo(this.x, this.y + r);
            ctx.lineTo(this.x - r, this.y);
        }
        ctx.fill();
        ctx.shadowBlur = 0;

        this.drawUI(ctx);
    }

    drawUI(ctx) {
        // UI Escalada
        const w = ENTITY_CONFIG.UI_W;
        const h = ENTITY_CONFIG.UI_H;
        const x = this.x - w / 2;
        const y = this.y - this.radius - ENTITY_CONFIG.UI_Y_OFFSET;

        ctx.fillStyle = '#330000';
        ctx.fillRect(x, y, w, h);
        const hpPct = Math.max(0, this.hp / this.maxHp);
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(x, y, w * hpPct, h);
    }
}

class Player {
    constructor(id, x, y, color) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.color = color;
        // Radio recalculado
        this.radius = ENTITY_CONFIG.PLAYER_RADIUS; 
        
        this.angle = 0;
        this.hp = ENTITY_CONFIG.PLAYER_HP;
        this.maxHp = ENTITY_CONFIG.PLAYER_HP;
        this.energy = ENTITY_CONFIG.MAX_ENERGY;
        this.isDead = false;
        this.shotCooldown = 0;
        this.isDashing = false;
        this.dashFrame = 0;
        this.dashVector = { x: 0, y: 0 };
    }

    update(grid, w, h, bullets) {
        if (this.isDead) return;
        const pad = window.getController(this.id);
        if (!pad) return;

        // ... (Regeneración y disparo igual) ...
        if (this.shotCooldown > 0) this.shotCooldown--;
        if (!this.isDashing && this.energy < ENTITY_CONFIG.MAX_ENERGY) {
            this.energy = Math.min(ENTITY_CONFIG.MAX_ENERGY, this.energy + ENTITY_CONFIG.ENERGY_REGEN);
        }
        if (pad.axes.rt > 0.5 && this.shotCooldown <= 0 && this.energy >= ENTITY_CONFIG.SHOT_COST) {
            this.shoot(bullets);
        }
        
        // Dash
        const dashPressed = (pad.axes.lt > 0.5) || pad.buttons.south;
        if (dashPressed && !this.isDashing && this.energy >= ENTITY_CONFIG.DASH_COST) {
            this.startDash(pad);
        }

        // Movimiento (Velocidad ESCALADA)
        let dx = 0, dy = 0;
        const rawLx = Math.abs(pad.axes.lx) > 0.1 ? pad.axes.lx : 0;
        const rawLy = Math.abs(pad.axes.ly) > 0.1 ? -pad.axes.ly : 0;

        if (this.isDashing) {
            const speed = ENTITY_CONFIG.PLAYER_SPEED * ENTITY_CONFIG.DASH_SPEED_MULT;
            dx = this.dashVector.x * speed;
            dy = this.dashVector.y * speed;
            this.dashFrame--;
            if (this.dashFrame <= 0) this.endDash();
        } else {
            dx = rawLx * ENTITY_CONFIG.PLAYER_SPEED;
            dy = rawLy * ENTITY_CONFIG.PLAYER_SPEED;
        }

        // ... (Resto de update, colisiones y límites igual) ...
        // Apuntado
        const aimX = Math.abs(pad.axes.rx) > 0.1 ? pad.axes.rx : 0;
        const aimY = Math.abs(pad.axes.ry) > 0.1 ? -pad.axes.ry : 0;
        if (aimX !== 0 || aimY !== 0) {
            this.angle = Math.atan2(aimY, aimX);
        } else if (dx !== 0 || dy !== 0) {
            this.angle = Math.atan2(dy, dx);
        }

        if (!grid.checkCollision(this.x + dx, this.y, this.radius)) this.x += dx;
        if (!grid.checkCollision(this.x, this.y + dy, this.radius)) this.y += dy;

        this.x = Math.max(this.radius, Math.min(w - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(h - this.radius, this.y));
    }
    
    // ... Métodos auxiliares (shoot, startDash, etc) se mantienen ...
    shoot(bullets) {
        this.energy -= ENTITY_CONFIG.SHOT_COST;
        this.shotCooldown = ENTITY_CONFIG.SHOT_COOLDOWN;
        const tipX = this.x + Math.cos(this.angle) * (this.radius * 1.5);
        const tipY = this.y + Math.sin(this.angle) * (this.radius * 1.5);
        bullets.push(new Bullet(tipX, tipY, this.angle, this.id, this.color));
    }
    
    takeDamage(amount) {
        // Mecánica: Si estás haciendo Dash, eres invulnerable (opcional, pero táctico)
        if (this.isDashing) return; 

        this.hp -= amount;
        
        if (this.hp <= 0) {
            this.hp = 0;
            this.isDead = true;
            // TODO: Aquí conectaríamos con un sistema de partículas o sonido de muerte
            console.log(`💀 Player ${this.id} ELIMINADO`);
        }
    }

    startDash(pad) {
        let dirX = pad.axes.lx;
        let dirY = -pad.axes.ly; 
        if (Math.abs(dirX) < 0.1 && Math.abs(dirY) < 0.1) {
            dirX = Math.cos(this.angle);
            dirY = Math.sin(this.angle);
        }
        const len = Math.hypot(dirX, dirY);
        // Evitar división por cero
        if (len > 0.01) {
             this.dashVector = { x: dirX / len, y: dirY / len };
        } else {
             this.dashVector = { x: 1, y: 0 };
        }
        this.isDashing = true;
        this.dashFrame = ENTITY_CONFIG.DASH_DURATION;
        this.energy -= ENTITY_CONFIG.DASH_COST;
    }

    endDash() {
        this.isDashing = false;
    }

    draw(ctx) {
         if (this.isDead) return;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle); 
        ctx.beginPath();
        // Dibujo relativo al radio escalado
        ctx.moveTo(this.radius, 0);
        ctx.lineTo(-this.radius, this.radius * 0.8);
        ctx.lineTo(-this.radius * 0.4, 0);
        ctx.lineTo(-this.radius, -this.radius * 0.8);
        ctx.closePath();
        ctx.fillStyle = this.color;
        ctx.shadowBlur = this.isDashing ? 25 : 8;
        ctx.shadowColor = this.color;
        ctx.fill();
        ctx.restore(); 
        this.drawUI(ctx);
    }

    drawUI(ctx) {
        // UI Escalada
        const w = ENTITY_CONFIG.UI_W;
        const h = ENTITY_CONFIG.UI_H;
        const x = this.x - w / 2;
        const yHp = this.y + this.radius + ENTITY_CONFIG.UI_Y_OFFSET;
        
        ctx.fillStyle = '#003300';
        ctx.fillRect(x, yHp, w, h);
        const hpPct = this.hp / this.maxHp;
        ctx.fillStyle = hpPct > 0.3 ? '#00ff00' : '#ff3300';
        ctx.fillRect(x, yHp, w * hpPct, h);

        const yEnergy = yHp + h + 2; // +2px gap (aceptable fijo)
        ctx.fillStyle = '#003333';
        ctx.fillRect(x, yEnergy, w, h);
        const energyPct = this.energy / ENTITY_CONFIG.MAX_ENERGY;
        ctx.fillStyle = this.energy >= ENTITY_CONFIG.SHOT_COST ? '#00ffff' : '#555'; 
        ctx.fillRect(x, yEnergy, w * energyPct, h);
    }
}