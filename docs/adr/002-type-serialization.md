# ADR 002: Strict Type Serialization for Controller Configuration

## Context and Problem Statement
In the Python version, `controller_config.json` is loaded into a generic dictionary. Mapping logic relies on string lookups (e.g., `mapping["buttons"]["face_bottom"]`), which is prone to runtime errors if keys are missing or typoed.
We need a robust way to deserialize configuration files and map raw hardware IDs (which vary by OS/Driver) to our semantic internal state (`InputState`).

## Decision Drivers
* **Reliability:** The system should fail fast (at startup) if the configuration is invalid, rather than crashing during gameplay.
* **Interoperability:** The configuration file format should remain JSON to maintain compatibility with the existing frontend and debug tools.
* **Extensibility via Configuration**: The system must support arbitrary hardware inputs via data-driven configuration (controller_config.json) without recompilation.

## Considered Options
* **Unstructured JSON (`serde_json::Value`):** Mimics Python's dicts. Flexible but unsafe.
* **Strict Structs (`serde::Deserialize`):** Maps JSON fields directly to Rust structs.
* **TOML/YAML:** Rust-native config formats, but breaks compatibility with the existing web viewer.

## Decision Outcome
Chosen option: **Strict Structs with `serde`**. We will define a strict schema for the controller profile. This ensures that once a config is loaded, the rest of the application can rely on the data being present and correctly typed.

### Positive Consequences
* **Compile-time guarantees:** We can use Enums for buttons (e.g., `Button::FaceBottom`) instead of strings.
* **Validation:** Serde handles type checking automatically during deserialization.
* **Performance:** Accessing struct fields is significantly faster than hash map string lookups in the critical loop.

### Negative Consequences
* **Rigidity:** Handling "partial" or "malformed" configs requires custom deserialization logic or `Option<T>` wrapping, making the code slightly more verbose than Python.

## Implementation Strategy
1.  Define the `ControllerConfig` struct deriving `Serialize` and `Deserialize`.
2.  Port the "Scientific Mapper" logic to a Rust CLI tool to generate these strict JSONs interactively.
3.  Implement the mapping logic (normalization pipeline) that transforms `RawEvent` -> `MappedEvent` using the loaded config.