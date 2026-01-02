use gilrs::{Gilrs};
use std::thread;
use std::time::Duration;

fn main() {
    // 1. Inicializamos la librería. El "unwrap()" es nuestra forma de decir:
    // "Si esto falla al arrancar, crashea el programa y dime por qué".
    let mut gilrs = Gilrs::new().unwrap();

    println!("🦀 Nexus Core Online v0.2.0");
    println!("📡 Escaneando dispositivos... (Mueve algo)");

    // Iteramos sobre los mandos ya conectados al arrancar
    for (_id, gamepad) in gilrs.gamepads() {
        println!("✅ Dispositivo detectado: {} [{:?}]", gamepad.name(), gamepad.uuid());
    }

    // 2. El Bucle Infinito (The Event Loop)
    loop {
        while let Some(raw_event) = gilrs.next_event() {
            // Imprimimos TODO. La fecha/hora no nos importa, solo el evento y el ID.
            println!("🔍 EVENTO CRUDO: {:?}", raw_event);
        }
        
        thread::sleep(Duration::from_millis(10));
    }
}