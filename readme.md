# 🦀 NexusController (Rust Core Rewrite) — WIP

> **⚠️ WARNING: ARCHITECTURAL OVERHAUL IN PROGRESS**
> This branch is currently a construction zone. The Python implementation (`pygame` + `asyncio`) is being replaced by a high-performance system daemon written in **Rust**.
> If you are looking for the working legacy version, check the history or the `legacy-python` tag.

## 🎯 Mission
**NexusController** is a hardware-agnostic input daemon designed to abstract complex controller ecosystems into a standardized, low-latency WebSocket stream.

This rewrite moves from a prototype script to a robust system component, prioritizing:
* **Deterministic Latency:** Zero GC pauses.
* **Type Safety:** Strict compilation guarantees for the input pipeline.
* **Concurrency:** "Fearless concurrency" for separating high-frequency polling from network broadcasting.
* **Multi-Device:** Native support for N concurrent input devices.

## 🏗️ Architecture Stack
* **Language:** Rust (2021 Edition)
* **Input Layer:** `gilrs` (Cross-platform, headless, event-based).
* **Async Runtime:** `tokio` (Industry standard for async I/O).
* **Network:** `tokio-tungstenite` (WebSocket).
* **Serialization:** `serde` (Strict JSON) & custom bit-packing for binary fast-paths.

## 🛣️ Roadmap & Status (ADR-001 / ADR-002)
We are currently executing the migration plan defined in `ADR-001`.

- [ ] **Phase 1: Plumbing (The Core)**
    - [ ] `nexus-core`: Raw event loop with `gilrs`.
    - [ ] `nexus-server`: Async WebSocket infrastructure.
    - [ ] Binary Protocol port (`<Hhhhhhh` format).
- [ ] **Phase 2: The Brain (Orchestration)**
    - [ ] Multi-Controller Registry (Dynamic hot-plugging).
    - [ ] Stream Routing (Legacy vs Multi-stream channels).
- [ ] **Phase 3: Configuration (The Driver)**
    - [ ] Data-Driven Mapping (Runtime lookup tables).
    - [ ] `nexus-map` CLI: Interactive TUI for controller calibration.

## 🛠️ Development Setup
Requirements:
* Rust (`rustc`, `cargo`) - latest stable.

### Build & Run
```bash
# Initialize project (First time only)
# cargo new nexuscontroller

# Run the daemon (Debug mode)
cargo run