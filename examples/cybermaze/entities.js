// entities.js
// ==========================================
// ARQUITECTURA DE ENTIDADES MODULARES (OODA)
// ==========================================

// 1. SISTEMA DE ESCALADO Y CONFIGURACIÓN
// ==========================================
const ENTITY_RATIOS = {
    PLAYER_SPEED: 0.15,
    PLAYER_RADIUS: 0.35,
    BULLET_SPEED: 0.5,
    BULLET_RADIUS: 0.12,
    ENEMY_SPEED: 0.09,
    ENEMY_VISION: 12.0, // Radio de visión en celdas
    UI_BAR_WIDTH: 0.8,
    UI_BAR_HEIGHT: 0.1,
    UI_OFFSET: 0.5
};

const ENTITY_CONFIG = {
    // Valores base (Stats)
    PLAYER_HP: 100,
    DASH_SPEED_MULT: 3.0,
    DASH_DURATION: 12,
    DASH_COST: 25,
    MAX_ENERGY: 100,
    ENERGY_REGEN: 0.8,
    SHOT_COST: 10,
    SHOT_COOLDOWN: 8,
    BULLET_DAMAGE: 25,
    ENEMY_FIRE_RATE: 60,
    ALERT_TIMEOUT: 180, // Memoria de la IA (frames)

    // Se inyectarán valores calculados aquí:
    // PLAYER_SPEED, ENEMY_SPEED, etc.
};

function updateEntityScale(cellSize) {
    console.log(`⚖️ Entities: Escala aplicada para celda ${cellSize.toFixed(1)}px`);
    ENTITY_CONFIG.PLAYER_SPEED = cellSize * ENTITY_RATIOS.PLAYER_SPEED;
    ENTITY_CONFIG.PLAYER_RADIUS = cellSize * ENTITY_RATIOS.PLAYER_RADIUS;
    ENTITY_CONFIG.BULLET_SPEED = cellSize * ENTITY_RATIOS.BULLET_SPEED;
    ENTITY_CONFIG.BULLET_RADIUS = cellSize * ENTITY_RATIOS.BULLET_RADIUS;
    ENTITY_CONFIG.ENEMY_SPEED = cellSize * ENTITY_RATIOS.ENEMY_SPEED;
    ENTITY_CONFIG.ENEMY_VISION = cellSize * ENTITY_RATIOS.ENEMY_VISION;
    
    ENTITY_CONFIG.UI_W = cellSize * ENTITY_RATIOS.UI_BAR_WIDTH;
    ENTITY_CONFIG.UI_H = cellSize * ENTITY_RATIOS.UI_BAR_HEIGHT;
    ENTITY_CONFIG.UI_Y_OFFSET = cellSize * ENTITY_RATIOS.UI_OFFSET;
}

// 2. CLASES BASE (FRAMEWORK)
// ==========================================

// Entidad Genérica: Física básica
class GameEntity {
    constructor(x, y, color, radius) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.radius = radius;
        this.alive = true;
    }
}

// Entidad Viva: Salud, Daño y UI básica
class LivingEntity extends GameEntity {
    constructor(x, y, color, radius, hp) {
        super(x, y, color, radius);
        this.hp = hp;
        this.maxHp = hp;
        this.isDead = false;
    }

    takeDamage(amount) {
        if (this.isDead) return;
        this.hp -= amount;
        if (this.hp <= 0) {
            this.hp = 0;
            this.die();
        }
    }

    die() {
        this.isDead = true;
        this.alive = false;
    }

    drawUI(ctx) {
        const w = ENTITY_CONFIG.UI_W;
        const h = ENTITY_CONFIG.UI_H;
        const x = this.x - w / 2;
        const y = this.y - this.radius - ENTITY_CONFIG.UI_Y_OFFSET;

        // Fondo barra
        ctx.fillStyle = '#330000';
        ctx.fillRect(x, y, w, h);
        
        // Vida actual
        const hpPct = Math.max(0, this.hp / this.maxHp);
        ctx.fillStyle = hpPct > 0.3 ? '#00ff00' : '#ff0000';
        ctx.fillRect(x, y, w * hpPct, h);
    }
}

