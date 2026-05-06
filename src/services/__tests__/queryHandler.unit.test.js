/**
 * Unit Tests for Query Handler Service
 * 
 * Tests specific examples, edge cases, and error conditions for the query handler.
 * Validates Requirements 22.4 for role-based filtering, error handling, and result parsing.
 * 
 * Note: These tests focus on validation and formatting functions.
 * Integration tests with actual database will be added separately.
 */

import { jest } from '@jest/globals';
import {
  validateQueryIds,
  getQueryStats,
  formatQueryResultsForAI
} from '../queryHandler.service.js';
import { ROLES } from '../../config/constants.js';

describe('Query Handler Service - Unit Tests', () => {
  describe('validateQueryIds', () => {
    
    test('should separate valid and invalid query IDs', () => {
      const queryIds = [
        'my_appointments',
        'invalid_query',
        'medicines_info',
        'another_invalid'
      ];
      const userRole = ROLES.PATIENT;
      
      const result = validateQueryIds(queryIds, userRole);
      
      expect(result.valid).toContain('my_appointments');
      expect(result.invalid).toContain('invalid_query');
      expect(result.invalid).toContain('medicines_info'); // Patient can't access this
      expect(result.invalid).toContain('another_invalid');
    });
    
    test('should return all valid for authorized queries', () => {
      const queryIds = ['my_appointments', 'my_prescriptions', 'my_lab_results'];
      const userRole = ROLES.PATIENT;
      
      const result = validateQueryIds(queryIds, userRole);
      
      expect(result.valid).toHaveLength(3);
      expect(result.invalid).toHaveLength(0);
    });
    
    test('should return all invalid for unauthorized queries', () => {
      const queryIds = ['patient_medical_history', 'low_stock_medicines'];
      const userRole = ROLES.PATIENT;
      
      const result = validateQueryIds(queryIds, userRole);
      
      expect(result.valid).toHaveLength(0);
      expect(result.invalid).toHaveLength(2);
    });
    
    test('should handle empty array', () => {
      const result = validateQueryIds([], ROLES.DOCTOR);
      
      expect(result.valid).toEqual([]);
      expect(result.invalid).toEqual([]);
    });
    
    test('should handle non-array input', () => {
      const result = validateQueryIds('not_an_array', ROLES.DOCTOR);
      
      expect(result.valid).toEqual([]);
      expect(result.invalid).toEqual([]);
    });
    
  });
  
  describe('getQueryStats', () => {
    
    test('should extract statistics from query result', () => {
      const queryResult = {
        query_id: 'my_appointments',
        row_count: 5,
        execution_time_ms: 150,
        data: [{ id: 1 }, { id: 2 }],
        timestamp: '2024-01-15T10:00:00Z'
      };
      
      const stats = getQueryStats(queryResult);
      
      expect(stats.queryId).toBe('my_appointments');
      expect(stats.rowCount).toBe(5);
      expect(stats.executionTimeMs).toBe(150);
      expect(stats.hasData).toBe(true);
      expect(stats.hasError).toBe(false);
      expect(stats.timestamp).toBe('2024-01-15T10:00:00Z');
    });
    
    test('should detect error in query result', () => {
      const queryResult = {
        query_id: 'failed_query',
        row_count: 0,
        execution_time_ms: 0,
        data: null,
        error: 'Query execution failed',
        timestamp: '2024-01-15T10:00:00Z'
      };
      
      const stats = getQueryStats(queryResult);
      
      expect(stats.hasData).toBe(false);
      expect(stats.hasError).toBe(true);
    });
    
  });
  
  describe('formatQueryResultsForAI', () => {
    
    test('should format single query result', () => {
      const queryResults = [
        {
          query_id: 'medicines_info',
          row_count: 2,
          execution_time_ms: 50,
          data: [
            { id: 1, name: 'Paracetamol' },
            { id: 2, name: 'Amoxicillin' }
          ]
        }
      ];
      
      const formatted = formatQueryResultsForAI(queryResults);
      
      expect(formatted).toContain('Query: medicines_info');
      expect(formatted).toContain('Rows: 2');
      expect(formatted).toContain('Execution Time: 50ms');
      expect(formatted).toContain('Paracetamol');
      expect(formatted).toContain('Amoxicillin');
    });
    
    test('should format multiple query results', () => {
      const queryResults = [
        {
          query_id: 'query1',
          row_count: 1,
          execution_time_ms: 30,
          data: [{ id: 1 }]
        },
        {
          query_id: 'query2',
          row_count: 2,
          execution_time_ms: 40,
          data: [{ id: 2 }, { id: 3 }]
        }
      ];
      
      const formatted = formatQueryResultsForAI(queryResults);
      
      expect(formatted).toContain('Query: query1');
      expect(formatted).toContain('Query: query2');
      expect(formatted).toContain('---'); // Separator
    });
    
    test('should handle empty result set', () => {
      const queryResults = [
        {
          query_id: 'empty_query',
          row_count: 0,
          execution_time_ms: 20,
          data: []
        }
      ];
      
      const formatted = formatQueryResultsForAI(queryResults);
      
      expect(formatted).toContain('Query: empty_query');
      expect(formatted).toContain('Empty result set');
    });
    
    test('should handle null data', () => {
      const queryResults = [
        {
          query_id: 'null_query',
          row_count: 0,
          execution_time_ms: 10,
          data: null
        }
      ];
      
      const formatted = formatQueryResultsForAI(queryResults);
      
      expect(formatted).toContain('Query: null_query');
      expect(formatted).toContain('No data');
    });
    
    test('should handle query errors', () => {
      const queryResults = [
        {
          query_id: 'failed_query',
          row_count: 0,
          execution_time_ms: 0,
          data: null,
          error: 'Database connection failed'
        }
      ];
      
      const formatted = formatQueryResultsForAI(queryResults);
      
      expect(formatted).toContain('Query: failed_query');
      expect(formatted).toContain('Status: Error');
      expect(formatted).toContain('Database connection failed');
    });
    
    test('should return message for empty array', () => {
      const formatted = formatQueryResultsForAI([]);
      expect(formatted).toBe('No query results available.');
    });
    
    test('should return message for non-array input', () => {
      const formatted = formatQueryResultsForAI(null);
      expect(formatted).toBe('No query results available.');
    });
    
  });
  
});

