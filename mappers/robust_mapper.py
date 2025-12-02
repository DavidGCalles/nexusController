import pygame
import json
import time
import sys

# Lista de objetivos semánticos
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

def wait_for_neutral(joy):
    """
    Espera a que el usuario suelte todo.
    Toma una instantánea de los valores en reposo (Baseline).
    """
    print("   ... suelta los controles ...", end="\r")
    
    # Esperamos 0.5s de silencio absoluto
    stable = False
    baseline_axes = {}
    
    while not stable:
        pygame.event.pump()
        
        # Tomamos snapshot actual
        current_axes = {i: joy.get_axis(i) for i in range(joy.get_numaxes())}
        
        # Pequeña pausa
        time.sleep(0.1)
        pygame.event.pump()
        
        # Tomamos segunda snapshot
        check_axes = {i: joy.get_axis(i) for i in range(joy.get_numaxes())}
        
        # Si no ha variado casi nada entre snapshots, asumimos que está quieto
        is_still = True
        for i in range(joy.get_numaxes()):
            if abs(current_axes[i] - check_axes[i]) > 0.01:
                is_still = False
                break
        
        if is_still:
            baseline_axes = check_axes
            stable = True
        else:
            # Si se mueve, seguimos esperando
            time.sleep(0.1)
            
    print(" " * 30, end="\r") # Limpiar línea
    return baseline_axes

def robust_mapper():
    pygame.init()
    pygame.joystick.init()

    if pygame.joystick.get_count() == 0:
        print("❌ No hay mando conectado.")
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

    print(f"\n🎯 MAPPER V2 (Con Auto-Tarado) para: {joy.get_name()}")
    print("-----------------------------------------------------")

    # --- FASE 1: BOTONES ---
    for target in BUTTON_TARGETS:
        baseline = wait_for_neutral(joy)
        print(f"👉 PULSA: [ {target.upper()} ]")
        
        captured = False
        while not captured:
            for event in pygame.event.get():
                if event.type == pygame.JOYBUTTONDOWN:
                    print(f"   ✅ Botón ID: {event.button}")
                    mapping["buttons"][target] = event.button
                    captured = True
                
                # Salida emergencia
                if event.type == pygame.QUIT: return

    # --- FASE 2: EJES Y GATILLOS ---
    # Aquí es donde fallaba el anterior. Ahora comparamos delta vs baseline.
    for target in AXIS_TARGETS:
        baseline = wait_for_neutral(joy) # <--- CLAVE: Recalibra el cero antes de cada eje
        
        print(f"👉 MUEVE A FONDO: [ {target.upper()} ]")
        
        captured = False
        while not captured:
            pygame.event.pump()
            
            # Buscamos el eje que más se haya movido respecto a SU baseline
            best_axis = -1
            max_delta = 0.0
            
            for i in range(joy.get_numaxes()):
                val = joy.get_axis(i)
                base = baseline.get(i, 0.0)
                delta = abs(val - base)
                
                if delta > max_delta:
                    max_delta = delta
                    best_axis = i
            
            # Umbral de disparo: 0.6 (para evitar ruido)
            if max_delta > 0.6:
                print(f"   ✅ Eje ID: {best_axis} (Delta: {max_delta:.2f})")
                mapping["axes"][target] = best_axis
                captured = True

    # --- FASE 3: CRUCETA ---
    print("\n👉 PULSA: [ D-PAD ARRIBA ] (Cruceta)")
    wait_for_neutral(joy)
    
    captured = False
    while not captured:
        for event in pygame.event.get():
            if event.type == pygame.JOYHATMOTION:
                if event.value[1] == 1: # Arriba
                    print(f"   ✅ Hat ID: {event.hat}")
                    mapping["hats"]["dpad"] = event.hat
                    captured = True
            elif event.type == pygame.JOYBUTTONDOWN:
                print(f"   ⚠️ Detectado como botón {event.button}. (Anotado manual)")

    print("\n" + "="*60)
    print(json.dumps(mapping, indent=2))
    print("="*60)
    
    with open("controller_config.json", "w") as f:
        json.dump(mapping, f, indent=2)
        print("💾 Guardado en controller_config.json")

if __name__ == "__main__":
    try:
        robust_mapper()
    except KeyboardInterrupt:
        pygame.quit()