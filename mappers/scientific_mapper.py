import pygame
import json
import time
import sys

# --- CONFIGURACIÓN ---
HOLD_TIME = 0.8       # Tiempo para confirmar
DELTA_THRESHOLD = 0.6 # Cuánto hay que mover el eje respecto a su reposo para que cuente

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

def clear_line():
    sys.stdout.write("\033[K") 
    sys.stdout.write("\r")

def get_baseline(joy):
    """
    Lee el estado de reposo de todos los ejes durante 1 segundo.
    Devuelve un diccionario {axis_id: resting_value}
    """
    print("\n⚖️  CALIBRANDO SENSORES (NO TOQUES NADA)...")
    baseline = {}
    
    # Tomamos 20 muestras para asegurar que no hay ruido
    for _ in range(20):
        pygame.event.pump()
        for i in range(joy.get_numaxes()):
            val = joy.get_axis(i)
            # Si ya tenemos un valor, hacemos promedio, si no, guardamos
            if i in baseline:
                baseline[i] = (baseline[i] + val) / 2
            else:
                baseline[i] = val
        time.sleep(0.05)
        
    print("✅ Calibración terminada. Valores de reposo detectados:")
    for i, val in baseline.items():
        # Mostramos los ejes "sospechosos" (los que no están en 0)
        if abs(val) > 0.1:
            print(f"   - Eje {i} descansa en {val:.2f} (Probable Gatillo)")
    print("-" * 50)
    return baseline

def wait_for_neutral(joy, baseline):
    """
    Espera a que todos los ejes vuelvan a su valor de BASELINE (no a cero).
    """
    print("   ✋ Suelta los controles...", end="\r")
    while True:
        pygame.event.pump()
        is_calm = True
        
        # Chequear ejes contra SU baseline personal
        for i in range(joy.get_numaxes()):
            current = joy.get_axis(i)
            rest = baseline.get(i, 0.0)
            if abs(current - rest) > 0.2: # Margen de histeresis
                is_calm = False
                break
        
        # Chequear botones
        for b in range(joy.get_numbuttons()):
            if joy.get_button(b):
                is_calm = False
        
        if is_calm:
            break
        time.sleep(0.1)
    clear_line()

def scientific_mapper():
    pygame.init()
    pygame.joystick.init()

    if pygame.joystick.get_count() == 0:
        print("❌ Sin mando.")
        return

    joy = pygame.joystick.Joystick(0)
    joy.init()
    
    # 1. CALIBRACIÓN INICIAL
    baseline = get_baseline(joy)

    mapping = {
        "name": joy.get_name(),
        "guid": joy.get_guid(),
        "buttons": {},
        "axes": {},
        "hats": {},
        "baseline": baseline # Guardamos esto por si el runtime lo necesita
    }

    # 2. MAPEO BOTONES (Igual que antes)
    for target in BUTTON_TARGETS:
        wait_for_neutral(joy, baseline)
        print(f"👉 MANTÉN: [ {target.upper()} ]")
        
        candidate = -1
        start_time = 0
        
        while candidate == -1 or (time.time() - start_time) < HOLD_TIME:
            pygame.event.pump()
            
            pressed = -1
            for b in range(joy.get_numbuttons()):
                if joy.get_button(b):
                    pressed = b
                    break
            
            if pressed != -1:
                if candidate == -1:
                    candidate = pressed
                    start_time = time.time()
                elif candidate != pressed:
                    candidate = -1 # Cambio de botón -> reset
            else:
                candidate = -1 # Soltó -> reset
            
            if candidate != -1:
                prog = int((time.time() - start_time) / HOLD_TIME * 10)
                print(f"   ⏳ Detectando Botón {candidate}... {'█'*prog}", end="\r")
            
            time.sleep(0.02)
            
        mapping["buttons"][target] = candidate
        print(f"   ✅ Confirmado: Botón {candidate}          ")

    # 3. MAPEO EJES (DIFERENCIAL)
    for target in AXIS_TARGETS:
        wait_for_neutral(joy, baseline)
        print(f"👉 MUEVE/APRIETA: [ {target.upper()} ]")
        
        candidate = -1
        start_time = 0
        
        while candidate == -1 or (time.time() - start_time) < HOLD_TIME:
            pygame.event.pump()
            
            # Buscar el eje con mayor DELTA
            max_delta = 0.0
            best_axis = -1
            
            for i in range(joy.get_numaxes()):
                current = joy.get_axis(i)
                rest = baseline.get(i, 0.0)
                delta = abs(current - rest) # <--- LA FÓRMULA MÁGICA
                
                if delta > max_delta:
                    max_delta = delta
                    best_axis = i
            
            if max_delta > DELTA_THRESHOLD:
                if candidate == -1:
                    candidate = best_axis
                    start_time = time.time()
                elif candidate != best_axis:
                    candidate = -1
            else:
                candidate = -1
                
            if candidate != -1:
                prog = int((time.time() - start_time) / HOLD_TIME * 10)
                print(f"   ⏳ Eje {candidate} (Delta {max_delta:.2f})... {'▓'*prog}", end="\r")
                
            time.sleep(0.02)
            
        mapping["axes"][target] = candidate
        print(f"   ✅ Confirmado: Eje {candidate}               ")

    # 4. CRUCETA
    print("\n👉 PULSA: [ D-PAD ARRIBA ]")
    wait_for_neutral(joy, baseline)
    while "dpad" not in mapping["hats"]:
        for e in pygame.event.get():
            if e.type == pygame.JOYHATMOTION and e.value[1] == 1:
                mapping["hats"]["dpad"] = e.hat
                print(f"   ✅ Hat {e.hat}")

    # Guardar
    with open("controller_config.json", "w") as f:
        json.dump(mapping, f, indent=2)
    print("\n💾 JSON Generado con éxito.")
    print(json.dumps(mapping, indent=2))

if __name__ == "__main__":
    scientific_mapper()