# pjson — Persistent JSON

A C++20 header-only library providing a JSON-like API for data structures stored in a persistent address space managed by [PersistMemoryManager (pmm)](https://github.com/netkeep80/PersistMemoryManager).

## What is pjson?

pjson is an analogue of [nlohmann::json](https://github.com/nlohmann/json) for persistent memory. Instead of working with in-memory objects that need explicit serialization, pjson operates directly on a persistent memory image — all data survives process restarts without conversion.

Key characteristics:
- **Persistent by design** — JSON data lives in a memory-mapped file or persistent heap; no serialization/deserialization overhead
- **Familiar API** — inspired by nlohmann::json with path-based access, iteration, and type safety
- **Unified architecture** — uses pmm's AVL-tree forest paradigm for both memory management and stored objects
- **Header-only** — include and compile, no separate library build needed
- **C++20** — leverages concepts, ranges, and modern C++ features

## Architecture

pjson is a thin JSON wrapper around pmm. All memory management, persistent pointers, and data structures are provided by pmm:

| JSON Type | pmm Container | Access     |
|-----------|---------------|------------|
| object    | `pmap`        | O(log n)   |
| array     | `parray`      | O(1)       |
| string    | `pstring`     | O(1)       |
| string key| `pstringview` | O(1) cmp   |
| number    | inline        | O(1)       |
| boolean   | inline        | O(1)       |
| null      | (tag only)    | O(1)       |

See [docs/architecture.md](docs/architecture.md) for the full architecture description and [docs/development-plan.md](docs/development-plan.md) for the development roadmap.

## Project Status

**Phase 1: Infrastructure** — Requirements framework, documentation, and CI pipeline are established.

The pjson prototype is currently developed in [BinDiffSynchronizer](https://github.com/netkeep80/BinDiffSynchronizer). Migration to this repository (Phase 2) will replace the prototype's pool allocator and sorted-array map with pmm's native AVL-tree-based containers.

## Requirements-Driven Development

This project follows a requirements-driven methodology (per Karl Wiegers). All requirements are stored as JSON files with full traceability:

```
requirements/
├── schemas/          # JSON Schema for requirement validation
├── business/         # Business requirements (BR-xxx)
├── stakeholder/      # Stakeholder requirements (SR-xxx)
├── functional/       # Functional requirements (FR-xxx)
├── nonfunctional/    # Non-functional requirements (NFR-xxx)
├── constraints/      # Constraints (CR-xxx)
└── interface/        # Interface requirements (IR-xxx)
```

Each requirement file includes:
- Unique ID with type prefix (e.g., `FR-001`)
- Upward/downward traceability links (`traces_from` / `traces_to`)
- Links to implementation files and test files
- Acceptance criteria
- Status and priority

See [requirements/README.md](requirements/README.md) for the full requirements guide.

### Validating Requirements

```bash
node scripts/validate-requirements.js
```

This validates schema conformance, traceability consistency, and file references.

## Source Code Comment Format

Source files reference requirement IDs using the `@req` tag:

```cpp
// @req FR-001 — JSON node storage via pmm AVL-tree forest
```

## Dependencies

| Dependency | Purpose |
|------------|---------|
| [pmm](https://github.com/netkeep80/PersistMemoryManager) | Persistent memory management |
| C++20 compiler | GCC 12+ / Clang 15+ / MSVC 19.30+ |
| CMake 3.20+ | Build system |
| Node.js 20+ | Requirements validation scripts |

## License

[The Unlicense](LICENSE) — public domain.
