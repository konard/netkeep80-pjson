# pjson Development Plan

## Phase 1: Project Infrastructure (Current)

**Goal:** Establish project structure, requirements framework, and CI pipeline.

- [x] Create requirements JSON schema with traceability support
- [x] Define initial requirements (business, stakeholder, functional, non-functional, constraints)
- [x] Create validation scripts for requirements
- [x] Set up CI pipeline for requirements validation
- [x] Write architecture documentation
- [x] Write README.md

## Phase 2: Core Library Migration

**Goal:** Migrate core pjson functionality from BinDiffSynchronizer, eliminating architectural duplication.

### 2.1 pmm Integration
- [ ] Add pmm as a dependency (git submodule or single-header include)
- [ ] Define pjson's pmm configuration (address traits, storage backend, lock policy)
- [ ] Verify pmm compiles in the pjson build environment

### 2.2 Node Model
- [ ] Migrate `pjson_node.h` — JSON value type system
- [ ] Replace `pjson_pool_pmm` (pool allocator) with direct pmm allocation
- [ ] Ensure node struct is trivially copyable (static_assert)
- [ ] Migrate node mutation functions (set, push_back, insert)
- [ ] Migrate iterators (array, object)

### 2.3 Persistent Containers
- [ ] Replace `pmap_pmm` (sorted array) with pmm's native `pmap` (AVL tree)
- [ ] Use pmm `parray` for JSON arrays and binary data
- [ ] Use pmm `pstring` for mutable string values
- [ ] Use pmm `pstringview` for interned string keys and $ref paths

### 2.4 Database API
- [ ] Migrate path-based addressing (`/a/b/0/c`)
- [ ] Migrate CRUD operations (get, put, erase)
- [ ] Migrate $ref resolution
- [ ] Migrate metrics API

### 2.5 Codec
- [ ] Migrate JSON parser
- [ ] Migrate JSON serializer
- [ ] Migrate $base64 extension support
- [ ] Migrate $ref extension support

## Phase 3: Testing

**Goal:** Port and expand the test suite.

- [ ] Port unit tests from BinDiffSynchronizer
- [ ] Add tests for pmm-direct allocation (no pool)
- [ ] Add tests for AVL-tree-based pmap (replacing sorted array)
- [ ] Add persistence round-trip tests (save, load, verify)
- [ ] Add performance benchmarks
- [ ] Set up C++ CI pipeline (CMake build + CTest)

## Phase 4: API Refinement

**Goal:** Polish the API for external consumption.

- [ ] Design nlohmann::json-compatible API surface where applicable
- [ ] Add convenience constructors and operators
- [ ] Add error handling (exceptions or error codes, TBD)
- [ ] Generate single-header variant
- [ ] Write API reference documentation
- [ ] Add usage examples

## Phase 5: Advanced Features

**Goal:** Add features beyond the prototype.

- [ ] RFC 6901 JSON Pointer compliance (escaped `/` and `~` in keys)
- [ ] Thread safety support (configurable lock policy from pmm)
- [ ] String interning cleanup (garbage collection for unused interned strings)
- [ ] Multiple DB instances per process
- [ ] Binary diff synchronization integration (from BinDiffSynchronizer)

## Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| [pmm](https://github.com/netkeep80/PersistMemoryManager) | latest | Persistent memory management |
| C++20 compiler | GCC 12+ / Clang 15+ / MSVC 19.30+ | Language standard |
| CMake | 3.20+ | Build system |
| Catch2 | v3 | Testing framework |
