# pjson Architecture

## Overview

**pjson** (persistent JSON) is a C++20 header-only library that provides a JSON-like API for data structures stored in a persistent address space (PAP) managed by [PersistMemoryManager (pmm)](https://github.com/netkeep80/PersistMemoryManager).

Unlike traditional JSON libraries (e.g., nlohmann::json) that work with in-memory objects requiring explicit serialization/deserialization, pjson operates directly on persistent memory. All JSON data is stored in a binary memory image that can be saved to disk and loaded back without conversion.

## Architectural Principles

### 1. Unified AVL-Tree Forest Paradigm

pjson uses the same AVL-tree forest architecture as pmm for both memory management and stored object management. This means:

- **Memory allocation** (free block management) uses AVL trees
- **JSON objects** (key-value maps) use AVL trees via `pmap`
- **JSON arrays** use `parray` for O(1) indexed access
- **String interning** uses AVL trees via `pstringview`

There is no separate pool allocator or custom memory management in pjson — all memory operations are delegated to pmm.

### 2. pjson as a Thin Wrapper

pjson is a *specific JSON wrapper* around pmm. It adds:
- JSON value type semantics (null, boolean, integer, real, string, array, object)
- Path-based addressing (`/a/b/0/c`)
- JSON parsing and serialization (codec)
- JSON-specific extensions ($ref, $base64)

It does NOT duplicate:
- Memory management (pmm handles allocation, deallocation, coalescing)
- Persistent data structures (pmm provides pmap, parray, pstring, pstringview, pptr)
- Storage backends (pmm provides HeapStorage, MMapStorage, StaticStorage)
- Thread safety (pmm provides lock policies)

### 3. Offset-Based Addressing

All inter-object references use granule indices (offsets from the memory region base), not raw pointers. This makes the entire memory image address-independent — it can be:
- Saved to a file and loaded at a different base address
- Mapped into shared memory
- Transferred between processes

## Architecture Layers

```
┌─────────────────────────────────────────────────────┐
│                   Application                        │
├─────────────────────────────────────────────────────┤
│  pjson API Layer                                     │
│  ┌──────────────┬───────────────┬──────────────────┐│
│  │  pjson_db    │  pjson_codec  │  pjson_helpers   ││
│  │  (CRUD API)  │  (parse/dump) │  (traversal)     ││
│  └──────┬───────┴───────┬───────┴────────┬─────────┘│
│         │               │                │           │
│  pjson Node Layer                                    │
│  ┌──────┴───────────────┴────────────────┴─────────┐│
│  │  pjson_node (value types, iterators, mutation)  ││
│  └──────┬──────────────────────────────────────────┘│
├─────────┴───────────────────────────────────────────┤
│  pmm (PersistMemoryManager)                          │
│  ┌──────────┬──────────┬───────────┬───────────────┐│
│  │  pmap    │  parray  │  pstring  │  pstringview  ││
│  │  (AVL)   │  (contig)│  (mutable)│  (interned)   ││
│  ├──────────┴──────────┴───────────┴───────────────┤│
│  │  AVL-tree forest  │  Allocation  │  Block mgmt  ││
│  ├───────────────────┴──────────────┴──────────────┤│
│  │  Storage Backend (Heap / MMap / Static)          ││
│  └─────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

## JSON Node Model

Each JSON value is represented as a node containing:
- A **tag** identifying the value type (null, boolean, integer, uinteger, real, string, binary, array, object, ref)
- A **payload** union storing either:
  - Scalar values directly (boolean, integer, real)
  - Offsets (granule indices) pointing to persistent containers (string, array, object, binary, ref)

The node structure must be trivially copyable (`POD`) to ensure the entire memory image can be persisted as raw bytes.

## Data Structure Mapping

| JSON Type | pmm Container | Access Complexity | Notes                              |
|-----------|---------------|-------------------|------------------------------------|
| null      | (tag only)    | O(1)              | No payload                         |
| boolean   | (inline)      | O(1)              | Stored directly in node payload    |
| integer   | (inline)      | O(1)              | int64_t in payload                 |
| real      | (inline)      | O(1)              | double in payload                  |
| string    | pstring       | O(1) access       | Mutable, dynamically sized         |
| array     | parray        | O(1) index        | Contiguous, cache-friendly         |
| object    | pmap          | O(log n) key      | AVL-tree sorted by key             |
| binary    | parray<byte>  | O(1) index        | Raw byte storage                   |
| ref       | pstringview   | O(1) compare      | Interned path reference            |

## Prototype Analysis

### Current State (BinDiffSynchronizer)

The prototype in [BinDiffSynchronizer](https://github.com/netkeep80/BinDiffSynchronizer) provides a working pjson implementation with:
- Full JSON type system (10 node types)
- Path-based CRUD API
- JSON codec (parser/serializer) with $ref and $base64 extensions
- Tree traversal, search, cloning, batch operations
- Comprehensive test suite (25+ test files)

### Identified Issues

1. **Pool allocator duplication** (`pjson_pool_pmm`): Uses `PamManager::ppool<node>` for node allocation instead of direct pmm allocation via AVL-tree forest. This introduces a separate memory management layer that duplicates pmm's functionality.

2. **PAM facade duplication** (`pam_pmm.h`): Adds a Persistent Address Manager layer with its own named-object registry (two `pmap` instances) on top of pmm. Some of this functionality overlaps with what pmm provides.

3. **Sorted-array map** (`pmap_pmm.h`): Uses a sorted array (`parray<Entry>`) with binary search instead of pmm's AVL-tree-based `pmap`. This has O(n) insert/delete vs O(log n) for AVL.

4. **Global state**: PMM uses static variables (multiton pattern), limiting to one DB per process per config.

5. **String interning never frees**: The interning dictionary only grows.

### Migration Path

The migration from BinDiffSynchronizer to this repository should:

1. Replace `pjson_pool_pmm` with direct pmm allocation
2. Replace `pmap_pmm` (sorted array) with pmm's native `pmap` (AVL tree)
3. Simplify or remove the PAM facade where it duplicates pmm
4. Retain the node model, codec, path-based API, and helper functions
5. Port the test suite

## Source Code Comment Format

All source files must reference requirement IDs:

```cpp
// @req FR-001 — JSON node storage via pmm AVL-tree forest
class pjson_node { ... };
```

For multi-requirement references:

```cpp
/**
 * @req FR-003 — Path-based JSON value access
 * @req FR-004 — JSON parsing and serialization
 */
```
