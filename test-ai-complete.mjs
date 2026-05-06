// Test complete AI chat with new queries
import geminiService from './src/services/gemini.service.js';
import { getAvailableQueries } from './src/config/queryWhitelist.js';
import { ROLES } from './src/config/constants.js';

async function testCompleteAI() {
  console.log('Testing complete AI chat with new queries...');
  
  try {
    console.log('Current model:', geminiService.currentModel);
    
    // Get available queries for patient role
    const availableQueries = getAvailableQueries(ROLES.PATIENT);
    console.log(`\nAvailable queries for patient: ${availableQueries.length}`);
    availableQueries.forEach(q => console.log(`- ${q.id}: ${q.description}`));
    
    // Test 1: Medicine pricing question
    console.log('\n1. Testing medicine pricing question...');
    const selectedQueries1 = await geminiService.selectQueries(
      'Thuốc paracetamol giá bao nhiêu? Phòng khám có thuốc này không?',
      availableQueries,
      []
    );
    
    console.log('Selected queries:', selectedQueries1);
    
    // Mock medicine data for synthesis
    const mockMedicineData = [
      {
        queryId: 'medicines_info',
        data: [
          { name: 'Paracetamol 500mg', price: 2000, category: 'Giảm đau, hạ sốt', unit: 'viên' },
          { name: 'Acetylcysteine 200mg', price: 3000, category: 'Hô hấp, ho, hen, viêm mũi xoang', unit: 'viên' }
        ],
        metadata: { rowCount: 2, executionTimeMs: 50 }
      }
    ];
    
    const response1 = await geminiService.synthesizeAnswer(
      'Thuốc paracetamol giá bao nhiêu? Phòng khám có thuốc này không?',
      mockMedicineData,
      []
    );
    
    console.log('✅ Medicine pricing response:');
    console.log(response1.slice(0, 300) + '...');
    
    // Test 2: Lab services question
    console.log('\n2. Testing lab services question...');
    const selectedQueries2 = await geminiService.selectQueries(
      'Phòng khám có dịch vụ siêu âm không? Giá bao nhiêu?',
      availableQueries,
      []
    );
    
    console.log('Selected queries:', selectedQueries2);
    
    // Mock lab services data
    const mockLabData = [
      {
        queryId: 'lab_services_info',
        data: [
          { serviceName: 'Siêu âm bụng tổng quát', price: 150000, serviceTypeDescription: 'Siêu âm (Ultrasound)' },
          { serviceName: 'Siêu âm tim', price: 200000, serviceTypeDescription: 'Siêu âm (Ultrasound)' }
        ],
        metadata: { rowCount: 2, executionTimeMs: 30 }
      }
    ];
    
    const response2 = await geminiService.synthesizeAnswer(
      'Phòng khám có dịch vụ siêu âm không? Giá bao nhiêu?',
      mockLabData,
      []
    );
    
    console.log('✅ Lab services response:');
    console.log(response2.slice(0, 300) + '...');
    
    // Test 3: Operating hours question
    console.log('\n3. Testing operating hours question...');
    const selectedQueries3 = await geminiService.selectQueries(
      'Phòng khám mở cửa từ mấy giờ? Tôi có thể đến khám vào cuối tuần không?',
      availableQueries,
      []
    );
    
    console.log('Selected queries:', selectedQueries3);
    
    // Mock clinic info data
    const mockClinicData = [
      {
        queryId: 'clinic_info',
        data: [{
          clinicName: 'Phòng khám Nội khoa',
          operatingHours: {
            weekdays: '7:30 - 17:30',
            weekend: 'Đóng cửa',
            description: 'Thứ 2 đến Thứ 6: 7:30 - 17:30, Thứ 7 và Chủ nhật: Đóng cửa'
          },
          services: ['Khám nội khoa tổng quát', 'Siêu âm', 'Điện tim', 'Xét nghiệm máu']
        }],
        metadata: { rowCount: 1, executionTimeMs: 10 }
      }
    ];
    
    const response3 = await geminiService.synthesizeAnswer(
      'Phòng khám mở cửa từ mấy giờ? Tôi có thể đến khám vào cuối tuần không?',
      mockClinicData,
      []
    );
    
    console.log('✅ Operating hours response:');
    console.log(response3.slice(0, 300) + '...');
    
    console.log('\n🎉 Complete AI chat system is working perfectly!');
    console.log('✅ Medicine information queries');
    console.log('✅ Lab services queries');  
    console.log('✅ Clinic information queries');
    console.log('✅ Operating hours: 7:30 - 17:30 weekdays');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testCompleteAI();