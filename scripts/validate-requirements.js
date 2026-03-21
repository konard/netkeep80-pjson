#!/usr/bin/env node

/**
 * @req FR-005, FR-006 — Скрипт валидации требований
 *
 * Валидирует все JSON-файлы требований по схеме и проверяет
 * согласованность трассировки.
 *
 * Использование: node scripts/validate-requirements.js
 * Код возврата: 0 если все проверки пройдены, 1 если есть ошибки.
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
  console.error(`ОШИБКА: ${msg}`);
  errors++;
}

function warn(msg) {
  console.warn(`ПРЕДУПРЕЖДЕНИЕ: ${msg}`);
  warnings++;
}

function info(msg) {
  console.log(`ИНФО: ${msg}`);
}

// Загрузка схемы
let schema;
try {
  schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
} catch (e) {
  error(`Не удалось загрузить схему: ${e.message}`);
  process.exit(1);
}

// Сбор всех файлов требований
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

info(`Найдено ${allFiles.length} файл(ов) требований`);

// Фаза 1: Валидация по схеме (базовая, без внешнего валидатора)
for (const { filePath, subdir, file } of allFiles) {
  let req;
  try {
    req = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    error(`${file}: Невалидный JSON - ${e.message}`);
    continue;
  }

  // Проверка обязательных полей
  const requiredFields = schema.required || [];
  for (const field of requiredFields) {
    if (!(field in req)) {
      error(`${file}: Отсутствует обязательное поле '${field}'`);
    }
  }

  // Валидация формата ID
  if (req.id) {
    const idPattern = /^(BR|SR|FR|NFR|CR|IR)-[0-9]{3}$/;
    if (!idPattern.test(req.id)) {
      error(`${file}: Невалидный формат ID '${req.id}' (ожидается паттерн: XX-NNN)`);
    }

    // Проверка соответствия префикса ID типу
    if (req.type) {
      const expectedPrefix = TYPE_PREFIX_MAP[req.type];
      if (expectedPrefix && !req.id.startsWith(expectedPrefix + '-')) {
        error(`${file}: ID '${req.id}' не соответствует типу '${req.type}' (ожидается префикс '${expectedPrefix}-')`);
      }
    }

    // Проверка на дубликаты ID
    if (allRequirements.has(req.id)) {
      error(`${file}: Дублирующийся ID '${req.id}' (также в ${allRequirements.get(req.id)._file})`);
    } else {
      req._file = file;
      req._filePath = filePath;
      allRequirements.set(req.id, req);
    }
  }

  // Валидация перечисления type
  if (req.type) {
    const validTypes = schema.properties.type.enum;
    if (!validTypes.includes(req.type)) {
      error(`${file}: Невалидный тип '${req.type}' (допустимые: ${validTypes.join(', ')})`);
    }
  }

  // Валидация перечисления status
  if (req.status) {
    const validStatuses = schema.properties.status.enum;
    if (!validStatuses.includes(req.status)) {
      error(`${file}: Невалидный статус '${req.status}' (допустимые: ${validStatuses.join(', ')})`);
    }
  }

  // Валидация перечисления priority
  if (req.priority) {
    const validPriorities = schema.properties.priority.enum;
    if (!validPriorities.includes(req.priority)) {
      error(`${file}: Невалидный приоритет '${req.priority}' (допустимые: ${validPriorities.join(', ')})`);
    }
  }

  // Проверка на неизвестные свойства
  const knownProperties = new Set(Object.keys(schema.properties));
  for (const key of Object.keys(req)) {
    if (key.startsWith('_')) continue; // внутренние поля
    if (!knownProperties.has(key)) {
      error(`${file}: Неизвестное свойство '${key}'`);
    }
  }
}

// Фаза 2: Валидация трассировки
info('Проверка ссылок трассировки...');

for (const [id, req] of allRequirements) {
  // Проверка существования ссылок traces_from
  if (Array.isArray(req.traces_from)) {
    for (const refId of req.traces_from) {
      if (!allRequirements.has(refId)) {
        error(`${req._file}: traces_from ссылается на несуществующее требование '${refId}'`);
      }
    }
  }

  // Проверка существования ссылок traces_to
  if (Array.isArray(req.traces_to)) {
    for (const refId of req.traces_to) {
      if (!allRequirements.has(refId)) {
        error(`${req._file}: traces_to ссылается на несуществующее требование '${refId}'`);
      }
    }
  }
}

// Фаза 3: Согласованность двунаправленной трассировки
info('Проверка согласованности двунаправленной трассировки...');

for (const [id, req] of allRequirements) {
  if (Array.isArray(req.traces_to)) {
    for (const refId of req.traces_to) {
      const target = allRequirements.get(refId);
      if (target && Array.isArray(target.traces_from)) {
        if (!target.traces_from.includes(id)) {
          warn(`${req._file}: '${id}' traces_to '${refId}', но '${refId}' не содержит traces_from '${id}'`);
        }
      }
    }
  }

  if (Array.isArray(req.traces_from)) {
    for (const refId of req.traces_from) {
      const source = allRequirements.get(refId);
      if (source && Array.isArray(source.traces_to)) {
        if (!source.traces_to.includes(id)) {
          warn(`${req._file}: '${id}' traces_from '${refId}', но '${refId}' не содержит traces_to '${id}'`);
        }
      }
    }
  }
}

// Фаза 4: Проверка существования файлов (только предупреждения)
info('Проверка ссылок на файлы реализации и тестов...');

const projectRoot = path.join(__dirname, '..');

for (const [id, req] of allRequirements) {
  if (Array.isArray(req.implementation_files)) {
    for (const file of req.implementation_files) {
      const absPath = path.join(projectRoot, file);
      if (!fs.existsSync(absPath)) {
        warn(`${req._file}: Файл реализации '${file}' не существует`);
      }
    }
  }

  if (Array.isArray(req.test_files)) {
    for (const file of req.test_files) {
      const absPath = path.join(projectRoot, file);
      if (!fs.existsSync(absPath)) {
        warn(`${req._file}: Файл тестов '${file}' не существует`);
      }
    }
  }
}

// Итоги
console.log('');
console.log('=== Итоги валидации ===');
console.log(`Требований: ${allRequirements.size}`);
console.log(`Ошибок: ${errors}`);
console.log(`Предупреждений: ${warnings}`);

if (errors > 0) {
  console.log('\nВалидация НЕ ПРОЙДЕНА');
  process.exit(1);
} else {
  console.log('\nВалидация ПРОЙДЕНА');
  process.exit(0);
}
