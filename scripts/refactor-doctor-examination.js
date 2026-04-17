#!/usr/bin/env node
/**
 * Refactor DoctorExamination.jsx to remove ALL fallback patterns (||, ??, ?.)
 * and use ONLY direct database field names from schema.
 * 
 * This script reads the file, applies transformation patterns, and writes it back.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const filePath = path.resolve(__dirname, '../../frontend/src/pages/doctor/DoctorExamination.jsx');

console.log('Reading file:', filePath);
let content = fs.readFileSync(filePath, 'utf8');
const originalLength = content.length;

// ============================================================================
// STEP 1: Remove canonical helper functions (lines 40-175 approx)
// ============================================================================
console.log('Step 1: Removing canonical helper functions...');

// Remove: firstNonNullish helper
content = content.replace(
  /const firstNonNullish = \(\.\.\.\values\) => values\.find\(\(value\) => value !== null && value !== undefined\);\n/,
  ''
);

// Remove: getContextRecordId, getContextAppointmentId, getContextPatientId
content = content.replace(
  /const getContextRecordId = \(ctx\) => \{[\s\S]*?\}\;?\n/,
  ''
);
content = content.replace(
  /const getContextAppointmentId = \(ctx\) => \{[\s\S]*?\}\;?\n/,
  ''
);
content = content.replace(
  /const getContextPatientId = \(ctx\) => \{[\s\S]*?\}\;?\n/,
  ''
);

// Remove: findExistingSavedRecordIdForContext
content = content.replace(
  /const findExistingSavedRecordIdForContext = \(ctx\) => \{[\s\S]*?\};\n/,
  ''
);

// Remove: getContextIdsAsStrings
content = content.replace(
  /const getContextIdsAsStrings = \(ctx, options = \{\}\) => \{[\s\S]*?\};\n/,
  ''
);

// Remove: normalizeStringId
content = content.replace(
  /const normalizeStringId = \(value\) => \{[\s\S]*?\};\n/,
  ''
);

// Remove: getLabOrderRecordId, getLabOrderAppointmentId, getLabOrderPatientId, getLabOrderNameKey
content = content.replace(
  /const getLabOrder\w+Id = \(order\) => [\s\S]*?;\n/g,
  ''
);

// ============================================================================
// STEP 2: Replace fallback patterns with direct field access
// ============================================================================
console.log('Step 2: Replacing fallback patterns...');

// Pattern: `object?.field || defaultValue` → `object.field`
// Skip in strings and JSX attributes
let replacements = 0;

// Replace: `apt.statusCode ?? apt.status ?? null` → `apt.Status` (from Appointments schema)
content = content.replace(
  /apt\.statusCode \?\? apt\.status \?\? null/g,
  () => { replacements++; return 'apt.Status'; }
);

// Replace: `entry\.statusCode \?\? entry\.status \?\? null` → `entry.Status`
content = content.replace(
  /entry\.statusCode \?\? entry\.status \?\? null/g,
  () => { replacements++; return 'entry.Status'; }
);

// Replace: `String\(rawLabel \?\? ''\)\.toLowerCase\(\)` → `String(rawLabel).toLowerCase()`
content = content.replace(
  /String\(rawLabel \?\? ''\)\.toLowerCase\(\)/g,
  () => { replacements++; return 'String(rawLabel).toLowerCase()'; }
);

// Replace: `String(apt.status || '')`  → `String(apt.Status)`
content = content.replace(
  /String\(apt\.status \|\| ''\)/g,
  () => { replacements++; return 'String(apt.Status)'; }
);

// Replace: `apt.statusLabel || ''` → use direct Status field or add statusLabel transform
content = content.replace(
  /apt\.statusLabel \|\| ''/g,
  () => { replacements++; return 'apt.statusLabel'; }
);

// Replace optional chaining for image URL: `img.url || img.src || img.imageUrl || ...`
content = content.replace(
  /img\.url \|\| img\.src \|\| img\.imageUrl \|\| img\.dataUrl \|\| img\.path \|\| null/g,
  () => { replacements++; return 'img.ImageUrl'; }
);

// Replace optional chaining for parsed images
content = content.replace(
  /parsed\.url \|\| parsed\.src \|\| parsed\.imageUrl \|\| parsed\.dataUrl \|\| parsed\.path \|\| null/g,
  () => { replacements++; return 'parsed.ImageUrl'; }
);

// Replace optional chaining for appointment identity
content = content.replace(
  /apt\.id \|\| apt\.appointmentId/g,
  () => { replacements++; return 'apt.id'; }
);

// Replace optional chaining for patient data
content = content.replace(
  /patient\.appointmentRef\?\.id \|\| patient\.appointmentRef\?\.Id \|\| patient\.appointmentId/g,
  () => { replacements++; return 'patient.id'; }
);

// Replace lab test name fallback
content = content.replace(
  /order\.testName \|\| order\.name/g,
  () => { replacements++; return 'order.testName'; }
);

// Replace patient ID fallbacks
content = content.replace(
  /ctx\.patientId \|\| ctx\._originalPatientId \|\| ctx\.patient\?\.id/g,
  () => { replacements++; return 'ctx.PatientId'; }
);

// Replace medical record ID fallbacks
content = content.replace(
  /ctx\.id \|\| ctx\.medicalRecordId \|\| ctx\.recordId/g,
  () => { replacements++; return 'ctx.ExaminationID'; }
);

// Replace appointment ID fallbacks
content = content.replace(
  /ctx\.appointmentId \|\| ctx\.appointmentRef\?\.id/g,
  () => { replacements++; return 'ctx.AppointmentID'; }
);

// Remove nullish coalescing in template literals
content = content.replace(
  /String\(([\w.]+) \?\? ''\)/g,
  () => { replacements++; return 'String($1)'; }
);

console.log(`✓ Applied ${replacements} replacements`);

// ============================================================================
// STEP 3: Validate syntax (basic check)
// ============================================================================
console.log('Step 3: Basic syntax validation...');
const hasBraces = content.match(/\{/g)?.length;
const hasParens = content.match(/\(/g)?.length;
console.log(`   Braces: ${hasBraces}, Parentheses: ${hasParens}`);

// ============================================================================
// STEP 4: Write refactored file
// ============================================================================
console.log('Step 4: Writing refactored file...');
fs.writeFileSync(filePath, content, 'utf8');
const newLength = content.length;
console.log(`✓ File written successfully`);
console.log(`  Original size: ${originalLength} bytes`);
console.log(`  New size: ${newLength} bytes`);
console.log(`  Reduction: ${originalLength - newLength} bytes`);

console.log('\n✅ Refactoring complete!');
console.log('\nNext steps:');
console.log('1. Review the changes in: ' + filePath);
console.log('2. Run: npm run build (from frontend/)');
console.log('3. Fix any remaining compilation errors');
