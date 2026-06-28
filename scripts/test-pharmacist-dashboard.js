/**
 * Test script to verify pharmacist dashboard queries
 */
import { sequelize } from '../src/models/database.js';

async function testPharmacistDashboard() {
  try {
    console.log('Testing Pharmacist Dashboard queries...\n');

    // Test 1: Low stock medicines
    console.log('1. Testing Low Stock Medicines:');
    const lowStockMedicines = await sequelize.query(`
      SELECT TOP 10
        m.Id as id,
        m.Name as name,
        m.Unit as unit,
        SUM(mb.QuantityInStock) as total_quantity,
        COUNT(mb.Id) as batch_count
      FROM [dbo].[Medicines] m
      INNER JOIN [dbo].[MedicineBatches] mb ON m.Id = mb.MedicineId
      WHERE m.IsActive = 1
        AND mb.Status = 1
      GROUP BY m.Id, m.Name, m.Unit
      HAVING SUM(mb.QuantityInStock) <= 50
      ORDER BY SUM(mb.QuantityInStock) ASC, m.Name ASC
    `, {
      type: sequelize.QueryTypes.SELECT,
    });

    console.log(`   Found ${lowStockMedicines.length} low stock medicines:`);
    if (lowStockMedicines.length === 0) {
      console.log('   (No medicines with low stock)');
    } else {
      lowStockMedicines.forEach((m, idx) => {
        console.log(`   ${idx + 1}. ${m.name} - Tồn: ${m.total_quantity} ${m.unit || ''} (${m.batch_count} lô)`);
      });
    }

    // Test 2: Expiring medicines (30 days)
    console.log('\n2. Testing Expiring Medicines (next 30 days):');
    const expiringMedicines = await sequelize.query(`
      SELECT TOP 10
        m.Id as id,
        m.Name as name,
        m.Unit as unit,
        mb.BatchNumber as batch_number,
        mb.QuantityInStock as quantity,
        mb.ExpiryDate as expiry_date,
        DATEDIFF(DAY, GETDATE(), mb.ExpiryDate) as days_until_expiry
      FROM [dbo].[MedicineBatches] mb
      INNER JOIN [dbo].[Medicines] m ON mb.MedicineId = m.Id
      WHERE m.IsActive = 1
        AND mb.Status = 1
        AND mb.ExpiryDate IS NOT NULL
        AND mb.ExpiryDate >= CAST(GETDATE() AS DATE)
        AND mb.ExpiryDate <= DATEADD(DAY, 30, GETDATE())
      ORDER BY mb.ExpiryDate ASC, m.Name ASC
    `, {
      type: sequelize.QueryTypes.SELECT,
    });

    console.log(`   Found ${expiringMedicines.length} expiring medicines:`);
    if (expiringMedicines.length === 0) {
      console.log('   (No medicines expiring in next 30 days)');
    } else {
      expiringMedicines.forEach((m, idx) => {
        const expiryDate = new Date(m.expiry_date).toLocaleDateString('vi-VN');
        console.log(`   ${idx + 1}. ${m.name} (Lô: ${m.batch_number}) - HSD: ${expiryDate} (còn ${m.days_until_expiry} ngày) - Tồn: ${m.quantity} ${m.unit || ''}`);
      });
    }

    // Test 3: All medicines statistics
    console.log('\n3. Overall Medicine Statistics:');
    const stats = await sequelize.query(`
      SELECT 
        COUNT(DISTINCT m.Id) as total_medicines,
        COUNT(mb.Id) as total_batches,
        SUM(mb.QuantityInStock) as total_quantity,
        COUNT(CASE WHEN mb.ExpiryDate IS NOT NULL 
                        AND mb.ExpiryDate >= CAST(GETDATE() AS DATE)
                        AND mb.ExpiryDate <= DATEADD(DAY, 30, GETDATE()) 
              THEN 1 END) as expiring_batches
      FROM [dbo].[Medicines] m
      LEFT JOIN [dbo].[MedicineBatches] mb ON m.Id = mb.MedicineId AND mb.Status = 1
      WHERE m.IsActive = 1
    `, {
      type: sequelize.QueryTypes.SELECT,
    });

    console.log(`   Total active medicines: ${stats[0].total_medicines}`);
    console.log(`   Total batches in stock: ${stats[0].total_batches}`);
    console.log(`   Total quantity: ${stats[0].total_quantity}`);
    console.log(`   Expiring batches (30 days): ${stats[0].expiring_batches}`);

    await sequelize.close();
    console.log('\n✓ All tests completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testPharmacistDashboard();
