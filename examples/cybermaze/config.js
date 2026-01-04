// config.js
const CONFIG = {
    // Dimensiones lógicas (afecta a la densidad del laberinto)
    COLS: 41, 
    ROWS: 23,

    // Parametrización del generador
    MAZE_CORRIDOR_WIDTH: 2, // Ancho de pasillo en bloques (2 es cómodo para 4 jugadores)
    MAZE_BREAKABLE_CHANCE: 0.15, // 15% de probabilidad de generar bloques destructibles
    
    // Configuración visual
    WALL_COLOR: '#222',
    WALL_NEON: '#0088ff',
    DEST_WALL_COLOR: '#ffcc00'
};