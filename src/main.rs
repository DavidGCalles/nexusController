use gilrs::{Gilrs, Event, EventType, Button}; // Añadimos Button al import
use log::{info, warn, debug, error};
use std::{thread, time::Duration};

fn main() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    info!("🦀 Nexus Core Daemon v0.2.2 - Trigger Sanitizer Active");

    let mut gilrs = match Gilrs::new() {
        Ok(g) => { info!("✅ Input Subsystem Online"); g },
        Err(e) => { error!("❌ CRITICAL: Init failed: {}", e); std::process::exit(1); }
    };

    for (_id, gamepad) in gilrs.gamepads() {
        info!("🎮 Device Detected: {} [{:?}]", gamepad.name(), gamepad.uuid());
    }

    info!("🚀 Core Loop Started - Sanitizing Trigger Events...");

    loop {
        while let Some(Event { id, event, .. }) = gilrs.next_event() {
            
            // --- HELPER: ¿Es este botón un gatillo analógico? ---
            let is_trigger = |btn: Button| matches!(btn, 
                Button::LeftTrigger | Button::RightTrigger | 
                Button::LeftTrigger2 | Button::RightTrigger2
            );

            match event {
                EventType::Connected => info!("🔌 CONNECTED: {:?}", id),
                EventType::Disconnected => warn!("🔌 DISCONNECTED: {:?}", id),

                // 1. LA VERDAD (Analógica)
                EventType::ButtonChanged(btn, val, _) => {
                    // Aquí capturamos TODO el movimiento de gatillos y botones sensibles
                    if is_trigger(btn) {
                        debug!("🔫 TRIGGER: {:?} | {:.2} [Dev: {:?}]", btn, val, id);
                    } else {
                        // Para botones normales (Start, A, B...) también confiamos en Changed
                        // para saber si están pulsados a fondo o no.
                        if val >= 0.5 {
                            debug!("🔴 BTN DOWN: {:?} [Dev: {:?}]", btn, id);
                        } else {
                            debug!("⚪ BTN UP:   {:?} [Dev: {:?}]", btn, id);
                        }
                    }
                },

                // 2. LA MENTIRA (Digital - Pressed)
                EventType::ButtonPressed(btn, _) => {
                    // Si es un gatillo, IGNORAMOS este evento. Es ruido.
                    if !is_trigger(btn) {
                        // Solo lo logueamos si NO es un gatillo (ej. Start, Select)
                        // y solo si queremos redundancia (opcional, yo lo quitaría en prod)
                        // debug!("(Event) Down: {:?}", btn); 
                    }
                },

                // 3. LA MENTIRA (Digital - Released)
                EventType::ButtonReleased(btn, _) => {
                    // Idem: Ignoramos la opinión del driver sobre cuándo soltaste el gatillo.
                    if !is_trigger(btn) {
                        // debug!("(Event) Up: {:?}", btn);
                    }
                },

                EventType::AxisChanged(axis, val, _) => {
                     if val.abs() > 0.1 { debug!("🕹️  STICK: {:?} | {:.2}", axis, val); }
                },
                
                _ => (),
            }
        }
        thread::sleep(Duration::from_millis(10));
    }
}