# 🦀 NexusController

> **⚠️ ARCHITECTURAL NOTE (Regression from v0.1):**
> This version creates a high-performance, deterministic pipeline, but currently lacks the "Scientific Mapper" (software normalization) found in the Python legacy version.
> * **Current State:** Direct hardware throughput. Requires standard controllers (Xbox/PS4/PS5) with healthy analog sticks (no drift).
> * **Immediate Roadmap:** Phase 2 focuses entirely on re-implementing software deadzones and dynamic calibration to restore full hardware compatibility.

## 🎯 Mission
**NexusController** is a hardware-agnostic input daemon designed to abstract complex controller ecosystems into a standardized, low-latency WebSocket stream.

It acts as a middleware between your physical devices and your applications (web games, creative coding sketches, UI prototypes), decoupling input handling from application logic.

### Why Rust?
Moved from Python (`pygame` + `asyncio`) to **Rust** to guarantee:
* **Deterministic Latency:** Zero Garbage Collection pauses.
* **Concurrency:** Separated high-frequency polling (Input Thread) from network broadcasting (Server Thread).
* **Type Safety:** Strict compilation guarantees for the input pipeline.

## 🏗️ Architecture
* **Input Layer:** `gilrs` (Cross-platform, headless, event-based).
* **Async Runtime:** `tokio` (Industry standard for async I/O).
* **Network:** `tokio-tungstenite` (WebSocket).
* **Serialization:** `serde_json` (Standardized JSON output).

## 🎮 Proof of Concept: CyberMaze
The repository includes **CyberMaze**, a complete twin-stick shooter demo running in the browser that validates the multi-device architecture.

* **Location:** `examples/cybermaze/`
* **Tech:** HTML5 Canvas + Vanilla JS.
* **Features Validated:**
    * Real-time multi-controller support (Hot-plugging).
    * Low-latency WebSocket streaming (60fps+).
    * JSON Protocol parsing in JS.

## 🚀 Quick Start

### 1. Requirements
* Rust (latest stable via `rustup`).
* A gamepad connected (Xbox, PS4/5, Generic).

### 2. Run the Daemon
```bash
# Clone and enter the repo
git clone [https://github.com/davidgcalles/nexuscontroller.git](https://github.com/davidgcalles/nexuscontroller.git)
cd nexuscontroller

# Run via Cargo
cargo run --release
```

You should see: 📡 WS Server listening on ws://0.0.0.0:8765

You can also download an executable from releases page.

### 3. Test with CyberMaze
- Simply open examples/cybermaze/index.html in your web browser.
- Press START on any controller to join the lobby.
- Use Left Stick to move and Right Stick to aim/shoot.

## 🛣️ Roadmap & Status

Current focus: **Phase 2 (Intelligent Driver)** - Restoring feature parity with Python v0.1.

- [x] **Phase 1: Plumbing (The Core)**
    - [x] `nexus-core`: Raw event loop with `gilrs`.
    - [x] `nexus-server`: Async WebSocket infrastructure.
    - [x] JSON Protocol implementation.

- [ ] **Phase 2: The "Smart" Driver (Priority)**
    - [ ] **Signal Normalization:** Implement software deadzones and "anti-drift" logic (Replaces `scientific_mapper.py`).
    - [ ] **Data-Driven Configuration:** JSON-based remapping for non-standard controllers.
    - [ ] **Calibration Tool:** CLI utility to generate hardware profiles.

- [ ] **Phase 3: Orchestration & Hardware Expansion**
    - [ ] **Binary Protocol / Bit-Packing:** Fast-path serialization for serial/hardware consumers.
    - [ ] **Serial Broadcasting:** Output stream for microcontrollers (ESP-NOW bridges).
    - [ ] **Multi-Controller Registry:** Persistent player slots and robust hot-plugging management.

# 📂 Project Structure
```
.
├── src/                # Rust Source Code
│   ├── main.rs         # Daemon Entry Point
│   └── bin/            # Utility binaries (sniffers)
├── examples/           # Client-side implementations
│   └── cybermaze/      # Reference Game Implementation
└── legacy-python/      # Old Python v0.1.0 implementation (Archived)
```
# 📜 License
MIT