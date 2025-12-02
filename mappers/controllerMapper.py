import pygame
import json
import time
import sys

# La lista de deseos: Qué botones queremos identificar
TARGETS = [
    "face_bottom", # A / X (Cross)
    "face_right",  # B / O (Circle)
    "face_left",   # X / Cuadrado
    "face_top",    # Y / Triángulo
    "shoulder_left",  # LB / L1
    "shoulder_right", # RB / R1
    "select",      # Back / Share
    "start",       # Start / Options
    "thumbl",      # Click Stick Izquierdo (L3)
    "thumbr",      # Click Stick Derecho (R3)
]

# Gatillos (Suelen ser ejes, pero a veces botones)
TRIGGERS = ["trigger_left", "trigger_right"]

def get_mapping():
    pygame.init()
    pygame.joystick.init()

    if pygame.joystick.get_count() == 0:
        print("❌ Conecta el mando primero.")
        return

    joy = pygame.joystick.Joystick(0)
    joy.init()
    
    print(f"\n🎮 INICIANDO ASISTENTE DE MAPEO PARA: {joy.get_name()}")
    print(f"GUID: {joy.get_guid()}")
    print("---------------------------------------------------------")
    print("Instrucciones: Pulsa el botón que se te pida.")
    print("Si te equivocas o el botón no existe, pulsa Ctrl+C para salir.")
    print("---------------------------------------------------------\n")

    mapping = {
        "name": joy.get_name(),
        "guid": joy.get_guid(),
        "buttons": {},
        "axes": {},
        "hats": {}
    }

    # 1. MAPEO DE BOTONES DIGITALES
    for target in TARGETS:
        print(f"👉 PULSA: [ {target.upper()} ]")
        
        detected = False
        while not detected:
            for event in pygame.event.get():
                if event.type == pygame.JOYBUTTONDOWN:
                    print(f"   ✅ Detectado Botón ID: {event.button}")
                    mapping["buttons"][target] = event.button
                    detected = True
                    time.sleep(0.5) # Anti-rebote
                
                # Salida de emergencia
                if event.type == pygame.QUIT:
                    return

    # 2. MAPEO DE GATILLOS (Pueden ser Ejes o Botones)
    print("\n--- AHORA LOS GATILLOS (Púlsalos a fondo) ---")
    for target in TRIGGERS:
        print(f"👉 PRESIONA: [ {target.upper()} ]")
        
        detected = False
        baseline_axes = {i: joy.get_axis(i) for i in range(joy.get_numaxes())}
        
        while not detected:
            pygame.event.pump()
            
            # Chequear Ejes (Triggers analógicos)
            for i in range(joy.get_numaxes()):
                val = joy.get_axis(i)
                # Si se mueve significativamente respecto al reposo (>0.5 de diferencia)
                if abs(val - baseline_axes[i]) > 0.6:
                    print(f"   ✅ Detectado Eje ID: {i} (Valor: {val:.2f})")
                    mapping["axes"][target] = i
                    detected = True
                    time.sleep(1)
                    break
            
            # Chequear Botones (Triggers digitales antiguos)
            if not detected:
                for event in pygame.event.get():
                    if event.type == pygame.JOYBUTTONDOWN:
                        print(f"   ✅ Detectado como Botón ID: {event.button}")
                        mapping["buttons"][target] = event.button # Lo guardamos como botón
                        detected = True
                        time.sleep(0.5)

    # 3. MAPEO DE CRUCETA (D-PAD)
    print("\n--- POR ÚLTIMO: LA CRUCETA (D-PAD) ---")
    print("👉 Pulsa ARRIBA en la Cruceta")
    
    detected = False
    while not detected:
        for event in pygame.event.get():
            if event.type == pygame.JOYHATMOTION:
                # Hats suelen ser tuplas (x, y). Arriba suele ser (0, 1)
                if event.value[1] == 1:
                    print(f"   ✅ Detectado Hat ID: {event.hat} (Estándar)")
                    mapping["hats"]["dpad"] = event.hat
                    detected = True
                else:
                    print(f"   ℹ️ Hat movido, pero busca 'Arriba'. Valor: {event.value}")
            
            # Caso raro: Cruceta como botones
            elif event.type == pygame.JOYBUTTONDOWN:
                print(f"   ⚠️ Tu cruceta funciona como botones individuales (ID {event.button}).")
                print("      (Este script asume Hats estándar para simplificar, pero anota este ID).")

    print("\n" + "="*60)
    print("🎉 ¡MAPEO COMPLETADO!")
    print("="*60)
    
    # Generar JSON final
    print(json.dumps(mapping, indent=2))
    
    # Opción de guardar archivo
    with open("my_controller_map.json", "w") as f:
        json.dump(mapping, f, indent=2)
        print("\n💾 Guardado en 'my_controller_map.json'")

if __name__ == "__main__":
    try:
        get_mapping()
    except KeyboardInterrupt:
        print("\nCancelado por el usuario.")
        pygame.quit()