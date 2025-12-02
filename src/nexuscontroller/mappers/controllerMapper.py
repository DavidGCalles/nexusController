import pygame
import json
import time
import sys

# The list of semantic targets
TARGETS = [
    "face_bottom",
    "face_right",
    "face_left",
    "face_top",
    "shoulder_left",
    "shoulder_right",
    "select",
    "start",
    "thumbl",
    "thumbr",
]

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

    for target in TARGETS:
        print(f"👉 PULSA: [ {target.upper()} ]")
        detected = False
        while not detected:
            for event in pygame.event.get():
                if event.type == pygame.JOYBUTTONDOWN:
                    print(f"   ✅ Detectado Botón ID: {event.button}")
                    mapping["buttons"][target] = event.button
                    detected = True
                    time.sleep(0.5)
                if event.type == pygame.QUIT:
                    return

    print("\n--- AHORA LOS GATILLOS (Púlsalos a fondo) ---")
    for target in TRIGGERS:
        print(f"👉 PRESIONA: [ {target.upper()} ]")
        detected = False
        baseline_axes = {i: joy.get_axis(i) for i in range(joy.get_numaxes())}
        while not detected:
            pygame.event.pump()
            for i in range(joy.get_numaxes()):
                val = joy.get_axis(i)
                if abs(val - baseline_axes[i]) > 0.6:
                    print(f"   ✅ Detectado Eje ID: {i} (Valor: {val:.2f})")
                    mapping["axes"][target] = i
                    detected = True
                    time.sleep(1)
                    break
            if not detected:
                for event in pygame.event.get():
                    if event.type == pygame.JOYBUTTONDOWN:
                        print(f"   ✅ Detectado como Botón ID: {event.button}")
                        mapping["buttons"][target] = event.button
                        detected = True
                        time.sleep(0.5)

    print("\n--- POR ÚLTIMO: LA CRUCETA (D-PAD) ---")
    print("👉 Pulsa ARRIBA en la Cruceta")
    detected = False
    while not detected:
        for event in pygame.event.get():
            if event.type == pygame.JOYHATMOTION:
                if event.value[1] == 1:
                    print(f"   ✅ Detectado Hat ID: {event.hat} (Estándar)")
                    mapping["hats"]["dpad"] = event.hat
                    detected = True
                else:
                    print(f"   ℹ️ Hat movido, pero busca 'Arriba'. Valor: {event.value}")
            elif event.type == pygame.JOYBUTTONDOWN:
                print(f"   ⚠️ Tu cruceta funciona como botones individuales (ID {event.button}).")

    print("\n" + "="*60)
    print("🎉 ¡MAPEO COMPLETADO!")
    print("="*60)
    print(json.dumps(mapping, indent=2))

    with open("my_controller_map.json", "w") as f:
        json.dump(mapping, f, indent=2)
        print("\n💾 Guardado en 'my_controller_map.json'")

def run():
    get_mapping()

if __name__ == "__main__":
    try:
        run()
    except KeyboardInterrupt:
        print("\nCancelado por el usuario.")
        pygame.quit()
