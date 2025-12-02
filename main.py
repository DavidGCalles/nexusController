import asyncio
import logging
import websockets
from inputSource import InputSource 

# Configuración
WS_PORT = 8765
TARGET_FPS = 60

logging.basicConfig(level=logging.INFO, format='%(asctime)s | %(message)s', datefmt='%H:%M:%S')

async def main():
    # 1. Instanciar el lector robusto
    try:
        source = InputSource("controller_config.json")
    except Exception as e:
        logging.error(f"No se pudo iniciar el InputSource: {e}")
        return

    # Info inicial
    logging.info(f"🎮 Backend Listo. Mando: {source.device_info['name']}")
    logging.info(f"📡 WebSocket Server en ws://localhost:{WS_PORT}")

    # 2. Gestión de Clientes (Set de conexiones activas)
    connected_clients = set()

    async def handler(websocket):
        # Al conectarse un cliente:
        connected_clients.add(websocket)
        try:
            # Enviar ficha técnica inicial (Handshake)
            await websocket.send(source.get_metadata_json())
            await websocket.wait_closed()
        finally:
            connected_clients.remove(websocket)

    # 3. Arrancar servidor (No bloqueante)
    async with websockets.serve(handler, "localhost", WS_PORT):
        
        # 4. BUCLE PRINCIPAL (Heartbeat)
        frame_duration = 1.0 / TARGET_FPS
        
        logging.info("🚀 Bucle de transmisión iniciado.")
        
        try:
            while True:
                # A. LEER INPUT (Ya normalizado y correjido por tu clase)
                data = source.read()

                if data and connected_clients:
                    # B. SERIALIZAR A JSON
                    json_payload = InputSource.to_json(data)
                    
                    # C. BROADCAST (Disparar a todos los clientes)
                    websockets.broadcast(connected_clients, json_payload)
                    
                    # (Aquí meteríamos el Serial Writer más tarde)

                # D. MANTENER RITMO (Yield al event loop)
                await asyncio.sleep(frame_duration)

        except asyncio.CancelledError:
            logging.info("Deteniendo servidor...")
        finally:
            source.close()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass