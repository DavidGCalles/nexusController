import pygame
import sys

def input_sniffer():
    pygame.init()
    pygame.joystick.init()

    if pygame.joystick.get_count() == 0:
        print("❌ Ningún mando detectado.")
        return

    # Pillamos el primero
    joy = pygame.joystick.Joystick(0)
    joy.init()

    print(f"🎮 SNIFFER ACTIVADO: {joy.get_name()}")
    print(f"   GUID: {joy.get_guid()}")
    print(f"   Ejes Totales reportados: {joy.get_numaxes()}")
    print(f"   Botones Totales reportados: {joy.get_numbuttons()}")
    print(f"   Hats (Cruceta) reportados: {joy.get_numhats()}")
    print("-" * 40)
    print("MUEVE TODO. Si sale texto, lo tenemos. Si no, es fantasmal.")

    try:
        while True:
            # En lugar de consultar estado (polling), escuchamos el flujo de eventos
            for event in pygame.event.get():
                
                # 1. MOVIMIENTO DE EJES (Sticks y Gatillos)
                if event.type == pygame.JOYAXISMOTION:
                    # Filtramos el ruido (drift)
                    if abs(event.value) > 0.1:
                        print(f"📍 EJE Detectado -> ID: {event.axis} | Valor: {event.value:.2f}")

                # 2. BOTONES (Pulsar)
                elif event.type == pygame.JOYBUTTONDOWN:
                    print(f"🔴 BOTÓN Pulsado -> ID: {event.button}")

                # 3. BOTONES (Soltar)
                elif event.type == pygame.JOYBUTTONUP:
                    print(f"⚪ BOTÓN Soltado -> ID: {event.button}")

                # 4. HATS (Cruceta / D-Pad)
                elif event.type == pygame.JOYHATMOTION:
                    print(f"➕ HAT (Cruceta) -> ID: {event.hat} | Valor: {event.value}")

    except KeyboardInterrupt:
        print("\nApagando...")
        pygame.quit()

if __name__ == "__main__":
    input_sniffer()