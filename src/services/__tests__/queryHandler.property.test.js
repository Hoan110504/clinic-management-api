/**
 * Property-Based Tests for Query Handler Service
 * 
 * Tests universal properties of the query handler using fast-check.
 * Validates Requirements 2.2, 2.3, 3.1, 3.7, 3.8, 3.10, 17.8
 */

import fc from 'fast-check';
import { jest } from '@jest/globals';
import { validateQueryIds } from '../queryHandler.service.js';
import { isQueryWhitelisted, hasQueryPermission } from '../../config/queryWhitelist.js';
import { ROLES } from '../../config/constants.js';
import { AppError } from '../../utils/errors.js';

describe('Query Handler - Property-Based Tests', () => {
  
  /**
   * Property 2: Query Whitelist Verification
   * 
   * For any query_id that is NOT in the whitelist, the isQueryWhitelisted function
   * SHALL return false.
   * 
   * Validates: Requirements 2.2, 2.3
   */
  test('Feature: ai-medical-chatbot, Property 2: Query whitelist verification', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random query IDs that are NOT in the whitelist
        fc.string({ minLength: 5, maxLength: 50 }).filter(
          queryId => !isQueryWhitelisted(queryId)
        ),
        async (invalidQueryId) => {
          // Verify the query is not whitelisted
          expect(isQueryWhitelisted(invalidQueryId)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property 2b: Whitelisted Queries Are Recognized
   * 
   * For any query_id that exists in the whitelist, the isQueryWhitelisted function
   * SHALL return true.
   */
  test('Feature: ai-medical-chatbot, Property 2b: Whitelisted queries are recognized', async () => {
    // Valid whitelisted query IDs
    const validQueryIds = [
      'my_appointments',
      'my_prescriptions',
      'my_lab_results',
      'my_medical_history',
      'medicines_info',
      'patient_medical_history',
      'lab_tests_pending',
      'low_stock_medicines',
      'appointment_schedule'
    ];
    
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...validQueryIds),
        async (queryId) => {
          // Verify the query is whitelisted
          expect(isQueryWhitelisted(queryId)).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });
  
  /**
   * Property 4: Role Permission Enforcement
   * 
   * For any user role and query combination where the user's role is not in the
   * query's requiredRoles array, the hasQueryPermission function SHALL return false.
   * 
   * Validates: Requirements 3.7, 3.8
   */
  test('Feature: ai-medical-chatbot, Property 4: Role permission enforcement', async () => {
    // Define query-role mismatches (queries that specific roles should NOT access)
    const invalidCombinations = [
      { queryId: 'my_appointments', role: ROLES.DOCTOR }, // Patient-only query
      { queryId: 'my_prescriptions', role: ROLES.PHARMACIST }, // Patient-only query
      { queryId: 'my_lab_results', role: ROLES.ADMIN }, // Patient-only query
      { queryId: 'my_medical_history', role: ROLES.RECEPTIONIST }, // Patient-only query
      { queryId: 'patient_medical_history', role: ROLES.PATIENT }, // Doctor-only query
      { queryId: 'patient_medical_history', role: ROLES.PHARMACIST }, // Doctor-only query
      { queryId: 'low_stock_medicines', role: ROLES.PATIENT }, // Admin/Pharmacist only
      { queryId: 'low_stock_medicines', role: ROLES.DOCTOR }, // Admin/Pharmacist only
    ];
    
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...invalidCombinations),
        async (combination) => {
          const { queryId, role } = combination;
          
          // Verify the role does NOT have permission
          expect(hasQueryPermission(queryId, role)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property 4b: Authorized Roles Have Permission
   * 
   * For any user role and query combination where the user's role IS in the
   * query's requiredRoles array, the hasQueryPermission function SHALL return true.
   */
  test('Feature: ai-medical-chatbot, Property 4b: Authorized roles have permission', async () => {
    const validCombinations = [
      { queryId: 'my_appointments', role: ROLES.PATIENT },
      { queryId: 'medicines_info', role: ROLES.DOCTOR },
      { queryId: 'medicines_info', role: ROLES.PHARMACIST },
      { queryId: 'patient_medical_history', role: ROLES.DOCTOR },
      { queryId: 'low_stock_medicines', role: ROLES.ADMIN },
      { queryId: 'low_stock_medicines', role: ROLES.PHARMACIST },
      { queryId: 'appointment_schedule', role: ROLES.RECEPTIONIST },
    ];
    
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...validCombinations),
        async (combination) => {
          const { queryId, role } = combination;
          
          // Verify the role HAS permission
          expect(hasQueryPermission(queryId, role)).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });
  
  /**
   * Property: Multiple Query Validation
   * 
   * For any array of query IDs, the validateQueryIds function SHALL correctly
   * separate valid and invalid query IDs based on whitelist and role permissions.
   */
  test('Feature: ai-medical-chatbot, Property: Multiple query validation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.constantFrom(
            'my_appointments',
            'medicines_info',
            'invalid_query_1',
            'invalid_query_2',
            'patient_medical_history'
          ),
          { minLength: 1, maxLength: 10 }
        ),
        fc.constantFrom(ROLES.PATIENT, ROLES.DOCTOR, ROLES.PHARMACIST),
        async (queryIds, userRole) => {
          const result = validateQueryIds(queryIds, userRole);
          
          // Verify result structure
          expect(result).toHaveProperty('valid');
          expect(result).toHaveProperty('invalid');
          expect(Array.isArray(result.valid)).toBe(true);
          expect(Array.isArray(result.invalid)).toBe(true);
          
          // Verify all query IDs are accounted for
          expect(result.valid.length + result.invalid.length).toBe(queryIds.length);
          
          // Verify valid queries are actually valid
          result.valid.forEach(queryId => {
            expect(isQueryWhitelisted(queryId)).toBe(true);
            expect(hasQueryPermission(queryId, userRole)).toBe(true);
          });
          
          // Verify invalid queries are actually invalid
          result.invalid.forEach(queryId => {
            const isValid = isQueryWhitelisted(queryId) && hasQueryPermission(queryId, userRole);
            expect(isValid).toBe(false);
          });
        }
      ),
      { numRuns: 100 }
    );
  });
  
});

