// config.js
const CONFIG = {
    // Dimensiones
    COLS: 41, 
    ROWS: 23,

    // GENERACIÓN DE LABERINTO
    MAZE_CORRIDOR_WIDTH: 2,
    
    // 1. Estructura: % de paredes del laberinto que nacen siendo rompibles
    MAZE_WALL_WEAKNESS_RATIO: 0.3, // El 30% de las paredes maestras se pueden romper
    
    // 2. Relleno: % de pasillos vacíos que tienen escombros
    MAZE_DEBRIS_CHANCE: 0.1, 
    
    // Configuración visual
    WALL_COLOR: '#222',
    WALL_NEON: '#0088ff',
    DEST_WALL_COLOR: '#ffcc00'
};