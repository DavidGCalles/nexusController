// entities.js

// Configuración de Entidades
const ENTITY_CONFIG = {
    PLAYER_SPEED: 4.5,
    PLAYER_RADIUS: 12, // Reducido un poco para que no se atasque en pasillos estrechos
    
    // Dash Mechanics
    DASH_SPEED_MULT: 3.0, 
    DASH_DURATION: 12,    
    DASH_COOLDOWN: 45,    
    DASH_COST: 25,        
    
    // Stats
    MAX_ENERGY: 100,
    ENERGY_REGEN: 0.8
};

class Player {
    constructor(id, x, y, color) {
        this.id = id;       
        this.x = x;
        this.y = y;
        this.color = color;
        this.radius = ENTITY_CONFIG.PLAYER_RADIUS;

        // Estado interno
        this.energy = ENTITY_CONFIG.MAX_ENERGY;
        this.isDead = false;

        // Dash System
        this.isDashing = false;
        this.dashFrame = 0;      
        this.dashCooldown = 0;   
        this.dashVector = { x: 0, y: 0 }; 
    }

    // AHORA RECIBE EL GRID
    update(grid, w, h) {
        const pad = window.getController(this.id);
        if (!pad) return; 

        // 1. Regeneración y Cooldowns
        if (this.dashCooldown > 0) this.dashCooldown--;
        if (!this.isDashing && this.energy < ENTITY_CONFIG.MAX_ENERGY) {
            this.energy = Math.min(ENTITY_CONFIG.MAX_ENERGY, this.energy + ENTITY_CONFIG.ENERGY_REGEN);
        }

        // 2. Lógica de Dash
        // Activación: Gatillo Izquierdo (LT) o Botón 'South' (A/X)
        const dashPressed = (pad.axes.lt > 0.5) || pad.buttons.south;
        
        if (dashPressed && this.dashCooldown === 0 && this.energy >= ENTITY_CONFIG.DASH_COST) {
            this.startDash(pad);
        }

        // 3. Calcular vector de movimiento deseado
        let dx = 0;
        let dy = 0;

        if (this.isDashing) {
            const speed = ENTITY_CONFIG.PLAYER_SPEED * ENTITY_CONFIG.DASH_SPEED_MULT;
            dx = this.dashVector.x * speed;
            dy = this.dashVector.y * speed;
            
            this.dashFrame--;
            if (this.dashFrame <= 0) this.endDash();

        } else {
            // Deadzone simple
            const rawLx = Math.abs(pad.axes.lx) > 0.1 ? pad.axes.lx : 0;
            const rawLy = Math.abs(pad.axes.ly) > 0.1 ? pad.axes.ly : 0;

            dx = rawLx * ENTITY_CONFIG.PLAYER_SPEED;
            dy = rawLy * ENTITY_CONFIG.PLAYER_SPEED;
        }

        // 4. APLICAR MOVIMIENTO CON COLISIONES (Eje por Eje)
        
        // Eje X
        if (!grid.checkCollision(this.x + dx, this.y, this.radius)) {
            this.x += dx;
        } else {
            // Opcional: Pegarse a la pared o deslizar. De momento parada seca.
            // Si está haciendo Dash, podríamos romper el muro aquí en el futuro.
        }

        // Eje Y
        if (!grid.checkCollision(this.x, this.y + dy, this.radius)) {
            this.y += dy;
        }

        // 5. Límites de Pantalla (Seguridad final)
        this.x = Math.max(this.radius, Math.min(w - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(h - this.radius, this.y));
    }

    startDash(pad) {
        let dirX = pad.axes.lx;
        let dirY = pad.axes.ly;

        // Si el stick está quieto, dash a la derecha por defecto (o última dirección)
        if (Math.abs(dirX) < 0.1 && Math.abs(dirY) < 0.1) {
            dirX = 1; dirY = 0; 
        }

        const len = Math.hypot(dirX, dirY);
        // Normalizar
        this.dashVector = { x: dirX / len, y: dirY / len };

        this.isDashing = true;
        this.dashFrame = ENTITY_CONFIG.DASH_DURATION;
        this.dashCooldown = ENTITY_CONFIG.DASH_COOLDOWN;
        this.energy -= ENTITY_CONFIG.DASH_COST;
    }

    endDash() {
        this.isDashing = false;
    }

    draw(ctx) {
        // Cuerpo
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        
        if (this.isDashing) {
            ctx.shadowColor = this.color;
            ctx.shadowBlur = 20;
        } else {
            ctx.shadowBlur = 5;
            ctx.shadowColor = this.color;
        }
        
        ctx.fill();
        ctx.shadowBlur = 0;

        // UI (Barra energía)
        this.drawUI(ctx);
    }

    drawUI(ctx) {
        const w = 30;
        const h = 4;
        const x = this.x - w / 2;
        const y = this.y + this.radius + 8;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(x, y, w, h);

        const energyPct = this.energy / ENTITY_CONFIG.MAX_ENERGY;
        ctx.fillStyle = this.energy >= ENTITY_CONFIG.DASH_COST ? '#00ffff' : '#555'; 
        ctx.fillRect(x, y, w * energyPct, h);
    }
}