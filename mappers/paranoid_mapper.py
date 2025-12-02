import pygame
import json
import time
import sys

# --- CONFIGURACIÓN PARANOICA ---
HOLD_TIME_REQUIRED = 1.0  # Segundos que debes MANTENER el control quieto al fondo
NOISE_THRESHOLD = 0.5     # Ignora movimientos menores al 50% del recorrido
RESET_THRESHOLD = 0.3     # Valor al que debe bajar todo para considerar que has soltado

BUTTON_TARGETS = [
    "face_bottom", "face_right", "face_left", "face_top",
    "shoulder_left", "shoulder_right",
    "select", "start",
    "thumbl", "thumbr"
]

AXIS_TARGETS = [
    "left_stick_x", "left_stick_y",
    "right_stick_x", "right_stick_y",
    "trigger_left", "trigger_right"
]

def clear_lines(n=1):
    for _ in range(n):
        sys.stdout.write("\033[K") # Borrar línea
        sys.stdout.write("\033[F") # Subir cursor

def wait_for_release_all(joy):
    """
    Bloquea el programa hasta que TODOS los ejes y botones estén en silencio.
    Evita que el rebote de soltar un stick active la siguiente pregunta.
    """
    print("   ✋ SUELTA TODO y espera...", end="\r")
    
    released = False
    while not released:
        pygame.event.pump()
        
        is_clear = True
        
        # 1. Chequear Ejes
        for i in range(joy.get_numaxes()):
            if abs(joy.get_axis(i)) > RESET_THRESHOLD:
                print(" Esta leyendo eje ID:", i, "Valor:", joy.get_axis(i))
                is_clear = False
                break
        
        # 2. Chequear Botones (si alguno sigue pulsado)
        if is_clear:
            for b in range(joy.get_numbuttons()):
                if joy.get_button(b):
                    is_clear = False
                    break
        
        if is_clear:
            # Doble chequeo con pequeña pausa para asegurar estabilidad
            time.sleep(0.2)
            pygame.event.pump()
            # Si sigue limpio tras la pausa, salimos
            released = True
            for i in range(joy.get_numaxes()): # Re-check rápido
                if abs(joy.get_axis(i)) > RESET_THRESHOLD:
                    released = False
        
        if not released:
            time.sleep(0.1)

    print(" " * 40, end="\r") # Limpiar mensaje

def robust_mapper():
    pygame.init()
    pygame.joystick.init()

    if pygame.joystick.get_count() == 0:
        print("❌ No hay mando.")
        return

    joy = pygame.joystick.Joystick(0)
    joy.init()

    mapping = {
        "name": joy.get_name(),
        "guid": joy.get_guid(),
        "buttons": {},
        "axes": {},
        "hats": {}
    }

    print(f"\n🛡️ MAPPER V3 (MODO PARANOICO) - {joy.get_name()}")
    print("INSTRUCCIÓN: Cuando se te pida, MANTÉN EL BOTÓN/EJE hasta que se confirme.")
    print("-----------------------------------------------------------------------")

    # --- FASE 1: BOTONES ---
    for target in BUTTON_TARGETS:
        wait_for_release_all(joy)
        print(f"👉 MANTÉN PULSADO: [ {target.upper()} ]")
        
        confirmed = False
        candidate_btn = -1
        hold_start = 0
        
        while not confirmed:
            pygame.event.pump()
            
            # Buscar qué botón está pulsado AHORA
            current_pressed = -1
            for b in range(joy.get_numbuttons()):
                if joy.get_button(b):
                    current_pressed = b
                    break
            
            # Lógica de Hold
            if current_pressed != -1:
                if candidate_btn == -1:
                    # Empieza la cuenta
                    candidate_btn = current_pressed
                    hold_start = time.time()
                elif candidate_btn == current_pressed:
                    # Sigue pulsando el mismo
                    elapsed = time.time() - hold_start
                    bar = "█" * int(elapsed * 10)
                    print(f"   ⏳ Manteniendo ID {candidate_btn}... {bar}", end="\r")
                    
                    if elapsed >= HOLD_TIME_REQUIRED:
                        print(f"   ✅ CONFIRMADO: Botón {candidate_btn}          ")
                        mapping["buttons"][target] = candidate_btn
                        confirmed = True
                else:
                    # Cambió de botón a mitad -> Reset
                    candidate_btn = -1
            else:
                # Soltó el botón -> Reset
                if candidate_btn != -1:
                    print(f"   ❌ Soltado antes de tiempo...                 ", end="\r")
                candidate_btn = -1
            
            time.sleep(0.01)

    # --- FASE 2: EJES ---
    for target in AXIS_TARGETS:
        wait_for_release_all(joy)
        print(f"👉 MANTÉN A FONDO: [ {target.upper()} ]")
        
        confirmed = False
        candidate_axis = -1
        hold_start = 0
        
        while not confirmed:
            pygame.event.pump()
            
            # Buscar el eje dominante
            max_val = 0.0
            current_axis = -1
            
            for i in range(joy.get_numaxes()):
                val = joy.get_axis(i)
                if abs(val) > max_val:
                    max_val = abs(val)
                    current_axis = i
            
            # Solo consideramos si pasa el umbral de ruido
            if max_val > NOISE_THRESHOLD:
                if candidate_axis == -1:
                    candidate_axis = current_axis
                    hold_start = time.time()
                elif candidate_axis == current_axis:
                    elapsed = time.time() - hold_start
                    bar = "▓" * int(elapsed * 10)
                    print(f"   ⏳ Detectando Eje {candidate_axis} ({max_val:.2f})... {bar}", end="\r")
                    
                    if elapsed >= HOLD_TIME_REQUIRED:
                        print(f"   ✅ CONFIRMADO: Eje {candidate_axis}                           ")
                        mapping["axes"][target] = candidate_axis
                        confirmed = True
                else:
                    # Cambio de eje dominante (ruido o error) -> Reset
                    candidate_axis = -1
            else:
                # Volvió al centro -> Reset
                candidate_axis = -1
                
            time.sleep(0.01)

    # --- FASE 3: CRUCETA ---
    print("\n👉 PULSA: [ D-PAD ARRIBA ]")
    wait_for_release_all(joy)
    
    # Simplificado para D-PAD (suele ser digital, no requiere tanto hold)
    captured = False
    while not captured:
        for event in pygame.event.get():
            if event.type == pygame.JOYHATMOTION:
                if event.value[1] == 1:
                    print(f"   ✅ Hat ID: {event.hat}")
                    mapping["hats"]["dpad"] = event.hat
                    captured = True
    
    print("\n" + "="*60)
    print(json.dumps(mapping, indent=2))
    print("="*60)
    
    with open("controller_config.json", "w") as f:
        json.dump(mapping, f, indent=2)

if __name__ == "__main__":
    try:
        robust_mapper()
    except KeyboardInterrupt:
        print("\nCancelado.")
        pygame.quit()