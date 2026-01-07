use gilrs::{Gilrs, Event, EventType, Button, Axis};
use log::{info, error, debug}; // Asegúrate de importar debug
use serde::Serialize;
use std::{thread, time::Duration};
use tokio::net::TcpListener;
use tokio_tungstenite::accept_async;
use tokio::sync::broadcast;
use futures_util::{SinkExt, StreamExt};

// --- 1. DTOs (Protocolo JSON) ---

#[derive(Serialize, Clone, Debug)]
struct ControllerState {
    id: usize,
    connected: bool,
    name: String,
    guid: String,
    buttons: Buttons,
    axes: Axes,
}

#[derive(Serialize, Clone, Debug, Default)]
struct Buttons {
    south: bool, // A
    east: bool,  // B
    west: bool,  // X
    north: bool, // Y
    lb: bool,
    rb: bool,
    l3: bool,
    r3: bool,
    start: bool,
    select: bool,
    d_up: bool,
    d_down: bool,
    d_left: bool,
    d_right: bool,
}

#[derive(Serialize, Clone, Debug, Default)]
struct Axes {
    lx: f32, ly: f32,
    rx: f32, ry: f32,
    lt: f32, rt: f32,
}

fn uuid_to_string(uuid: [u8; 16]) -> String {
    uuid.iter().map(|b| format!("{:02x}", b)).collect()
}

// --- 2. MAIN DAEMON ---

#[tokio::main]
async fn main() {
    // Configura el log para ver DEBUG si el usuario lo pide, sino INFO
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();
    info!("🦀 Nexus Core v0.4.1 - Verbose Mode Enabled");

    let (tx, _rx) = broadcast::channel::<String>(100);
    let tx_server = tx.clone();

    // SERVER TASK
    tokio::spawn(async move {
        let addr = "0.0.0.0:8765";
        let listener = match TcpListener::bind(addr).await {
            Ok(l) => { info!("📡 WS Server listening on ws://{}", addr); l },
            Err(e) => { error!("❌ Bind Error: {}", e); return; }
        };
        
        while let Ok((stream, _)) = listener.accept().await {
            let addr = stream.peer_addr().unwrap();
            info!("👋 New Client: {}", addr);
            let mut rx = tx_server.subscribe();
            
            tokio::spawn(async move {
                if let Ok(mut ws) = accept_async(stream).await {
                    loop {
                        tokio::select! {
                            Ok(msg) = rx.recv() => {
                                if ws.send(tokio_tungstenite::tungstenite::Message::Text(msg)).await.is_err() { break; }
                            }
                            _ = ws.next() => {}
                        }
                    }
                    info!("👋 Client Disconnected: {}", addr);
                }
            });
        }
    });

    // INPUT LOOP
    let mut gilrs = match Gilrs::new() {
        Ok(g) => { 
            info!("✅ Input System Online");
            for (_id, gamepad) in g.gamepads() {
                info!("🎮 Detected: {} [{}]", gamepad.name(), uuid_to_string(gamepad.uuid()));
            }
            g 
        },
        Err(e) => { error!("❌ Critical: {}", e); return; }
    };

    loop {
        while let Some(Event { id, event, .. }) = gilrs.next_event() {
            let pad = gilrs.gamepad(id);
            
            // Filtramos eventos repetitivos o internos
            let should_send = matches!(event, 
                EventType::ButtonPressed(..) | EventType::ButtonReleased(..) |
                EventType::AxisChanged(..) | EventType::ButtonChanged(..) |
                EventType::Connected | EventType::Disconnected
            );

            if should_send {
                let state = ControllerState {
                    id: id.into(),
                    connected: event != EventType::Disconnected,
                    name: pad.name().to_string(),
                    guid: uuid_to_string(pad.uuid()), 
                    buttons: Buttons {
                        south: pad.is_pressed(Button::South),
                        east: pad.is_pressed(Button::East),
                        west: pad.is_pressed(Button::West),
                        north: pad.is_pressed(Button::North),
                        lb: pad.is_pressed(Button::LeftTrigger),
                        rb: pad.is_pressed(Button::RightTrigger),
                        l3: pad.is_pressed(Button::LeftThumb),
                        r3: pad.is_pressed(Button::RightThumb),
                        start: pad.is_pressed(Button::Start),
                        select: pad.is_pressed(Button::Select),
                        d_up: pad.is_pressed(Button::DPadUp),
                        d_down: pad.is_pressed(Button::DPadDown),
                        d_left: pad.is_pressed(Button::DPadLeft),
                        d_right: pad.is_pressed(Button::DPadRight),
                    },
                    axes: Axes {
                        lx: pad.value(Axis::LeftStickX),
                        ly: pad.value(Axis::LeftStickY),
                        rx: pad.value(Axis::RightStickX),
                        ry: pad.value(Axis::RightStickY),
                        lt: pad.button_data(Button::LeftTrigger2).map(|d| d.value()).unwrap_or(0.0),
                        rt: pad.button_data(Button::RightTrigger2).map(|d| d.value()).unwrap_or(0.0),
                    }
                };

                // --- DIAGNÓSTICO EN TIEMPO REAL ---
                // Esto imprimirá en la terminal CADA VEZ que toques algo.
                // Si esto sale, el backend funciona.
                debug!("⚡ OUT [ID {}]: A={} LX={:.2}", state.id, state.buttons.south, state.axes.lx);

                if let Ok(json) = serde_json::to_string(&state) {
                    let _ = tx.send(json);
                }
            }
        }
        thread::sleep(Duration::from_millis(5));
    }
}