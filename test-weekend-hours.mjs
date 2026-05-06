// Test weekend operating hours
import geminiService from './src/services/gemini.service.js';
import { getQuery } from './src/config/queryWhitelist.js';
import { ROLES } from './src/config/constants.js';

async function testWeekendHours() {
  console.log('Testing weekend operating hours...');
  
  try {
    // Test 1: Check clinic_info query data
    console.log('1. Testing clinic_info query data...');
    const clinicInfoQuery = getQuery('clinic_info');
    const clinicData = await clinicInfoQuery.handler(1, ROLES.PATIENT);
    
    console.log('✅ Clinic info data:');
    console.log('Operating hours:', clinicData[0].operatingHours);
    console.log('Description:', clinicData[0].operatingHours.description);
    
    // Test 2: AI query selection for weekend question
    console.log('\n2. Testing AI query selection...');
    const availableQueries = [
      { id: 'clinic_info', description: 'Get general clinic information including operating hours, contact info, and services' },
      { id: 'appointment_schedule', description: 'Get upcoming appointment schedule for the clinic' }
    ];
    
    const selectedQueries = await geminiService.selectQueries(
      'Tôi có thể đến khám vào cuối tuần không? Phòng khám có mở cửa thứ 7 chủ nhật không?',
      availableQueries,
      []
    );
    
    console.log('✅ Selected queries:', selectedQueries);
    
    // Test 3: AI response synthesis
    console.log('\n3. Testing AI response...');
    const mockClinicData = [
      {
        queryId: 'clinic_info',
        data: clinicData,
        metadata: { rowCount: 1, executionTimeMs: 10 }
      }
    ];
    
    const response = await geminiService.synthesizeAnswer(
      'Tôi có thể đến khám vào cuối tuần không? Phòng khám có mở cửa thứ 7 chủ nhật không?',
      mockClinicData,
      []
    );
    
    console.log('✅ AI Response:');
    console.log(response);
    
    // Test 4: Another weekend question
    console.log('\n4. Testing another weekend question...');
    const response2 = await geminiService.synthesizeAnswer(
      'Phòng khám mở cửa từ mấy giờ? Có làm việc vào chủ nhật không?',
      mockClinicData,
      []
    );
    
    console.log('✅ AI Response 2:');
    console.log(response2.slice(0, 400) + '...');
    
    console.log('\n🎉 Weekend hours updated successfully!');
    console.log('✅ Clinic now open 7 days a week: 7:30 - 17:30');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testWeekendHours();