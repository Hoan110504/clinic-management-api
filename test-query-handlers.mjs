// Test query handlers with actual database
import { getQuery } from './src/config/queryWhitelist.js';
import { ROLES } from './src/config/constants.js';

async function testQueryHandlers() {
  console.log('Testing query handlers with database...');
  
  try {
    // Test 1: medicines_info query
    console.log('\n1. Testing medicines_info query...');
    const medicinesQuery = getQuery('medicines_info');
    if (medicinesQuery) {
      const medicinesResult = await medicinesQuery.handler(1, ROLES.DOCTOR);
      console.log('✅ Medicines query successful');
      console.log(`Found ${medicinesResult.length} medicines`);
      if (medicinesResult.length > 0) {
        console.log('Sample medicine:', {
          name: medicinesResult[0].name,
          price: medicinesResult[0].price,
          category: medicinesResult[0].category,
          inStock: medicinesResult[0].inStock
        });
      }
    }
    
    // Test 2: lab_services_info query
    console.log('\n2. Testing lab_services_info query...');
    const labServicesQuery = getQuery('lab_services_info');
    if (labServicesQuery) {
      const labServicesResult = await labServicesQuery.handler(1, ROLES.DOCTOR);
      console.log('✅ Lab services query successful');
      console.log(`Found ${labServicesResult.length} lab services`);
      if (labServicesResult.length > 0) {
        console.log('Sample lab service:', {
          serviceName: labServicesResult[0].serviceName,
          price: labServicesResult[0].price,
          serviceType: labServicesResult[0].serviceTypeDescription
        });
      }
    }
    
    // Test 3: clinic_info query
    console.log('\n3. Testing clinic_info query...');
    const clinicInfoQuery = getQuery('clinic_info');
    if (clinicInfoQuery) {
      const clinicInfoResult = await clinicInfoQuery.handler(1, ROLES.PATIENT);
      console.log('✅ Clinic info query successful');
      console.log('Clinic info:', {
        name: clinicInfoResult[0].clinicName,
        hours: clinicInfoResult[0].operatingHours.description,
        services: clinicInfoResult[0].services.slice(0, 3)
      });
    }
    
    // Test 4: service_prices query
    console.log('\n4. Testing service_prices query...');
    const servicePricesQuery = getQuery('service_prices');
    if (servicePricesQuery) {
      const servicePricesResult = await servicePricesQuery.handler(1, ROLES.PATIENT);
      console.log('✅ Service prices query successful');
      console.log(`Found ${servicePricesResult.length} services with prices`);
      if (servicePricesResult.length > 0) {
        console.log('Sample services:', servicePricesResult.slice(0, 3).map(s => ({
          name: s.serviceName,
          price: s.price,
          type: s.serviceType
        })));
      }
    }
    
    console.log('\n🎉 All query handlers are working with database!');
    
  } catch (error) {
    console.error('❌ Query handler test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testQueryHandlers();