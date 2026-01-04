// entities.js

// Configuración de Entidades
const ENTITY_CONFIG = {
    PLAYER_SPEED: 4.5,
    PLAYER_RADIUS: 12, 
    
    // Dash Mechanics
    DASH_SPEED_MULT: 3.0, 
    DASH_DURATION: 12,    // Duración de la inercia
    // DASH_COOLDOWN eliminado. Solo manda la energía.
    DASH_COST: 25,        
    
    // Stats
    MAX_ENERGY: 100,
    ENERGY_REGEN: 0.8 // Velocidad de recarga
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
        this.dashVector = { x: 0, y: 0 }; 
    }

    update(grid, w, h) {
        const pad = window.getController(this.id);
        if (!pad) return; 

        // 1. Regeneración de Energía
        // Solo regenera si NO estás haciendo dash (para evitar bucles infinitos de energía)
        if (!this.isDashing && this.energy < ENTITY_CONFIG.MAX_ENERGY) {
            this.energy = Math.min(ENTITY_CONFIG.MAX_ENERGY, this.energy + ENTITY_CONFIG.ENERGY_REGEN);
        }

        // 2. Lógica de Dash
        // Activación: LT o Botón Sur (A/X)
        const dashPressed = (pad.axes.lt > 0.5) || pad.buttons.south;
        
        // CONDICIÓN: Tienes energía Y no estás ya en medio de un dash
        if (dashPressed && !this.isDashing && this.energy >= ENTITY_CONFIG.DASH_COST) {
            this.startDash(pad);
        }

        // 3. Inputs de Movimiento
        let dx = 0;
        let dy = 0;

        // Corrección Eje Y (Invertido) aplicada aquí
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

        // 4. Colisiones
        if (!grid.checkCollision(this.x + dx, this.y, this.radius)) {
            this.x += dx;
        }
        if (!grid.checkCollision(this.x, this.y + dy, this.radius)) {
            this.y += dy;
        }

        // 5. Límites
        this.x = Math.max(this.radius, Math.min(w - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(h - this.radius, this.y));
    }

    startDash(pad) {
        let dirX = pad.axes.lx;
        let dirY = -pad.axes.ly; // Corrección Eje Y también aquí

        // Si no se mueve el stick, dash a la derecha por defecto
        if (Math.abs(dirX) < 0.1 && Math.abs(dirY) < 0.1) {
            dirX = 1; dirY = 0; 
        }

        const len = Math.hypot(dirX, dirY);
        this.dashVector = { x: dirX / len, y: dirY / len };

        this.isDashing = true;
        this.dashFrame = ENTITY_CONFIG.DASH_DURATION;
        this.energy -= ENTITY_CONFIG.DASH_COST; // COSTE INMEDIATO
    }

    endDash() {
        this.isDashing = false;
    }

    draw(ctx) {
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
        
        this.drawUI(ctx);
    }

    drawUI(ctx) {
        const w = 30;
        const h = 4;
        const x = this.x - w / 2;
        const y = this.y + this.radius + 8;

        // Fondo barra
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(x, y, w, h);

        // Barra energía
        const energyPct = this.energy / ENTITY_CONFIG.MAX_ENERGY;
        // Color: Cian si tienes para un dash, Gris si no llegas al mínimo
        ctx.fillStyle = this.energy >= ENTITY_CONFIG.DASH_COST ? '#00ffff' : '#555'; 
        ctx.fillRect(x, y, w * energyPct, h);
    }
}