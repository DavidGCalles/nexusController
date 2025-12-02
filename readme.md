# 🎮 ControlNexus — Gamepad Abstraction & Examples

ControlNexus normaliza entradas de gamepads y proporciona herramientas para mapear, depurar y exponer los datos por WebSocket o en un paquete binario compactado. Además incluye ejemplos (entre ellos un demo Canvas llamado CyberMaze).

Este README se actualiza para reflejar la estructura actual del repositorio, las dependencias y los cambios recientes (parametrización del generador de laberintos, dash destructivo, XP diferida, etc.).

## 🛠️ Requisitos
 - Python 3.10+ (probado con 3.12)
 - Paquetes pip: `pygame`, `websockets`, `pyserial` (si necesitas serial)

Instalación rápida:
```powershell
python -m pip install --upgrade pip
pip install pygame websockets pyserial
```

## ¿Qué hay en este repositorio?
 - `main.py` — Servidor asyncio que crea un WebSocket en `ws://localhost:8765` y transmite el JSON normalizado de `InputSource`.
 - `inputSource.py` — Lector principal usando `pygame` (headless). Normaliza ejes, aplica baseline/calibración y proporciona `to_json()` / `to_bytes()`.
 - `controller_config.json` — Archivo generado por los mappers con IDs semánticos de botones/ejes.
 - `mappers/` — Herramientas interactivas para mapear mandos:
   - `scientific_mapper.py` — calibración automática de baseline y mapeo (recomendado).
   - `robust_mapper.py`, `paranoid_mapper.py` — variantes con diferentes heurísticas.
 - `debug/` — scripts de depuración (raw input sniffer, pygame debug helper).
 - `examples/` — demos y utilidades front-end:
   - `examples/cybermaze/` — juego Canvas (HTML + JS split en `config.js`, `maze.js`, `entities.js`, `input.js`, `main.js`).
   - `examples/twinStick.html`, `viewer.html` — páginas de demostración.

## Ejecutar el backend (servidor de input)
1. Conecta tu gamepad y genera `controller_config.json` si no lo tienes:
```powershell
python mappers/scientific_mapper.py
```
Sigue las instrucciones en pantalla; el JSON resultante se guarda en `controller_config.json`.

2. Ejecuta el servidor WebSocket:
```powershell
python main.py
```
Salida esperada:
```
🎮 Backend Listo. Mando: <NOMBRE>
📡 WebSocket Server en ws://localhost:8765
```

3. Abre cualquier cliente que consuma el JSON (por ejemplo `examples/cybermaze/cyberMaze.html`).

## Formatos de salida

### 1) WebSocket — JSON (humano-legible)
 - Frecuencia: ~60Hz
 - Ejes normalizados en [-1.0, 1.0], botones 0/1.
 - Función utilitaria: `InputSource.to_json(data)` devuelve la cadena JSON.

Ejemplo (claves principales): `a,b,x,y,lb,rb,back,start,l3,r3,up,down,left,right,lx,ly,rx,ry,lt,rt`

### 2) Fast Path — Binario
 - `InputSource.to_bytes(data)` empaqueta 14 bytes: `'<Hhhhhhh'`
 - Mapa de bits (botones) y escala de ejes a `int16` está en `inputSource.py`.

## CyberMaze (demo)

Ruta: `examples/cybermaze/`

 - Abrir `examples/cybermaze/cyberMaze.html` en un navegador moderno.
 - Ejecutar el backend (`python main.py`) para alimentar el juego.

Notas importantes del demo:
 - El código del demo está dividido en archivos dentro del directorio `examples/cybermaze/` para facilitar lectura y mantenimiento: `config.js`, `maze.js`, `entities.js`, `input.js`, `main.js`.
 - Cambios recientes y comportamiento del juego:
   - Parametrización del generador de laberintos (`mazeCorridorWidth`, `mazeBreakableBlockChance`, `mazeCarveSeed`, `mazeCarveSpacing` en `config.js`).
   - Corridors construidos por bloques (carving por bloques) para obtener pasillos consistentes.
   - Dash del jugador es destructivo (`playerDashIsDestructive`) y genera una explosión al final del dash.
   - Si el Ray (habilidad) está desbloqueado y se mantiene RT, el dash mejora (más rápido/largo/mas daño): "ray-dash".
   - XP por clearing stage: ahora se guarda en `player.pendingXP` y se aplica/procesa al continuar (evita level-ups instantáneos durante el overlay). Esto se puede ajustar en `config.js` con `xpPerStage`.

## Configuración destacada (editar `examples/cybermaze/config.js`)
 - `mazeCorridorWidth` (int): ancho del pasillo en tiles (recomendado 2).
 - `mazeBreakableBlockChance` (0..1): probabilidad de que un bloque de muro sea destruible.
 - `mazeCarveSeed` (null|int): semilla para generar laberintos reproducibles.
 - `mazeCarveSpacing` (null|int): paso de carving (por defecto `mazeCorridorWidth * 2`).
 - `xpPerStage` (int): XP entregado al completar una escena (ahora diferido a `player.pendingXP`).

## Desarrollo y notas internas
 - `inputSource.py` aplica baseline/rest correction a ejes según `controller_config.json` para evitar problemas con gatillos que reportan -1.0 en reposo.
 - Los mappers en `mappers/` ayudan a crear `controller_config.json` con distintos niveles de robustez.
 - Si habilitas `mazeCarveSeed`, la intención es usar un PRNG determinista. Actualmente el código usa `Math.random()` — puedo reemplazarlo por un PRNG basado en semilla si quieres reproducibilidad exacta.

## Troubleshooting rápido
 - Si no detecta el mando: cierra Steam, instala drivers oficiales y ejecuta los mappers.
 - Si los gatillos tienen offset: vuelve a correr `mappers/scientific_mapper.py`.
 - Si el demo no conecta: asegúrate de que `python main.py` esté corriendo y escucha en `ws://localhost:8765`.