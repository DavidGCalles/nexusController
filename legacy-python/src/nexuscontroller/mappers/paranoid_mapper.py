import pygame
import json
import time
import sys

HOLD_TIME_REQUIRED = 1.0
NOISE_THRESHOLD = 0.5
RESET_THRESHOLD = 0.3

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
        sys.stdout.write("\033[K")
        sys.stdout.write("\033[F")

def wait_for_release_all(joy):
    print("   ✋ SUELTA TODO y espera...", end="\r")
    released = False
    while not released:
        pygame.event.pump()
        is_clear = True
        for i in range(joy.get_numaxes()):
            if abs(joy.get_axis(i)) > RESET_THRESHOLD:
                is_clear = False
                break
        if is_clear:
            for b in range(joy.get_numbuttons()):
                if joy.get_button(b):
                    is_clear = False
                    break
        if is_clear:
            time.sleep(0.2)
            pygame.event.pump()
            released = True
            for i in range(joy.get_numaxes()):
                if abs(joy.get_axis(i)) > RESET_THRESHOLD:
                    released = False
        if not released:
            time.sleep(0.1)
    print(" " * 40, end="\r")

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

    for target in BUTTON_TARGETS:
        wait_for_release_all(joy)
        print(f"👉 MANTÉN PULSADO: [ {target.upper()} ]")
        confirmed = False
        candidate_btn = -1
        hold_start = 0
        while not confirmed:
            pygame.event.pump()
            current_pressed = -1
            for b in range(joy.get_numbuttons()):
                if joy.get_button(b):
                    current_pressed = b
                    break
            if current_pressed != -1:
                if candidate_btn == -1:
                    candidate_btn = current_pressed
                    hold_start = time.time()
                elif candidate_btn == current_pressed:
                    elapsed = time.time() - hold_start
                    if elapsed >= HOLD_TIME_REQUIRED:
                        print(f"   ✅ CONFIRMADO: Botón {candidate_btn}          ")
                        mapping["buttons"][target] = candidate_btn
                        confirmed = True
                else:
                    candidate_btn = -1
            else:
                candidate_btn = -1
            time.sleep(0.01)

    for target in AXIS_TARGETS:
        wait_for_release_all(joy)
        print(f"👉 MANTÉN A FONDO: [ {target.upper()} ]")
        confirmed = False
        candidate_axis = -1
        hold_start = 0
        while not confirmed:
            pygame.event.pump()
            max_val = 0.0
            current_axis = -1
            for i in range(joy.get_numaxes()):
                val = joy.get_axis(i)
                if abs(val) > max_val:
                    max_val = abs(val)
                    current_axis = i
            if max_val > NOISE_THRESHOLD:
                if candidate_axis == -1:
                    candidate_axis = current_axis
                    hold_start = time.time()
                elif candidate_axis == current_axis:
                    elapsed = time.time() - hold_start
                    if elapsed >= HOLD_TIME_REQUIRED:
                        print(f"   ✅ CONFIRMADO: Eje {candidate_axis}                           ")
                        mapping["axes"][target] = candidate_axis
                        confirmed = True
                else:
                    candidate_axis = -1
            else:
                candidate_axis = -1
            time.sleep(0.01)

    print("\n👉 PULSA: [ D-PAD ARRIBA ]")
    wait_for_release_all(joy)
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

    with open("controller_config.json", "w", encoding="utf-8") as f:
        json.dump(mapping, f, indent=2)

def run():
    robust_mapper()

if __name__ == "__main__":
    try:
        run()
    except KeyboardInterrupt:
        print("\nCancelado.")
        pygame.quit()
