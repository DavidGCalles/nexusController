import pygame
import json
import time
import sys

HOLD_TIME = 0.8
DELTA_THRESHOLD = 0.6

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
    print("\n⚖️  CALIBRANDO SENSORES (NO TOQUES NADA)...")
    baseline = {}
    for _ in range(20):
        pygame.event.pump()
        for i in range(joy.get_numaxes()):
            val = joy.get_axis(i)
            if i in baseline:
                baseline[i] = (baseline[i] + val) / 2
            else:
                baseline[i] = val
        time.sleep(0.05)
    print("✅ Calibración terminada. Valores de reposo detectados:")
    for i, val in baseline.items():
        if abs(val) > 0.1:
            print(f"   - Eje {i} descansa en {val:.2f} (Probable Gatillo)")
    print("-" * 50)
    return baseline

def wait_for_neutral(joy, baseline):
    print("   ✋ Suelta los controles...", end="\r")
    while True:
        pygame.event.pump()
        is_calm = True
        for i in range(joy.get_numaxes()):
            current = joy.get_axis(i)
            rest = baseline.get(i, 0.0)
            if abs(current - rest) > 0.2:
                is_calm = False
                break
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
    baseline = get_baseline(joy)

    mapping = {
        "name": joy.get_name(),
        "guid": joy.get_guid(),
        "buttons": {},
        "axes": {},
        "hats": {},
        "baseline": baseline
    }

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
                    candidate = -1
            else:
                candidate = -1
            if candidate != -1:
                time.sleep(0.02)
        mapping["buttons"][target] = candidate
        print(f"   ✅ Confirmado: Botón {candidate}          ")

    for target in AXIS_TARGETS:
        wait_for_neutral(joy, baseline)
        print(f"👉 MUEVE/APRIETA: [ {target.upper()} ]")
        candidate = -1
        start_time = 0
        while candidate == -1 or (time.time() - start_time) < HOLD_TIME:
            pygame.event.pump()
            max_delta = 0.0
            best_axis = -1
            for i in range(joy.get_numaxes()):
                current = joy.get_axis(i)
                rest = baseline.get(i, 0.0)
                delta = abs(current - rest)
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
            time.sleep(0.02)
        mapping["axes"][target] = candidate
        print(f"   ✅ Confirmado: Eje {candidate}               ")

    print("\n👉 PULSA: [ D-PAD ARRIBA ]")
    wait_for_neutral(joy, baseline)
    while "dpad" not in mapping["hats"]:
        for e in pygame.event.get():
            if e.type == pygame.JOYHATMOTION and e.value[1] == 1:
                mapping["hats"]["dpad"] = e.hat
                print(f"   ✅ Hat {e.hat}")

    with open("controller_config.json", "w", encoding="utf-8") as f:
        json.dump(mapping, f, indent=2)
    print("\n💾 JSON Generado con éxito.")
    print(json.dumps(mapping, indent=2))

def run():
    scientific_mapper()

if __name__ == "__main__":
    run()
