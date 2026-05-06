// Test specific medicine search
import geminiService from './src/services/gemini.service.js';
import { getAvailableQueries } from './src/config/queryWhitelist.js';
import { ROLES } from './src/config/constants.js';
import queryHandler from './src/services/queryHandler.service.js';

async function testSpecificMedicine() {
  console.log('Testing specific medicine search...');
  
  try {
    const availableQueries = getAvailableQueries(ROLES.PATIENT);
    
    const specificQuestions = [
      'Thuốc amoxicillin giá bao nhiêu?',
      'Có thuốc aspirin không? Giá thế nào?',
      'Thuốc paracetamol 500mg giá bao nhiêu?',
      'Thuốc ho có loại nào? Giá cả ra sao?'
    ];
    
    for (const question of specificQuestions) {
      console.log(`\n=== Testing: "${question}" ===`);
      
      // AI query selection
      const selectedQueries = await geminiService.selectQueries(
        question,
        availableQueries,
        []
      );
      
      console.log('Selected queries:', selectedQueries);
      
      // Execute queries
      const queryResults = await queryHandler.executeMultipleQueries(
        selectedQueries,
        1,
        ROLES.PATIENT
      );
      
      // Check if we got data
      queryResults.forEach(result => {
        if (result.data && result.data.medicines) {
          console.log(`✅ Found ${result.data.medicines.length} medicines in database`);
          
          // Look for specific medicines mentioned in question
          const questionLower = question.toLowerCase();
          const relevantMedicines = result.data.medicines.filter(med => 
            questionLower.includes(med.name.toLowerCase().split(' ')[0]) ||
            med.name.toLowerCase().includes('paracetamol') ||
            med.name.toLowerCase().includes('amoxicillin') ||
            med.name.toLowerCase().includes('aspirin') ||
            (questionLower.includes('ho') && med.category.toLowerCase().includes('hô hấp'))
          );
          
          if (relevantMedicines.length > 0) {
            console.log('Relevant medicines found:');
            relevantMedicines.forEach(med => {
              console.log(`- ${med.name}: ${med.price} VNĐ (${med.category})`);
            });
          } else {
            console.log('No directly matching medicines, but AI has access to all medicines');
          }
        }
      });
      
      // AI response
      const response = await geminiService.synthesizeAnswer(
        question,
        queryResults.map(r => ({
          queryId: r.query_id,
          data: r.data,
          metadata: { rowCount: r.row_count, executionTimeMs: r.execution_time_ms }
        })),
        []
      );
      
      console.log('AI Response:');
      console.log(response.slice(0, 400) + '...\n');
    }
    
    console.log('🎉 Specific medicine search test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testSpecificMedicine();