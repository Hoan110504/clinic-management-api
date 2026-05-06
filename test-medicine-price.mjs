// Test medicine price queries
import geminiService from './src/services/gemini.service.js';
import { getQuery, getAvailableQueries } from './src/config/queryWhitelist.js';
import { ROLES } from './src/config/constants.js';

async function testMedicinePrice() {
  console.log('Testing medicine price queries...');
  
  try {
    // Test 1: Check available queries for patient
    console.log('1. Available queries for patient:');
    const availableQueries = getAvailableQueries(ROLES.PATIENT);
    const medicineQueries = availableQueries.filter(q => 
      q.id.includes('medicine') || q.id.includes('service_prices')
    );
    console.log('Medicine-related queries:');
    medicineQueries.forEach(q => console.log(`- ${q.id}: ${q.description}`));
    
    // Test 2: Test medicines_info query directly
    console.log('\n2. Testing medicines_info query directly...');
    const medicinesQuery = getQuery('medicines_info');
    const medicinesData = await medicinesQuery.handler(1, ROLES.PATIENT);
    
    console.log(`✅ Found ${medicinesData.length} medicines`);
    if (medicinesData.length > 0) {
      console.log('Sample medicines with prices:');
      medicinesData.slice(0, 5).forEach(med => {
        console.log(`- ${med.name}: ${med.price} VNĐ (${med.category})`);
      });
    }
    
    // Test 3: AI query selection for medicine price question
    console.log('\n3. Testing AI query selection...');
    const selectedQueries = await geminiService.selectQueries(
      'Thuốc paracetamol giá bao nhiêu?',
      availableQueries,
      []
    );
    
    console.log('✅ Selected queries:', selectedQueries);
    
    // Test 4: Execute selected queries and get real data
    console.log('\n4. Executing selected queries...');
    let queryResults = [];
    
    for (const queryId of selectedQueries) {
      const query = getQuery(queryId);
      if (query) {
        try {
          const data = await query.handler(1, ROLES.PATIENT);
          queryResults.push({
            queryId,
            data,
            metadata: { rowCount: data.length, executionTimeMs: 50 }
          });
          console.log(`✅ ${queryId}: ${data.length} results`);
        } catch (error) {
          console.log(`❌ ${queryId}: ${error.message}`);
        }
      }
    }
    
    // Test 5: AI response synthesis with real data
    console.log('\n5. Testing AI response with real data...');
    if (queryResults.length > 0) {
      const response = await geminiService.synthesizeAnswer(
        'Thuốc paracetamol giá bao nhiêu?',
        queryResults,
        []
      );
      
      console.log('✅ AI Response:');
      console.log(response);
    } else {
      console.log('❌ No query results to synthesize');
    }
    
    // Test 6: Test with specific medicine search
    console.log('\n6. Testing medicine search...');
    const searchQuery = getQuery('medicine_search');
    if (searchQuery) {
      // Note: medicine_search needs searchTerm parameter
      console.log('Medicine search query exists but needs searchTerm parameter');
    }
    
    console.log('\n🎉 Medicine price test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testMedicinePrice();