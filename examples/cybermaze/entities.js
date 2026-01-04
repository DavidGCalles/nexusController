// entities.js

const ENTITY_CONFIG = {
    // JUGADOR
    PLAYER_SPEED: 4.5,
    PLAYER_RADIUS: 12, 
    PLAYER_HP: 100, // Vida Máxima
    
    // DASH
    DASH_SPEED_MULT: 3.0, 
    DASH_DURATION: 12,    
    DASH_COST: 25,        
    
    // ESTADÍSTICAS
    MAX_ENERGY: 100,
    ENERGY_REGEN: 0.8,
    
    // DISPARO JUGADOR
    SHOT_COST: 2,
    SHOT_COOLDOWN: 8, 
    BULLET_SPEED: 14,
    BULLET_RADIUS: 4,
    BULLET_DAMAGE: 25, // Daño que hace el jugador

    // ENEMIGOS
    ENEMY_SPEED: 2.5,
    ENEMY_VISION: 400, // Distancia a la que te ven
    ENEMY_FIRE_RATE: 60, // Frames entre disparos del Diamante
};

class Bullet {
    constructor(x, y, angle, ownerId, color) {
        this.x = x;
        this.y = y;
        this.vx = Math.cos(angle) * ENTITY_CONFIG.BULLET_SPEED;
        this.vy = Math.sin(angle) * ENTITY_CONFIG.BULLET_SPEED;
        this.ownerId = ownerId; // ID jugador o 'enemy'
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
        ctx.arc(this.x, this.y, ENTITY_CONFIG.BULLET_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

class Enemy {
    constructor(type, x, y) {
        this.type = type; // 'circle', 'square', 'diamond'
        this.x = x;
        this.y = y;
        this.radius = 14;
        this.alive = true;
        
        // Configuración según tipo
        if (type === 'square') {
            this.hp = 100;
            this.maxHp = 100;
            this.speed = ENTITY_CONFIG.ENEMY_SPEED * 0.8; // Lento y duro
            this.color = '#ff0055'; // Rojo
        } else if (type === 'circle') {
            this.hp = 50;
            this.maxHp = 50;
            this.speed = ENTITY_CONFIG.ENEMY_SPEED * 1.2; // Rápido y débil
            this.color = '#ff9900'; // Naranja
        } else if (type === 'diamond') {
            this.hp = 60;
            this.maxHp = 60;
            this.speed = ENTITY_CONFIG.ENEMY_SPEED * 0.9;
            this.color = '#cc00ff'; // Púrpura
            this.shootTimer = 0;
        }
    }

    update(grid, players, bullets, w, h) {
        // 1. Buscar objetivo más cercano
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

        if (!target) return; // Nadie a quien matar

        // 2. IA Básica
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const angle = Math.atan2(dy, dx);

        // Movimiento (si está en rango visual o si es melee siempre te busca)
        if (minDist < ENTITY_CONFIG.ENEMY_VISION || this.hp < this.maxHp) {
            
            // Diamante: Intenta mantener distancia para disparar
            if (this.type === 'diamond' && minDist < 200) {
                // Se queda quieto o retrocede un poco (opcional)
            } else {
                // Perseguir
                const mx = Math.cos(angle) * this.speed;
                const my = Math.sin(angle) * this.speed;

                if (!grid.checkCollision(this.x + mx, this.y, this.radius)) this.x += mx;
                if (!grid.checkCollision(this.x, this.y + my, this.radius)) this.y += my;
            }

            // Disparo (Solo Diamante)
            if (this.type === 'diamond') {
                if (this.shootTimer > 0) this.shootTimer--;
                // Dispara si tiene línea de visión (simple check de distancia por ahora)
                if (this.shootTimer <= 0 && minDist < 400) {
                    this.shoot(bullets, angle);
                }
            }
        }
    }

    shoot(bullets, angle) {
        this.shootTimer = ENTITY_CONFIG.ENEMY_FIRE_RATE;
        // La bala enemiga tiene ownerId = 'enemy'
        bullets.push(new Bullet(this.x, this.y, angle, 'enemy', this.color));
    }

    takeDamage(amount) {
        this.hp -= amount;
        if (this.hp <= 0) this.alive = false;
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 10;

        ctx.beginPath();
        if (this.type === 'circle') {
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        } else if (this.type === 'square') {
            ctx.rect(this.x - this.radius, this.y - this.radius, this.radius*2, this.radius*2);
        } else if (this.type === 'diamond') {
            ctx.moveTo(this.x, this.y - this.radius * 1.2); // Arriba
            ctx.lineTo(this.x + this.radius * 1.2, this.y); // Derecha
            ctx.lineTo(this.x, this.y + this.radius * 1.2); // Abajo
            ctx.lineTo(this.x - this.radius * 1.2, this.y); // Izquierda
        }
        ctx.fill();
        ctx.shadowBlur = 0;

        this.drawUI(ctx);
    }

    drawUI(ctx) {
        // Barra de Vida Enemigo (Solo roja)
        const w = 24;
        const h = 4;
        const x = this.x - w / 2;
        const y = this.y - this.radius - 10;

        ctx.fillStyle = '#330000'; // Fondo rojo oscuro
        ctx.fillRect(x, y, w, h);

        const hpPct = Math.max(0, this.hp / this.maxHp);
        ctx.fillStyle = '#ff0000'; // Vida Roja
        ctx.fillRect(x, y, w * hpPct, h);
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

        // HP & Energy
        this.hp = ENTITY_CONFIG.PLAYER_HP;
        this.maxHp = ENTITY_CONFIG.PLAYER_HP;
        this.energy = ENTITY_CONFIG.MAX_ENERGY;
        
        this.isDead = false;
        this.shotCooldown = 0;

        // Dash
        this.isDashing = false;
        this.dashFrame = 0;      
        this.dashVector = { x: 0, y: 0 }; 
    }

    update(grid, w, h, bullets) {
        if (this.isDead) return;

        const pad = window.getController(this.id);
        if (!pad) return; 

        // Regenerar Energía
        if (this.shotCooldown > 0) this.shotCooldown--;
        if (!this.isDashing && this.energy < ENTITY_CONFIG.MAX_ENERGY) {
            this.energy = Math.min(ENTITY_CONFIG.MAX_ENERGY, this.energy + ENTITY_CONFIG.ENERGY_REGEN);
        }

        // Disparo
        if (pad.axes.rt > 0.5 && this.shotCooldown <= 0 && this.energy >= ENTITY_CONFIG.SHOT_COST) {
            this.shoot(bullets);
        }

        // Dash
        const dashPressed = (pad.axes.lt > 0.5) || pad.buttons.south;
        if (dashPressed && !this.isDashing && this.energy >= ENTITY_CONFIG.DASH_COST) {
            this.startDash(pad);
        }

        // Movimiento
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

        // Apuntado
        const aimX = Math.abs(pad.axes.rx) > 0.1 ? pad.axes.rx : 0;
        const aimY = Math.abs(pad.axes.ry) > 0.1 ? -pad.axes.ry : 0;

        if (aimX !== 0 || aimY !== 0) {
            this.angle = Math.atan2(aimY, aimX);
        } else if (dx !== 0 || dy !== 0) {
            this.angle = Math.atan2(dy, dx);
        }

        // Colisiones Entorno
        if (!grid.checkCollision(this.x + dx, this.y, this.radius)) this.x += dx;
        if (!grid.checkCollision(this.x, this.y + dy, this.radius)) this.y += dy;

        // Límites
        this.x = Math.max(this.radius, Math.min(w - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(h - this.radius, this.y));
    }

    takeDamage(amount) {
        if (this.isDashing) return; // Invulnerable durante Dash (opcional, pero mola)
        this.hp -= amount;
        if (this.hp <= 0) {
            this.hp = 0;
            this.isDead = true;
            // Aquí podríamos emitir partículas de muerte
        }
    }

    shoot(bullets) {
        this.energy -= ENTITY_CONFIG.SHOT_COST;
        this.shotCooldown = ENTITY_CONFIG.SHOT_COOLDOWN;
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
        if (this.isDead) return; // No dibujar si está muerto

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
        ctx.shadowBlur = this.isDashing ? 25 : 8;
        ctx.shadowColor = this.color;
        ctx.fill();
        ctx.restore(); 

        this.drawUI(ctx);
    }

    drawUI(ctx) {
        // UI Flotante Completa (Vida + Energía)
        const w = 32;
        const h = 4;
        const gap = 2;
        const x = this.x - w / 2;
        
        // 1. Barra de Vida (Verde) - Arriba
        const yHp = this.y + this.radius + 8;
        ctx.fillStyle = '#003300';
        ctx.fillRect(x, yHp, w, h);
        const hpPct = this.hp / this.maxHp;
        ctx.fillStyle = hpPct > 0.3 ? '#00ff00' : '#ff3300';
        ctx.fillRect(x, yHp, w * hpPct, h);

        // 2. Barra de Energía (Azul) - Abajo
        const yEnergy = yHp + h + gap;
        ctx.fillStyle = '#003333';
        ctx.fillRect(x, yEnergy, w, h);
        const energyPct = this.energy / ENTITY_CONFIG.MAX_ENERGY;
        ctx.fillStyle = this.energy >= ENTITY_CONFIG.SHOT_COST ? '#00ffff' : '#555'; 
        ctx.fillRect(x, yEnergy, w * energyPct, h);
    }
}