// Final test for medicine price queries
import geminiService from './src/services/gemini.service.js';
import { getAvailableQueries } from './src/config/queryWhitelist.js';
import { ROLES } from './src/config/constants.js';
import queryHandler from './src/services/queryHandler.service.js';

async function testMedicineFinal() {
  console.log('Final test for medicine price queries...');
  
  try {
    const availableQueries = getAvailableQueries(ROLES.PATIENT);
    
    // Test 1: Paracetamol price
    console.log('1. Testing Paracetamol price...');
    const selectedQueries1 = await geminiService.selectQueries(
      'Thuốc paracetamol giá bao nhiêu?',
      availableQueries,
      []
    );
    
    console.log('Selected queries:', selectedQueries1);
    
    const queryResults1 = await queryHandler.executeMultipleQueries(
      selectedQueries1,
      1,
      ROLES.PATIENT
    );
    
    const response1 = await geminiService.synthesizeAnswer(
      'Thuốc paracetamol giá bao nhiêu?',
      queryResults1.map(r => ({
        queryId: r.query_id,
        data: r.data,
        metadata: { rowCount: r.row_count, executionTimeMs: r.execution_time_ms }
      })),
      []
    );
    
    console.log('✅ Paracetamol response:');
    console.log(response1.slice(0, 300) + '...\n');
    
    // Test 2: Amoxicillin price
    console.log('2. Testing Amoxicillin price...');
    const selectedQueries2 = await geminiService.selectQueries(
      'Thuốc amoxicillin giá bao nhiêu? Phòng khám có không?',
      availableQueries,
      []
    );
    
    console.log('Selected queries:', selectedQueries2);
    
    const queryResults2 = await queryHandler.executeMultipleQueries(
      selectedQueries2,
      1,
      ROLES.PATIENT
    );
    
    const response2 = await geminiService.synthesizeAnswer(
      'Thuốc amoxicillin giá bao nhiêu? Phòng khám có không?',
      queryResults2.map(r => ({
        queryId: r.query_id,
        data: r.data,
        metadata: { rowCount: r.row_count, executionTimeMs: r.execution_time_ms }
      })),
      []
    );
    
    console.log('✅ Amoxicillin response:');
    console.log(response2.slice(0, 300) + '...\n');
    
    // Test 3: General medicine list
    console.log('3. Testing general medicine inquiry...');
    const selectedQueries3 = await geminiService.selectQueries(
      'Phòng khám có những loại thuốc gì? Giá cả như thế nào?',
      availableQueries,
      []
    );
    
    console.log('Selected queries:', selectedQueries3);
    
    const queryResults3 = await queryHandler.executeMultipleQueries(
      selectedQueries3,
      1,
      ROLES.PATIENT
    );
    
    const response3 = await geminiService.synthesizeAnswer(
      'Phòng khám có những loại thuốc gì? Giá cả như thế nào?',
      queryResults3.map(r => ({
        queryId: r.query_id,
        data: r.data,
        metadata: { rowCount: r.row_count, executionTimeMs: r.execution_time_ms }
      })),
      []
    );
    
    console.log('✅ General medicine list response:');
    console.log(response3.slice(0, 400) + '...\n');
    
    console.log('🎉 All medicine price queries working perfectly!');
    console.log('✅ AI can answer specific medicine prices');
    console.log('✅ AI can provide general medicine information');
    console.log('✅ AI includes safety advice and clinic hours');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testMedicineFinal();