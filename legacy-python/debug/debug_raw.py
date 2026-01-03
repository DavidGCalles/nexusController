import time
import os
import sdl2
import sdl2.ext

def debug_raw():
    # 1. Forzamos modo background
    sdl2.SDL_SetHint(b"SDL_JOYSTICK_ALLOW_BACKGROUND_EVENTS", b"1")
    sdl2.SDL_Init(sdl2.SDL_INIT_JOYSTICK)

    if sdl2.SDL_NumJoysticks() == 0:
        print("❌ No hay mandos conectados.")
        return

    # Abrimos como JOYSTICK (nivel bajo), no como GameController
    joy = sdl2.SDL_JoystickOpen(0)
    name = sdl2.SDL_JoystickName(joy).decode('utf-8')
    num_axes = sdl2.SDL_JoystickNumAxes(joy)
    num_buttons = sdl2.SDL_JoystickNumButtons(joy)

    print(f"🔬 DEBUG MODE: {name}")
    print(f"   Ejes detectados: {num_axes}")
    print(f"   Botones detectados: {num_buttons}")
    print("\n--- Mueve TODO para identificar los IDs ---")

    try:
        while True:
            sdl2.SDL_PumpEvents() # <--- LA CLAVE
            
            # Construimos una línea con todos los ejes
            axes_str = []
            for i in range(num_axes):
                val = sdl2.SDL_JoystickGetAxis(joy, i)
                # Solo mostramos si hay actividad significativa (ruido > 500)
                if abs(val) > 1000: 
                    axes_str.append(f"AXIS_{i}: {val}")
            
            # Construimos botones pulsados
            btns_str = []
            for b in range(num_buttons):
                if sdl2.SDL_JoystickGetButton(joy, b):
                    btns_str.append(f"BTN_{b}")

            # Imprimimos solo si pasa algo para no ensuciar
            if axes_str or btns_str:
                print(f"\rEjes: {', '.join(axes_str)} | Botones: {', '.join(btns_str)}        ", end="")
            
            time.sleep(0.05)
            
    except KeyboardInterrupt:
        print("\nCerrando...")
        sdl2.SDL_JoystickClose(joy)
        sdl2.SDL_Quit()

if __name__ == "__main__":
    debug_raw()