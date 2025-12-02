import pygame
import time
import os

def test_pygame_input():
    # Inicializar Pygame (usa SDL2 por debajo)
    os.environ["SDL_JOYSTICK_ALLOW_BACKGROUND_EVENTS"] = "1"
    pygame.init()
    pygame.joystick.init()

    count = pygame.joystick.get_count()
    if count == 0:
        print("❌ Pygame no ve mandos.")
        return

    # Usamos el primer mando
    joystick = pygame.joystick.Joystick(0)
    joystick.init()

    print(f"✅ Mando detectado: {joystick.get_name()}")
    print(f"   Ejes: {joystick.get_numaxes()}")
    print(f"   Botones: {joystick.get_numbuttons()}")

    try:
        while True:
            # PUMP EVENTS
            pygame.event.pump()

            # Leer Ejes (0 y 1 suelen ser Stick Izquierdo)
            axis_0 = joystick.get_axis(0) # Left X
            axis_1 = joystick.get_axis(1) # Left Y
            axis_2 = joystick.get_axis(2) # Right X / Trigger L (depende del mando)
            axis_3 = joystick.get_axis(3) # Right Y / Trigger R
            
            # Leer Botón A (Suele ser 0)
            btn_a = joystick.get_button(0)

            # Imprimir solo si se mueve algo significativo
            # Formateamos para ver si hay vida
            output = f"\rLX: {axis_0:.2f} | LY: {axis_1:.2f} | RX/T: {axis_2:.2f} | RY/T: {axis_3:.2f} | BTN_0: {btn_a}"
            print(output, end="")
            
            time.sleep(0.05)

    except KeyboardInterrupt:
        print("\nSaliendo...")
        pygame.quit()

if __name__ == "__main__":
    test_pygame_input()