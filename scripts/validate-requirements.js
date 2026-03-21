#!/usr/bin/env node

/**
 * @req FR-005, FR-006 — Requirements validation script
 *
 * Validates all requirement JSON files against the schema and checks
 * traceability consistency.
 *
 * Usage: node scripts/validate-requirements.js
 * Exit code: 0 if all validations pass, 1 if any fail.
 */

const fs = require('fs');
const path = require('path');

const REQUIREMENTS_DIR = path.join(__dirname, '..', 'requirements');
const SCHEMA_PATH = path.join(REQUIREMENTS_DIR, 'schemas', 'requirement.schema.json');

const SUBDIRS = ['business', 'stakeholder', 'functional', 'nonfunctional', 'constraints', 'interface'];

const TYPE_PREFIX_MAP = {
  business: 'BR',
  stakeholder: 'SR',
  functional: 'FR',
  nonfunctional: 'NFR',
  constraint: 'CR',
  interface: 'IR',
};

let errors = 0;
let warnings = 0;

function error(msg) {
  console.error(`ERROR: ${msg}`);
  errors++;
}

function warn(msg) {
  console.warn(`WARNING: ${msg}`);
  warnings++;
}

function info(msg) {
  console.log(`INFO: ${msg}`);
}

// Load schema
let schema;
try {
  schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
} catch (e) {
  error(`Cannot load schema: ${e.message}`);
  process.exit(1);
}

// Collect all requirement files
const allRequirements = new Map();
const allFiles = [];

for (const subdir of SUBDIRS) {
  const dirPath = path.join(REQUIREMENTS_DIR, subdir);
  if (!fs.existsSync(dirPath)) continue;

  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    allFiles.push({ filePath, subdir, file });
  }
}

info(`Found ${allFiles.length} requirement file(s)`);

// Phase 1: Schema validation (basic, without external validator)
for (const { filePath, subdir, file } of allFiles) {
  let req;
  try {
    req = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    error(`${file}: Invalid JSON - ${e.message}`);
    continue;
  }

  // Check required fields
  const requiredFields = schema.required || [];
  for (const field of requiredFields) {
    if (!(field in req)) {
      error(`${file}: Missing required field '${field}'`);
    }
  }

  // Validate ID format
  if (req.id) {
    const idPattern = /^(BR|SR|FR|NFR|CR|IR)-[0-9]{3}$/;
    if (!idPattern.test(req.id)) {
      error(`${file}: Invalid ID format '${req.id}' (expected pattern: XX-NNN)`);
    }

    // Check ID prefix matches type
    if (req.type) {
      const expectedPrefix = TYPE_PREFIX_MAP[req.type];
      if (expectedPrefix && !req.id.startsWith(expectedPrefix + '-')) {
        error(`${file}: ID '${req.id}' does not match type '${req.type}' (expected prefix '${expectedPrefix}-')`);
      }
    }

    // Check for duplicate IDs
    if (allRequirements.has(req.id)) {
      error(`${file}: Duplicate ID '${req.id}' (also in ${allRequirements.get(req.id)._file})`);
    } else {
      req._file = file;
      req._filePath = filePath;
      allRequirements.set(req.id, req);
    }
  }

  // Validate type enum
  if (req.type) {
    const validTypes = schema.properties.type.enum;
    if (!validTypes.includes(req.type)) {
      error(`${file}: Invalid type '${req.type}' (valid: ${validTypes.join(', ')})`);
    }
  }

  // Validate status enum
  if (req.status) {
    const validStatuses = schema.properties.status.enum;
    if (!validStatuses.includes(req.status)) {
      error(`${file}: Invalid status '${req.status}' (valid: ${validStatuses.join(', ')})`);
    }
  }

  // Validate priority enum
  if (req.priority) {
    const validPriorities = schema.properties.priority.enum;
    if (!validPriorities.includes(req.priority)) {
      error(`${file}: Invalid priority '${req.priority}' (valid: ${validPriorities.join(', ')})`);
    }
  }

  // Check for unknown properties
  const knownProperties = new Set(Object.keys(schema.properties));
  for (const key of Object.keys(req)) {
    if (key.startsWith('_')) continue; // internal fields
    if (!knownProperties.has(key)) {
      error(`${file}: Unknown property '${key}'`);
    }
  }
}

// Phase 2: Traceability validation
info('Validating traceability links...');

for (const [id, req] of allRequirements) {
  // Check traces_from references exist
  if (Array.isArray(req.traces_from)) {
    for (const refId of req.traces_from) {
      if (!allRequirements.has(refId)) {
        error(`${req._file}: traces_from references non-existent requirement '${refId}'`);
      }
    }
  }

  // Check traces_to references exist
  if (Array.isArray(req.traces_to)) {
    for (const refId of req.traces_to) {
      if (!allRequirements.has(refId)) {
        error(`${req._file}: traces_to references non-existent requirement '${refId}'`);
      }
    }
  }
}

// Phase 3: Bidirectional traceability consistency
info('Checking bidirectional traceability consistency...');

for (const [id, req] of allRequirements) {
  if (Array.isArray(req.traces_to)) {
    for (const refId of req.traces_to) {
      const target = allRequirements.get(refId);
      if (target && Array.isArray(target.traces_from)) {
        if (!target.traces_from.includes(id)) {
          warn(`${req._file}: '${id}' traces_to '${refId}', but '${refId}' does not traces_from '${id}'`);
        }
      }
    }
  }

  if (Array.isArray(req.traces_from)) {
    for (const refId of req.traces_from) {
      const source = allRequirements.get(refId);
      if (source && Array.isArray(source.traces_to)) {
        if (!source.traces_to.includes(id)) {
          warn(`${req._file}: '${id}' traces_from '${refId}', but '${refId}' does not traces_to '${id}'`);
        }
      }
    }
  }
}

// Phase 4: File existence checks (warnings only)
info('Checking implementation and test file references...');

const projectRoot = path.join(__dirname, '..');

for (const [id, req] of allRequirements) {
  if (Array.isArray(req.implementation_files)) {
    for (const file of req.implementation_files) {
      const absPath = path.join(projectRoot, file);
      if (!fs.existsSync(absPath)) {
        warn(`${req._file}: Implementation file '${file}' does not exist`);
      }
    }
  }

  if (Array.isArray(req.test_files)) {
    for (const file of req.test_files) {
      const absPath = path.join(projectRoot, file);
      if (!fs.existsSync(absPath)) {
        warn(`${req._file}: Test file '${file}' does not exist`);
      }
    }
  }
}

// Summary
console.log('');
console.log('=== Validation Summary ===');
console.log(`Requirements: ${allRequirements.size}`);
console.log(`Errors: ${errors}`);
console.log(`Warnings: ${warnings}`);

if (errors > 0) {
  console.log('\nValidation FAILED');
  process.exit(1);
} else {
  console.log('\nValidation PASSED');
  process.exit(0);
}
