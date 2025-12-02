***
# 🎮 ControlNexus — Gamepad Abstraction & Packaging

ControlNexus normaliza entradas de gamepads y proporciona herramientas para mapear, depurar y exponer los datos por WebSocket o en un paquete instalable de Python. El repositorio incluye los mappers interactivos y demos en `examples/`.

Este README fue actualizado para reflejar la nueva estructura del repositorio y el flujo de instalación/ejecución como paquete.

## 🧭 Resumen de la nueva estructura
- Código empaquetado: `src/nexuscontroller/`
  - `src/nexuscontroller/core.py` — implementación principal (`InputSource`).
  - `src/nexuscontroller/server.py` — servidor WebSocket con función `run()`.
  - `src/nexuscontroller/default_config.json` — configuración por defecto incluida en el paquete.
  - `src/nexuscontroller/mappers/` — versiones de los mappers con `run()` en cada módulo.
- Ejemplos y herramientas de depuración se mantienen en la raíz: `examples/`, `debug/`.

## ✅ Requisitos
- Python 3.10+ (probado con 3.12)

Dependencias (se instalarán desde `pyproject.toml` si instalas el paquete):
- `pygame`
- `websockets`
- `pyserial` (opcional, para conectividad serial)

## Instalación (editable — recomendado para desarrollo)
En PowerShell, desde la raíz del repositorio:
```powershell
python -m pip install --upgrade pip
python -m pip install -e .
```

Esto instala el paquete en modo editable y crea los entry points CLI descritos abajo.

Alternativa (sin instalar): exporta `src` en `PYTHONPATH` y usa los shims:
```powershell
$env:PYTHONPATH = "src"
python main.py    # shim que invoca nexuscontroller.server.run()
```

## Uso — comandos disponibles
- Ejecutar el servidor WebSocket (recomendado tras `pip install -e .`):
```powershell
nexus-server
```
o alternativamente:
```powershell
python -m nexuscontroller.server
```

- Ejecutar el mapper científico (entry point):
```powershell
nexus-map
```
o alternativamente:
```powershell
python -m nexuscontroller.mappers.scientific_mapper
```

Si no se instaló el paquete, agrega `src` a `PYTHONPATH` (ver arriba) para que `python main.py` funcione como antes.

## Flujo rápido para usar el sistema
1. Instala editable: `python -m pip install -e .`.
2. Si necesitas generar/actualizar un mapeo de controlador:
   - `nexus-map` (o `python -m nexuscontroller.mappers.scientific_mapper`).
   - Esto generará un `controller_config.json` en el directorio de ejecución.
3. Ejecuta el servidor de entrada:
   - `nexus-server` (o `python -m nexuscontroller.server`).
4. Abre un cliente (por ejemplo `examples/cybermaze/cyberMaze.html`) que se conecte a `ws://localhost:8765`.

## Notas importantes
- El paquete incluye `default_config.json` usado como fallback cuando no se pasa un `config_path` a `InputSource`.
- Las entradas de los mappers quedan en `src/nexuscontroller/mappers/` y exponen `run()` para ser usadas como entry points.
- Los shims en la raíz (`main.py`, `mappers/*.py`) siguen presentes para compatibilidad local, pero la forma recomendada es instalar el paquete editable y usar los entry points.

## Formatos de salida (resumen)
- JSON via WebSocket: ejes normalizados en `[-1.0, 1.0]`, botones `0/1`. (función: `InputSource.to_json`).
- Binario: `InputSource.to_bytes(data)` usa formato `'<Hhhhhhh'` para empaquetado compacto.

## Examples & Demo
- `examples/cybermaze/` — demo Canvas que puede consumir el WebSocket del servidor.

## Troubleshooting rápido
- Si `nexus-server` no se encuentra, asegúrate de haber corrido `python -m pip install -e .`.
- Para ejecutar sin instalar, exporta `src` en `PYTHONPATH` y usa los shims (`python main.py`).
- Si el mando no se detecta: cierra Steam/otros remapeadores, conecta el mando y vuelve a ejecutar el mapper.

---

Si quieres, puedo también:
- agregar un `requirements.txt` con las dependencias fijas;
- añadir instrucciones de publicación (PyPI) o CI para publicar releases;
- automatizar la generación de `controller_config.json` en `examples/` para demos.
