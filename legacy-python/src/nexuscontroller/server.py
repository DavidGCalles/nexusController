import asyncio
import logging
import websockets
from .core import InputSource

# Configuración por defecto
WS_PORT = 8765
TARGET_FPS = 60

logging.basicConfig(level=logging.INFO, format='%(asctime)s | %(message)s', datefmt='%H:%M:%S')


async def _main_loop(port=WS_PORT, target_fps=TARGET_FPS, config_path=None):
    try:
        source = InputSource(config_path)
    except Exception as e:
        logging.error(f"No se pudo iniciar el InputSource: {e}")
        return

    logging.info(f"🎮 Backend Listo. Mando: {source.device_info.get('name')}")
    logging.info(f"📡 WebSocket Server en ws://localhost:{port}")

    connected_clients = set()

    async def handler(websocket):
        connected_clients.add(websocket)
        try:
            await websocket.send(source.get_metadata_json())
            await websocket.wait_closed()
        finally:
            connected_clients.remove(websocket)

    async with websockets.serve(handler, "localhost", port):
        frame_duration = 1.0 / target_fps
        logging.info("🚀 Bucle de transmisión iniciado.")
        try:
            while True:
                data = source.read()

                if data and connected_clients:
                    json_payload = InputSource.to_json(data)
                    websockets.broadcast(connected_clients, json_payload)

                await asyncio.sleep(frame_duration)

        except asyncio.CancelledError:
            logging.info("Deteniendo servidor...")
        finally:
            source.close()


def run():
    """Entry point function for the server script."""
    try:
        asyncio.run(_main_loop())
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    run()
