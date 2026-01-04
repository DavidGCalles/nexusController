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
    ENERGY_REGEN: 0.8
};

class Player {
    constructor(id, x, y, color) {
        this.id = id;       
        this.x = x;
        this.y = y;
        this.color = color;
        this.radius = ENTITY_CONFIG.PLAYER_RADIUS;
        
        // Orientación (Radianes). 0 = Derecha.
        this.angle = 0; 

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

        // 1. Energía
        if (!this.isDashing && this.energy < ENTITY_CONFIG.MAX_ENERGY) {
            this.energy = Math.min(ENTITY_CONFIG.MAX_ENERGY, this.energy + ENTITY_CONFIG.ENERGY_REGEN);
        }

        // 2. Dash Trigger
        const dashPressed = (pad.axes.lt > 0.5) || pad.buttons.south;
        if (dashPressed && !this.isDashing && this.energy >= ENTITY_CONFIG.DASH_COST) {
            this.startDash(pad);
        }

        // 3. Movimiento (Stick Izquierdo)
        let dx = 0;
        let dy = 0;
        const rawLx = Math.abs(pad.axes.lx) > 0.1 ? pad.axes.lx : 0;
        const rawLy = Math.abs(pad.axes.ly) > 0.1 ? -pad.axes.ly : 0; // Eje Y Invertido

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

        // 4. Orientación (Cálculo del Ángulo)
        // Prioridad: Stick Derecho (Apuntar)
        const aimX = Math.abs(pad.axes.rx) > 0.1 ? pad.axes.rx : 0;
        const aimY = Math.abs(pad.axes.ry) > 0.1 ? -pad.axes.ry : 0; // Eje Y Invertido también al apuntar

        if (aimX !== 0 || aimY !== 0) {
            this.angle = Math.atan2(aimY, aimX);
        } 
        // Fallback: Si no apuntas, miras hacia donde caminas (si te mueves)
        else if (dx !== 0 || dy !== 0) {
            this.angle = Math.atan2(dy, dx);
        }

        // 5. Colisiones y Posición
        if (!grid.checkCollision(this.x + dx, this.y, this.radius)) {
            this.x += dx;
        }
        if (!grid.checkCollision(this.x, this.y + dy, this.radius)) {
            this.y += dy;
        }

        // 6. Límites
        this.x = Math.max(this.radius, Math.min(w - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(h - this.radius, this.y));
    }

    startDash(pad) {
        let dirX = pad.axes.lx;
        let dirY = -pad.axes.ly; 

        if (Math.abs(dirX) < 0.1 && Math.abs(dirY) < 0.1) {
            // Si no se mueve, usa el ángulo actual de la flecha
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
        ctx.rotate(this.angle); // Rotamos el contexto según hacia donde mire

        // Dibujar Flecha / Nave
        ctx.beginPath();
        // Punta (Derecha, ángulo 0)
        ctx.moveTo(this.radius, 0);
        // Atrás Abajo
        ctx.lineTo(-this.radius, this.radius * 0.8);
        // Centro hundido (forma de flecha)
        ctx.lineTo(-this.radius * 0.4, 0);
        // Atrás Arriba
        ctx.lineTo(-this.radius, -this.radius * 0.8);
        ctx.closePath();

        ctx.fillStyle = this.color;
        
        // Efectos de Neon
        if (this.isDashing) {
            ctx.shadowColor = this.color;
            ctx.shadowBlur = 25;
        } else {
            ctx.shadowBlur = 8;
            ctx.shadowColor = this.color;
        }
        ctx.fill();
        
        ctx.restore(); // Restauramos rotación para que no afecte a la barra de vida

        this.drawUI(ctx);
    }

    drawUI(ctx) {
        const w = 30;
        const h = 4;
        const x = this.x - w / 2;
        const y = this.y + this.radius + 10; // Un poco más separado por la rotación

        // Fondo barra
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(x, y, w, h);

        // Barra energía
        const energyPct = this.energy / ENTITY_CONFIG.MAX_ENERGY;
        ctx.fillStyle = this.energy >= ENTITY_CONFIG.DASH_COST ? '#00ffff' : '#555'; 
        ctx.fillRect(x, y, w * energyPct, h);
    }
}