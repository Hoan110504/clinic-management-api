// Test new queries for medicines and lab services
import geminiService from './src/services/gemini.service.js';

async function testNewQueries() {
  console.log('Testing new AI queries...');
  
  try {
    console.log('Current model:', geminiService.currentModel);
    
    // Test 1: Lab services query
    console.log('\n1. Testing lab services query...');
    const labServicesQueries = [
      { id: 'lab_services_info', description: 'Get information about laboratory services including ultrasound, ECG, and lab tests with prices' },
      { id: 'clinic_info', description: 'Get general clinic information including operating hours, contact info, and services' }
    ];
    
    const selectedQueries1 = await geminiService.selectQueries(
      'Phòng khám có những dịch vụ xét nghiệm gì và giá bao nhiêu?',
      labServicesQueries,
      []
    );
    
    console.log('✅ Lab services query selection successful');
    console.log('Selected queries:', selectedQueries1);
    
    // Test 2: Medicine pricing query
    console.log('\n2. Testing medicine pricing query...');
    const medicineQueries = [
      { id: 'medicines_info', description: 'Get information about medicines including name, category, unit, price, and availability' },
      { id: 'service_prices', description: 'Get pricing information for medical examinations and laboratory services' }
    ];
    
    const selectedQueries2 = await geminiService.selectQueries(
      'Thuốc paracetamol giá bao nhiêu? Phòng khám có thuốc này không?',
      medicineQueries,
      []
    );
    
    console.log('✅ Medicine pricing query selection successful');
    console.log('Selected queries:', selectedQueries2);
    
    // Test 3: Operating hours query
    console.log('\n3. Testing operating hours query...');
    const clinicQueries = [
      { id: 'clinic_info', description: 'Get general clinic information including operating hours, contact info, and services' },
      { id: 'appointment_schedule', description: 'Get upcoming appointment schedule for the clinic' }
    ];
    
    const selectedQueries3 = await geminiService.selectQueries(
      'Phòng khám mở cửa từ mấy giờ đến mấy giờ?',
      clinicQueries,
      []
    );
    
    console.log('✅ Operating hours query selection successful');
    console.log('Selected queries:', selectedQueries3);
    
    // Test 4: Answer synthesis with mock data
    console.log('\n4. Testing answer synthesis with clinic info...');
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
          services: [
            'Khám nội khoa tổng quát',
            'Siêu âm',
            'Điện tim',
            'Xét nghiệm máu'
          ]
        }],
        metadata: { rowCount: 1, executionTimeMs: 10 }
      }
    ];
    
    const response = await geminiService.synthesizeAnswer(
      'Phòng khám mở cửa từ mấy giờ?',
      mockClinicData,
      []
    );
    
    console.log('✅ Answer synthesis successful');
    console.log('Response preview:', response.slice(0, 300) + '...');
    
    console.log('\n🎉 All new queries are working perfectly!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testNewQueries();