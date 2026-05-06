// Test simple medicines query without stock checking
import db from './src/models/index.js';

async function testSimpleMedicines() {
  console.log('Testing simple medicines query...');
  
  try {
    // Test basic medicines query without batches
    const medicines = await db.Medicine.findAll({
      where: {
        isActive: true
      },
      attributes: ['id', 'name', 'unit', 'category', 'price'],
      order: [['name', 'ASC']],
      limit: 10
    });
    
    console.log('✅ Basic medicines query successful');
    console.log(`Found ${medicines.length} medicines`);
    
    if (medicines.length > 0) {
      console.log('Sample medicines:');
      medicines.slice(0, 3).forEach(medicine => {
        console.log(`- ${medicine.name} (${medicine.category}) - ${medicine.price} VND`);
      });
    }
    
    // Test lab services
    console.log('\n2. Testing lab services...');
    const labServices = await db.LabService.findAll({
      where: {
        isActive: true
      },
      attributes: ['serviceId', 'serviceName', 'price', 'serviceType'],
      order: [['serviceName', 'ASC']],
      limit: 10
    });
    
    console.log('✅ Lab services query successful');
    console.log(`Found ${labServices.length} lab services`);
    
    if (labServices.length > 0) {
      console.log('Sample lab services:');
      labServices.slice(0, 3).forEach(service => {
        let serviceType = '';
        switch (service.serviceType) {
          case 1: serviceType = 'Siêu âm'; break;
          case 2: serviceType = 'Điện tim'; break;
          case 3: serviceType = 'Xét nghiệm'; break;
          default: serviceType = 'Khác';
        }
        console.log(`- ${service.serviceName} (${serviceType}) - ${service.price} VND`);
      });
    }
    
    console.log('\n🎉 Database queries are working!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testSimpleMedicines();