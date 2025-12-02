import json
import os
import pygame
import struct
from importlib import resources

# Configuración headless
os.environ.setdefault("SDL_JOYSTICK_ALLOW_BACKGROUND_EVENTS", "1")


class InputSource:
    def __init__(self, config_path=None):
        pygame.init()
        pygame.joystick.init()

        self.joystick = None
        self.mapping = {}
        self.baseline = {}

        self.device_info = {
            "connected": False,
            "name": "No Device",
            "guid": None,
            "index": -1
        }

        # Cargar configuración: si no se pasa ruta, usar default_config.json del paquete
        if config_path:
            abs_path = os.path.abspath(config_path)
            print(f"📂 Configuración: {abs_path}")
            self._load_config(config_path)
        else:
            try:
                # resources.files requires a package; using package-relative resource
                with resources.as_file(resources.files(__package__).joinpath("default_config.json")) as p:
                    print(f"📂 Usando configuración por defecto del paquete: {p}")
                    self._load_config(str(p))
            except Exception as e:
                print(f"⚠️ No se pudo cargar default_config.json desde el paquete: {e}")

        self._try_connect()

    def _load_config(self, filename):
        if not os.path.exists(filename):
            print(f"⚠️ ERROR: No existe {filename}")
            return

        try:
            with open(filename, 'r', encoding='utf-8') as f:
                data = json.load(f)
                self.mapping = data
                self.baseline = {int(k): v for k, v in data.get("baseline", {}).items()}
                print(f"✅ Perfil cargado: {data.get('name', 'Unknown')}")
        except Exception as e:
            print(f"❌ Error JSON: {e}")

    def _try_connect(self):
        if pygame.joystick.get_count() > 0:
            try:
                self.joystick = pygame.joystick.Joystick(0)
                self.joystick.init()

                name = self.joystick.get_name()
                try:
                    guid = self.joystick.get_guid()
                except Exception:
                    guid = None

                if self.mapping and guid and guid != self.mapping.get("guid"):
                    print(f"⚠️ AVISO: GUID no coincide. Esperado: {self.mapping.get('guid')}")

                self.device_info = {
                    "connected": True,
                    "name": name,
                    "guid": guid,
                    "index": 0
                }
                print(f"🔌 Mando conectado: {name}")
                return True
            except Exception as e:
                print(f"❌ Error conexión: {e}")
                return False
        return False

    def get_metadata_json(self) -> str:
        if not self.joystick:
            self._try_connect()
        return json.dumps(self.device_info, indent=2)

    def close(self):
        if self.joystick:
            try:
                self.joystick.quit()
            except Exception:
                pass
        try:
            pygame.quit()
        except Exception:
            pass

    # --- HELPERS DE LECTURA ---

    def _get_axis_corrected(self, semantic_name):
        if not self.joystick:
            return 0.0
        axis_id = self.mapping.get("axes", {}).get(semantic_name)
        if axis_id is None:
            return 0.0

        raw_val = self.joystick.get_axis(axis_id)
        base = self.baseline.get(axis_id, 0.0)
        corrected = raw_val - base
        return max(-1.0, min(1.0, corrected))

    def _get_button_mapped(self, semantic_name):
        if not self.joystick:
            return 0
        btn_id = self.mapping.get("buttons", {}).get(semantic_name)
        if btn_id is None:
            return 0
        return 1 if self.joystick.get_button(btn_id) else 0

    def _get_dpad_state(self):
        res = {"up": 0, "down": 0, "left": 0, "right": 0}
        if not self.joystick:
            return res

        hat_id = self.mapping.get("hats", {}).get("dpad")
        if hat_id is None:
            return res

        dx, dy = self.joystick.get_hat(hat_id)

        if dy == 1:
            res["up"] = 1
        if dy == -1:
            res["down"] = 1
        if dx == -1:
            res["left"] = 1
        if dx == 1:
            res["right"] = 1
        return res

    def read(self):
        pygame.event.pump()

        if not self.joystick:
            self._try_connect()
            if not self.joystick:
                return None

        if pygame.joystick.get_count() == 0:
            try:
                self.joystick.quit()
            except Exception:
                pass
            self.joystick = None
            self.device_info["connected"] = False
            return None

        d = {
            "a": self._get_button_mapped("face_bottom"),
            "b": self._get_button_mapped("face_right"),
            "x": self._get_button_mapped("face_left"),
            "y": self._get_button_mapped("face_top"),
            "lb": self._get_button_mapped("shoulder_left"),
            "rb": self._get_button_mapped("shoulder_right"),
            "back": self._get_button_mapped("select"),
            "start": self._get_button_mapped("start"),
            "l3": self._get_button_mapped("thumbl"),
            "r3": self._get_button_mapped("thumbr"),
        }

        dpad = self._get_dpad_state()
        d.update(dpad)

        d.update({
            "lx": self._get_axis_corrected("left_stick_x"),
            "ly": self._get_axis_corrected("left_stick_y"),
            "rx": self._get_axis_corrected("right_stick_x"),
            "ry": self._get_axis_corrected("right_stick_y"),
            "lt": self._get_axis_corrected("trigger_left"),
            "rt": self._get_axis_corrected("trigger_right")
        })

        return d

    @staticmethod
    def to_bytes(data: dict) -> bytes:
        if not data:
            return b''

        buttons_bits = (
            (data["a"] << 0) | (data["b"] << 1) | (data["x"] << 2) | (data["y"] << 3) |
            (data["lb"] << 4) | (data["rb"] << 5) |
            (data["back"] << 6) | (data["start"] << 7) |
            (data["l3"] << 8) | (data["r3"] << 9) |
            (data["up"] << 10) | (data["down"] << 11) | (data["left"] << 12) | (data["right"] << 13)
        )

        def f2i(val):
            return int(max(-1.0, min(1.0, val)) * 32767)

        return struct.pack(
            '<Hhhhhhh',
            buttons_bits,
            f2i(data["lx"]), f2i(data["ly"]), f2i(data["rx"]), f2i(data["ry"]),
            f2i(data["lt"]), f2i(data["rt"]) 
        )

    @staticmethod
    def to_json(data: dict) -> str:
        clean = {k: round(v, 4) if isinstance(v, float) else v for k, v in data.items()}
        return json.dumps(clean)


if __name__ == "__main__":
    source = InputSource()
    import time
    try:
        while True:
            d = source.read()
            if d:
                print(f"\rDPAD: {d['up']}{d['down']}{d['left']}{d['right']} | Start: {d['start']} | LX: {d['lx']:.2f}", end="")
            time.sleep(0.02)
    except KeyboardInterrupt:
        source.close()
