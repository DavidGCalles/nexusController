// entities.js

// Configuración de Entidades
const ENTITY_CONFIG = {
    PLAYER_SPEED: 4.5,
    PLAYER_RADIUS: 12, 
    
    // Dash Mechanics
    DASH_SPEED_MULT: 3.0, 
    DASH_DURATION: 12,    
    DASH_COST: 25,        
    
    // Stats
    MAX_ENERGY: 100,
    ENERGY_REGEN: 0.8,
    
    // Disparo
    SHOT_COST: 10,
    SHOT_COOLDOWN: 8, // Frames entre disparos
    BULLET_SPEED: 14,
    BULLET_RADIUS: 4
};

class Bullet {
    constructor(x, y, angle, ownerId, color) {
        this.x = x;
        this.y = y;
        this.vx = Math.cos(angle) * ENTITY_CONFIG.BULLET_SPEED;
        this.vy = Math.sin(angle) * ENTITY_CONFIG.BULLET_SPEED;
        this.ownerId = ownerId;
        this.color = color;
        this.alive = true;
    }

    update(grid, w, h) {
        this.x += this.vx;
        this.y += this.vy;

        // Check Limites Pantalla
        if (this.x < 0 || this.x > w || this.y < 0 || this.y > h) {
            this.alive = false;
            return;
        }

        // Check Muros
        const hit = grid.checkProjectileHit(this.x, this.y);
        if (hit) {
            this.alive = false;
            // Aquí podríamos añadir partículas si hit === 'DESTROYED_WALL'
        }
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, ENTITY_CONFIG.BULLET_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

class Player {
    constructor(id, x, y, color) {
        this.id = id;       
        this.x = x;
        this.y = y;
        this.color = color;
        this.radius = ENTITY_CONFIG.PLAYER_RADIUS;
        this.angle = 0; 

        // Estado interno
        this.energy = ENTITY_CONFIG.MAX_ENERGY;
        this.shotCooldown = 0;

        // Dash
        this.isDashing = false;
        this.dashFrame = 0;      
        this.dashVector = { x: 0, y: 0 }; 
    }

    // AHORA RECIBE EL ARRAY DE BALAS PARA DISPARAR
    update(grid, w, h, bullets) {
        const pad = window.getController(this.id);
        if (!pad) return; 

        // 1. Energía y Cooldowns
        if (this.shotCooldown > 0) this.shotCooldown--;

        if (!this.isDashing && this.energy < ENTITY_CONFIG.MAX_ENERGY) {
            this.energy = Math.min(ENTITY_CONFIG.MAX_ENERGY, this.energy + ENTITY_CONFIG.ENERGY_REGEN);
        }

        // 2. DISPARO (RT)
        // Usamos axes.rt porque es un gatillo analógico (0.0 a 1.0)
        if (pad.axes.rt > 0.5 && this.shotCooldown <= 0 && this.energy >= ENTITY_CONFIG.SHOT_COST) {
            this.shoot(bullets);
        }

        // 3. Dash (LT o Botón Sur)
        const dashPressed = (pad.axes.lt > 0.5) || pad.buttons.south;
        if (dashPressed && !this.isDashing && this.energy >= ENTITY_CONFIG.DASH_COST) {
            this.startDash(pad);
        }

        // 4. Movimiento
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

        // 5. Orientación
        const aimX = Math.abs(pad.axes.rx) > 0.1 ? pad.axes.rx : 0;
        const aimY = Math.abs(pad.axes.ry) > 0.1 ? -pad.axes.ry : 0;

        if (aimX !== 0 || aimY !== 0) {
            this.angle = Math.atan2(aimY, aimX);
        } else if (dx !== 0 || dy !== 0) {
            this.angle = Math.atan2(dy, dx);
        }

        // 6. Colisiones Físicas
        if (!grid.checkCollision(this.x + dx, this.y, this.radius)) this.x += dx;
        if (!grid.checkCollision(this.x, this.y + dy, this.radius)) this.y += dy;

        // 7. Límites
        this.x = Math.max(this.radius, Math.min(w - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(h - this.radius, this.y));
    }

    shoot(bullets) {
        this.energy -= ENTITY_CONFIG.SHOT_COST;
        this.shotCooldown = ENTITY_CONFIG.SHOT_COOLDOWN;
        
        // La bala sale desde la "punta" de la flecha
        const tipX = this.x + Math.cos(this.angle) * (this.radius + 5);
        const tipY = this.y + Math.sin(this.angle) * (this.radius + 5);

        bullets.push(new Bullet(tipX, tipY, this.angle, this.id, this.color));
    }

    startDash(pad) {
        let dirX = pad.axes.lx;
        let dirY = -pad.axes.ly; 

        if (Math.abs(dirX) < 0.1 && Math.abs(dirY) < 0.1) {
            dirX = Math.cos(this.angle);
            dirY = Math.sin(this.angle);
        }

        const len = Math.hypot(dirX, dirY);
        this.dashVector = { x: dirX / len, y: dirY / len };

        this.isDashing = true;
        this.dashFrame = ENTITY_CONFIG.DASH_DURATION;
        this.energy -= ENTITY_CONFIG.DASH_COST;
    }

    endDash() {
        this.isDashing = false;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle); 

        ctx.beginPath();
        ctx.moveTo(this.radius, 0);
        ctx.lineTo(-this.radius, this.radius * 0.8);
        ctx.lineTo(-this.radius * 0.4, 0);
        ctx.lineTo(-this.radius, -this.radius * 0.8);
        ctx.closePath();

        ctx.fillStyle = this.color;
        if (this.isDashing) {
            ctx.shadowColor = this.color;
            ctx.shadowBlur = 25;
        } else {
            ctx.shadowBlur = 8;
            ctx.shadowColor = this.color;
        }
        ctx.fill();
        ctx.restore(); 

        this.drawUI(ctx);
    }

    drawUI(ctx) {
        const w = 30;
        const h = 4;
        const x = this.x - w / 2;
        const y = this.y + this.radius + 10; 

        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(x, y, w, h);

        const energyPct = this.energy / ENTITY_CONFIG.MAX_ENERGY;
        // Indicador visual: Si puedes disparar, verde, si no, gris
        // (Ojo, priorizamos Dash en la UI, pero podrías cambiarlo)
        ctx.fillStyle = this.energy >= ENTITY_CONFIG.SHOT_COST ? '#00ffff' : '#ff0000'; 
        ctx.fillRect(x, y, w * energyPct, h);
    }
}