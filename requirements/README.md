# Requirements

This directory contains project requirements organized by type, following Karl Wiegers' requirements engineering methodology.

## Directory Structure

```
requirements/
├── schemas/                  # JSON Schema definitions
│   └── requirement.schema.json
├── business/                 # Business requirements (BR-xxx)
├── stakeholder/              # Stakeholder requirements (SR-xxx)
├── functional/               # Functional requirements (FR-xxx)
├── nonfunctional/            # Non-functional requirements (NFR-xxx)
├── constraints/              # Constraints (CR-xxx)
└── interface/                # Interface requirements (IR-xxx)
```

## Requirement ID Format

Each requirement has a unique ID with a prefix indicating its type:

| Prefix | Type           | Description                                      |
|--------|----------------|--------------------------------------------------|
| BR     | Business       | High-level business goals and objectives          |
| SR     | Stakeholder    | Needs and expectations of stakeholders            |
| FR     | Functional     | Specific system behaviors and capabilities        |
| NFR    | Non-functional | Quality attributes (performance, security, etc.)  |
| CR     | Constraint     | Technical or organizational limitations           |
| IR     | Interface      | External system interaction requirements          |

## Traceability

Requirements maintain bidirectional traceability:

- **`traces_from`**: Links to higher-level requirements this one is derived from (upward traceability)
- **`traces_to`**: Links to lower-level requirements derived from this one (downward traceability)
- **`implementation_files`**: Links to source files implementing the requirement
- **`test_files`**: Links to test files verifying the requirement

## Source Code Comment Format

Source files implementing requirements must include a reference in the following format:

```cpp
// @req FR-001, FR-002 — Brief description of what this code implements
```

For block-level documentation:

```cpp
/**
 * @req FR-003 — Path-based JSON value access
 * @req FR-004 — JSON parsing and serialization
 */
```

## Validation

Requirements are validated automatically in CI:

```bash
node scripts/validate-requirements.js
```

This validates:
1. All JSON files conform to the requirement schema
2. All traceability links reference existing requirements
3. Bidirectional traceability consistency
4. Implementation and test file existence (warnings only)
