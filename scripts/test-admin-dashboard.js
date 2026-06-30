/**
 * Test script to verify admin dashboard low stock count
 */

import { sequelize } from '../src/models/database.js';

async function testAdminDashboardLowStock() {
  try {
    console.log('Testing admin dashboard low stock count...\n');

    // Test the same query used in admin dashboard
    const result = await sequelize.query(`
      SELECT COUNT(*) as count
      FROM (
        SELECT m.Id
        FROM [dbo].[Medicines] m
        INNER JOIN [dbo].[MedicineBatches] mb ON m.Id = mb.MedicineId
        WHERE m.IsActive = 1
          AND mb.Status = 1
        GROUP BY m.Id
        HAVING SUM(mb.QuantityInStock) <= 50
      ) AS low_stock_medicines
    `, {
      type: sequelize.QueryTypes.SELECT,
    });

    const lowStockCount = result && result[0] ? parseInt(result[0].count) || 0 : 0;
    console.log(`Low Stock Count: ${lowStockCount}`);
    console.log('');

    // Get details of low stock medicines
    const details = await sequelize.query(`
      SELECT 
        m.Id as medicineId,
        m.Name as medicineName,
        m.Unit as unit,
        SUM(mb.QuantityInStock) as totalStock,
        COUNT(mb.Id) as batchCount
      FROM [dbo].[Medicines] m
      INNER JOIN [dbo].[MedicineBatches] mb ON m.Id = mb.MedicineId
      WHERE m.IsActive = 1
        AND mb.Status = 1
      GROUP BY m.Id, m.Name, m.Unit
      HAVING SUM(mb.QuantityInStock) <= 50
      ORDER BY SUM(mb.QuantityInStock) ASC
    `, {
      type: sequelize.QueryTypes.SELECT,
    });

    if (details.length > 0) {
      console.log('Low Stock Medicines Details:');
      details.forEach((med, idx) => {
        console.log(`${idx + 1}. ${med.medicineName}`);
        console.log(`   ID: ${med.medicineId}`);
        console.log(`   Total Stock: ${med.totalStock} ${med.unit}`);
        console.log(`   Batches: ${med.batchCount}`);
        console.log('');
      });
    } else {
      console.log('✓ No low stock medicines found (all medicines have stock > 50)');
    }

    console.log('Test completed successfully!');
    console.log(`\nSummary: Found ${lowStockCount} medicine(s) with low stock (≤50 units)`);

  } catch (error) {
    console.error('Error testing admin dashboard:', error);
  } finally {
    await sequelize.close();
  }
}

testAdminDashboardLowStock();