// 3. IMPLEMENTACIONES CONCRETAS
// ==========================================

class Bullet extends GameEntity {
    constructor(x, y, angle, ownerId, color) {
        super(x, y, color, ENTITY_CONFIG.BULLET_RADIUS);
        this.vx = Math.cos(angle) * ENTITY_CONFIG.BULLET_SPEED;
        this.vy = Math.sin(angle) * ENTITY_CONFIG.BULLET_SPEED;
        this.ownerId = ownerId;
    }

    update(grid, w, h) {
        this.x += this.vx;
        this.y += this.vy;
        
        // Límites del mundo
        if (this.x < 0 || this.x > w || this.y < 0 || this.y > h) {
            this.alive = false;
            return;
        }
        // Colisión con Grid
        const hit = grid.checkProjectileHit(this.x, this.y);
        if (hit) this.alive = false;
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

class Player extends LivingEntity {
    constructor(id, x, y, color) {
        // Inicializamos con radio temporal, se ajusta luego si hiciera falta
        super(x, y, color, ENTITY_CONFIG.PLAYER_RADIUS, ENTITY_CONFIG.PLAYER_HP);
        this.id = id;
        this.angle = 0;
        
        // Stats propias
        this.energy = ENTITY_CONFIG.MAX_ENERGY;
        this.shotCooldown = 0;
        
        // Dash System
        this.isDashing = false;
        this.dashFrame = 0;
        this.dashVector = { x: 0, y: 0 };
    }

    // Sobreescribimos takeDamage para invulnerabilidad en Dash
    takeDamage(amount) {
        if (this.isDashing) return;
        super.takeDamage(amount);
    }

    update(grid, w, h, bullets) {
        if (this.isDead) return;
        // Re-asegurar radio correcto (por si se instanció antes del config)
        this.radius = ENTITY_CONFIG.PLAYER_RADIUS;

        const pad = window.getController(this.id);
        if (!pad) return;

        // 1. Recursos (Cooldowns / Energía)
        if (this.shotCooldown > 0) this.shotCooldown--;
        if (!this.isDashing && this.energy < ENTITY_CONFIG.MAX_ENERGY) {
            this.energy = Math.min(ENTITY_CONFIG.MAX_ENERGY, this.energy + ENTITY_CONFIG.ENERGY_REGEN);
        }

        // 2. Acciones (Input)
        // Disparo
        if (pad.axes.rt > 0.5 && this.shotCooldown <= 0 && this.energy >= ENTITY_CONFIG.SHOT_COST) {
            this.shoot(bullets);
        }
        // Dash
        const dashPressed = (pad.axes.lt > 0.5) || pad.buttons.south;
        if (dashPressed && !this.isDashing && this.energy >= ENTITY_CONFIG.DASH_COST) {
            this.startDash(pad);
        }

        // 3. Movimiento
        this.move(grid, pad, w, h);

        // 4. Orientación (Aim)
        const aimX = Math.abs(pad.axes.rx) > 0.1 ? pad.axes.rx : 0;
        const aimY = Math.abs(pad.axes.ry) > 0.1 ? -pad.axes.ry : 0;
        if (aimX !== 0 || aimY !== 0) {
            this.angle = Math.atan2(aimY, aimX);
        } else if (this.isMoving(pad)) {
            // Si no apunta pero se mueve, mira al frente
            // (Calculado implícitamente en lógica de movimiento)
        }
    }

    move(grid, pad, w, h) {
        let dx = 0, dy = 0;
        
        if (this.isDashing) {
            const speed = ENTITY_CONFIG.PLAYER_SPEED * ENTITY_CONFIG.DASH_SPEED_MULT;
            dx = this.dashVector.x * speed;
            dy = this.dashVector.y * speed;
            this.dashFrame--;
            if (this.dashFrame <= 0) this.isDashing = false;
        } else {
            const rawLx = Math.abs(pad.axes.lx) > 0.1 ? pad.axes.lx : 0;
            const rawLy = Math.abs(pad.axes.ly) > 0.1 ? -pad.axes.ly : 0;
            dx = rawLx * ENTITY_CONFIG.PLAYER_SPEED;
            dy = rawLy * ENTITY_CONFIG.PLAYER_SPEED;
            
            if (dx !== 0 || dy !== 0) {
                this.angle = Math.atan2(dy, dx);
            }
        }

        if (!grid.checkCollision(this.x + dx, this.y, this.radius)) this.x += dx;
        if (!grid.checkCollision(this.x, this.y + dy, this.radius)) this.y += dy;

        // Clamp screen
        this.x = Math.max(this.radius, Math.min(w - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(h - this.radius, this.y));
    }

    isMoving(pad) {
        return Math.abs(pad.axes.lx) > 0.1 || Math.abs(pad.axes.ly) > 0.1;
    }

    shoot(bullets) {
        this.energy -= ENTITY_CONFIG.SHOT_COST;
        this.shotCooldown = ENTITY_CONFIG.SHOT_COOLDOWN;
        const tipX = this.x + Math.cos(this.angle) * (this.radius * 1.5);
        const tipY = this.y + Math.sin(this.angle) * (this.radius * 1.5);
        bullets.push(new Bullet(tipX, tipY, this.angle, this.id, this.color));
    }

    startDash(pad) {
        let dirX = pad.axes.lx;
        let dirY = -pad.axes.ly;
        // Si no hay input direccional, dash hacia adelante
        if (Math.abs(dirX) < 0.1 && Math.abs(dirY) < 0.1) {
            dirX = Math.cos(this.angle);
            dirY = Math.sin(this.angle);
        }
        const len = Math.hypot(dirX, dirY);
        if (len > 0.01) {
            this.dashVector = { x: dirX / len, y: dirY / len };
        } else {
            this.dashVector = { x: 1, y: 0 };
        }
        this.isDashing = true;
        this.dashFrame = ENTITY_CONFIG.DASH_DURATION;
        this.energy -= ENTITY_CONFIG.DASH_COST;
    }

    draw(ctx) {
        if (this.isDead) return;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        
        ctx.beginPath();
        // Forma de "Nave"
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
        this.drawEnergy(ctx);
    }

    drawEnergy(ctx) {
        const w = ENTITY_CONFIG.UI_W;
        const h = ENTITY_CONFIG.UI_H;
        const x = this.x - w / 2;
        const y = (this.y - this.radius - ENTITY_CONFIG.UI_Y_OFFSET) + h + 2;
        
        ctx.fillStyle = '#003333';
        ctx.fillRect(x, y, w, h);
        const enPct = this.energy / ENTITY_CONFIG.MAX_ENERGY;
        ctx.fillStyle = this.energy >= ENTITY_CONFIG.SHOT_COST ? '#00ffff' : '#555';
        ctx.fillRect(x, y, w * enPct, h);
    }
}


// 4. CEREBRO OODA (IA MODULAR)
// ==========================================

class Enemy extends LivingEntity {
    constructor(type, x, y) {
        // Configuramos stats base según arquetipo
        // radius temp, se ajusta abajo
        super(x, y, '#fff', ENTITY_CONFIG.PLAYER_RADIUS, 100); 
        
        this.type = type;
        this.configureArchetype(type);
        
        // --- ARQUITECTURA OODA ---
        this.state = 'IDLE'; // IDLE | PATROL | ALERT | COMBAT
        this.sensors = [];   // Array de inputs
        this.memory = {
            target: null,
            lastKnownPos: null,
            alertTimer: 0
        };
        
        // Inicializamos sensores
        this.sensors.push(this.sensorVision); // Solo Visión por ahora
        
        // Variables de navegación
        this.path = [];
        this.pathTimer = 0;
        this.shootTimer = 0;
    }

    configureArchetype(type) {
        this.radius = ENTITY_CONFIG.PLAYER_RADIUS; // Estandarizado
        
        if (type === 'square') {
            this.hp = this.maxHp = 100;
            this.speedFactor = 0.8;
            this.color = '#ff0055';
        } else if (type === 'circle') {
            this.hp = this.maxHp = 50;
            this.speedFactor = 1.3;
            this.color = '#ff9900';
        } else if (type === 'diamond') {
            this.hp = this.maxHp = 60;
            this.speedFactor = 0.9;
            this.color = '#cc00ff';
        }
    }

    // EL BUCLE OODA PRINCIPAL
    update(grid, players, bullets, w, h) {
        if (this.isDead) return;

        // 1. OBSERVE (Recopilar datos)
        const perception = this.observe(grid, players);

        // 2. ORIENT (Actualizar Estado mental)
        this.orient(perception);

        // 3. DECIDE (Elegir Plan de Acción)
        const plan = this.decide(grid);

        // 4. ACT (Ejecutar Física)
        this.act(plan, grid, bullets);
    }

    // --- FASE 1: OBSERVE ---
    observe(grid, players) {
        let perception = {
            visibleEnemies: []
            // Aquí añadiríamos heardNoises: [] en el futuro
        };

        // Ejecutar todos los sensores registrados
        this.sensors.forEach(sensor => {
            // Llamamos al sensor con el contexto 'this' y args
            sensor.call(this, grid, players, perception);
        });

        return perception;
    }

    // Sensor Modular: Visión (Raycasting)
    sensorVision(grid, players, output) {
        players.forEach(p => {
            if (p.isDead) return;
            const dist = Math.hypot(p.x - this.x, p.y - this.y);
            
            if (dist < ENTITY_CONFIG.ENEMY_VISION) {
                if (grid.hasLineOfSight(this.x, this.y, p.x, p.y)) {
                    output.visibleEnemies.push({ 
                        entity: p, 
                        dist: dist 
                    });
                }
            }
        });
        // Ordenar por cercanía
        output.visibleEnemies.sort((a, b) => a.dist - b.dist);
    }

    // --- FASE 2: ORIENT ---
    orient(perception) {
        const closestThreat = perception.visibleEnemies[0]; // { entity, dist }

        // Máquina de Estados Simplificada
        switch (this.state) {
            case 'IDLE':
            case 'PATROL':
                if (closestThreat) {
                    this.state = 'COMBAT';
                    this.memory.target = closestThreat.entity;
                }
                break;
                
            case 'ALERT': // Buscando
                if (closestThreat) {
                    this.state = 'COMBAT';
                    this.memory.target = closestThreat.entity;
                } else {
                    this.memory.alertTimer--;
                    if (this.memory.alertTimer <= 0) {
                        this.state = 'IDLE'; // Se rindió
                        this.memory.target = null;
                    }
                }
                break;

            case 'COMBAT':
                if (closestThreat) {
                    // Actualizar memoria con posición en tiempo real
                    this.memory.target = closestThreat.entity;
                    this.memory.lastKnownPos = { x: closestThreat.entity.x, y: closestThreat.entity.y };
                    this.memory.alertTimer = ENTITY_CONFIG.ALERT_TIMEOUT;
                } else {
                    // Perdió contacto visual -> Pasar a investigar última posición
                    this.state = 'ALERT';
                }
                break;
        }
    }

    // --- FASE 3: DECIDE ---
    decide(grid) {
        // Devuelve un objeto "Intención"
        const plan = {
            moveTarget: null,
            shouldShoot: false,
            aimAngle: 0
        };

        if (this.state === 'IDLE') {
            // Quedarse quieto (o patrullar random en futuro)
            return plan;
        }

        if (this.state === 'COMBAT') {
            const target = this.memory.target;
            if (!target) return plan;

            // Estrategia Básica: Perseguir
            plan.moveTarget = { x: target.x, y: target.y };

            // Estrategia de Disparo (Si es Diamante)
            if (this.type === 'diamond') {
                const dist = Math.hypot(target.x - this.x, target.y - this.y);
                // Si estoy cerca y veo al objetivo, disparo
                if (dist < 400 && grid.hasLineOfSight(this.x, this.y, target.x, target.y)) {
                    plan.shouldShoot = true;
                    plan.aimAngle = Math.atan2(target.y - this.y, target.x - this.x);
                    // Comportamiento Táctico: Si disparo, no me muevo (Turret mode)
                    if (dist < 250) plan.moveTarget = null; 
                }
            }
        }

        if (this.state === 'ALERT') {
            // Ir a la última posición conocida
            if (this.memory.lastKnownPos) {
                plan.moveTarget = this.memory.lastKnownPos;
            }
        }

        return plan;
    }

    // --- FASE 4: ACT ---
    act(plan, grid, bullets) {
        // 1. Ejecutar Movimiento
        if (plan.moveTarget) {
            this.moveTo(grid, plan.moveTarget.x, plan.moveTarget.y);
        }

        // 2. Ejecutar Disparo
        if (plan.shouldShoot) {
            if (this.shootTimer > 0) this.shootTimer--;
            else {
                this.shoot(bullets, plan.aimAngle);
                this.shootTimer = ENTITY_CONFIG.ENEMY_FIRE_RATE;
            }
        } else {
            // Cooldown baja siempre
            if (this.shootTimer > 0) this.shootTimer--;
        }
    }

    // SISTEMA DE NAVEGACIÓN (Pathfinding Wrapper)
    moveTo(grid, tx, ty) {
        // Optimización: Solo recalcular A* cada 15 frames
        if (this.pathTimer > 0 && this.path.length > 0) {
            this.pathTimer--;
        } else {
            this.path = grid.getPath(this.x, this.y, tx, ty);
            this.pathTimer = 15; 
        }

        // Seguir nodos
        if (this.path && this.path.length > 0) {
            const nextNode = this.path[0];
            const dx = nextNode.x - this.x;
            const dy = nextNode.y - this.y;
            const dist = Math.hypot(dx, dy);

            if (dist < 5) {
                this.path.shift(); // Nodo alcanzado
            } else {
                const angle = Math.atan2(dy, dx);
                const currentSpeed = ENTITY_CONFIG.ENEMY_SPEED * this.speedFactor;
                
                const mx = Math.cos(angle) * currentSpeed;
                const my = Math.sin(angle) * currentSpeed;

                if (!grid.checkCollision(this.x + mx, this.y, this.radius)) this.x += mx;
                if (!grid.checkCollision(this.x, this.y + my, this.radius)) this.y += my;
            }
        }
    }

    shoot(bullets, angle) {
        bullets.push(new Bullet(this.x, this.y, angle, 'enemy', this.color));
    }

    // Al recibir daño, forzamos estado de alerta (Reacción instintiva)
    takeDamage(amount) {
        super.takeDamage(amount);
        if (this.state === 'IDLE' || this.state === 'PATROL') {
            this.state = 'ALERT';
            this.memory.alertTimer = ENTITY_CONFIG.ALERT_TIMEOUT;
            // Hack: Girarse a buscar, aunque no sepa dónde está el agresor
        }
    }

    draw(ctx) {
        // Debug Visual de Estado (Opcional)
        /*
        ctx.fillStyle = '#fff';
        ctx.font = '10px monospace';
        ctx.fillText(this.state, this.x, this.y - 20);
        */

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
}