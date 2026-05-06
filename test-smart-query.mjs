// Test smart query system
import geminiService from './src/services/gemini.service.js';
import { getQuery, getAvailableQueries } from './src/config/queryWhitelist.js';
import { ROLES } from './src/config/constants.js';
import queryHandler from './src/services/queryHandler.service.js';

async function testSmartQuery() {
  console.log('Testing smart query system...');
  
  try {
    // Test 1: Check new medicines_and_services query
    console.log('1. Testing medicines_and_services query...');
    const newQuery = getQuery('medicines_and_services');
    if (newQuery) {
      const data = await newQuery.handler(1, ROLES.PATIENT);
      console.log('✅ medicines_and_services query works');
      console.log(`Found ${data.totalMedicines} medicines and ${data.totalServices} services`);
      
      if (data.medicines.length > 0) {
        console.log('Sample medicines:');
        data.medicines.slice(0, 3).forEach(med => {
          console.log(`- ${med.name}: ${med.price} VNĐ (${med.category})`);
        });
      }
      
      if (data.services.length > 0) {
        console.log('Sample services:');
        data.services.slice(0, 3).forEach(svc => {
          console.log(`- ${svc.name}: ${svc.price} VNĐ (${svc.category})`);
        });
      }
    }
    
    // Test 2: AI query selection for price questions
    console.log('\n2. Testing AI query selection for price questions...');
    const availableQueries = getAvailableQueries(ROLES.PATIENT);
    console.log('Available queries:', availableQueries.map(q => q.id));
    
    const testQuestions = [
      'Thuốc paracetamol giá bao nhiêu?',
      'Siêu âm giá bao nhiêu?',
      'Giá thuốc và dịch vụ như thế nào?',
      'Phòng khám có thuốc aspirin không? Giá bao nhiêu?'
    ];
    
    for (const question of testQuestions) {
      console.log(`\nQuestion: "${question}"`);
      
      const selectedQueries = await geminiService.selectQueries(
        question,
        availableQueries,
        []
      );
      
      console.log('Selected queries:', selectedQueries);
      
      // Execute queries and get response
      if (selectedQueries.length > 0) {
        const queryResults = await queryHandler.executeMultipleQueries(
          selectedQueries,
          1,
          ROLES.PATIENT
        );
        
        const response = await geminiService.synthesizeAnswer(
          question,
          queryResults.map(r => ({
            queryId: r.query_id,
            data: r.data,
            metadata: { rowCount: r.row_count, executionTimeMs: r.execution_time_ms }
          })),
          []
        );
        
        console.log('AI Response preview:', response.slice(0, 200) + '...');
      }
    }
    
    console.log('\n🎉 Smart query system test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testSmartQuery();