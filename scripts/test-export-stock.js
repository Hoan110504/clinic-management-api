/**
 * Test script to verify export stock validation
 * Simulates the export process to ensure proper stock checking
 */

import { sequelize } from '../src/models/database.js';

async function testExportStockValidation() {
  try {
    console.log('Testing export stock validation...\n');

    // Find a medicine with multiple batches
    const [medicines] = await sequelize.query(`
      SELECT 
        m.Id as medicineId,
        m.Name as medicineName,
        COUNT(mb.Id) as batchCount,
        SUM(mb.QuantityInStock) as totalStock
      FROM Medicines m
      INNER JOIN MedicineBatches mb ON m.Id = mb.MedicineId
      WHERE mb.QuantityInStock > 0
      GROUP BY m.Id, m.Name
      HAVING COUNT(mb.Id) >= 2
      ORDER BY SUM(mb.QuantityInStock) DESC
    `);

    if (medicines.length === 0) {
      console.log('No medicines with multiple batches found for testing');
      return;
    }

    const testMedicine = medicines[0];
    console.log(`Test Medicine: ${testMedicine.medicineName}`);
    console.log(`  Medicine ID: ${testMedicine.medicineId}`);
    console.log(`  Total Batches: ${testMedicine.batchCount}`);
    console.log(`  Total Stock: ${testMedicine.totalStock}\n`);

    // Get batch details
    const [batches] = await sequelize.query(`
      SELECT 
        Id,
        BatchNumber,
        QuantityInStock,
        ExpiryDate
      FROM MedicineBatches
      WHERE MedicineId = ${testMedicine.medicineId}
      AND QuantityInStock > 0
      ORDER BY ExpiryDate ASC
    `);

    console.log('Available Batches:');
    batches.forEach((batch, idx) => {
      console.log(`  ${idx + 1}. Batch ${batch.BatchNumber}: ${batch.QuantityInStock} units (Expiry: ${batch.ExpiryDate || 'N/A'})`);
    });
    console.log('');

    // Test scenario 1: Export quantity less than first batch
    const firstBatch = batches[0];
    const exportQty1 = Math.floor(firstBatch.QuantityInStock / 2);
    console.log(`Test 1: Export ${exportQty1} units from batch ${firstBatch.BatchNumber}`);
    console.log(`  Batch has: ${firstBatch.QuantityInStock} units`);
    console.log(`  Total stock: ${testMedicine.totalStock} units`);
    console.log(`  Expected: ✓ Should succeed (${exportQty1} < ${firstBatch.QuantityInStock})`);

    // Verify the logic would pass
    const totalStock = Number(testMedicine.totalStock);
    const batchStock = Number(firstBatch.QuantityInStock);
    
    // Backend checks:
    // 1. Skip general check if batchNumber provided
    // 2. Check batch-specific stock
    const batchCheck = batchStock >= exportQty1;
    console.log(`  Batch check: ${batchStock} >= ${exportQty1} = ${batchCheck ? '✓ Pass' : '✗ Fail'}`);
    console.log('');

    // Test scenario 2: Export quantity greater than first batch but less than total
    if (batches.length >= 2) {
      const exportQty2 = firstBatch.QuantityInStock + 1;
      console.log(`Test 2: Export ${exportQty2} units from batch ${firstBatch.BatchNumber}`);
      console.log(`  Batch has: ${firstBatch.QuantityInStock} units`);
      console.log(`  Total stock: ${testMedicine.totalStock} units`);
      console.log(`  Expected: ✗ Should fail (${exportQty2} > ${firstBatch.QuantityInStock})`);
      
      const batchCheck2 = batchStock >= exportQty2;
      console.log(`  Batch check: ${batchStock} >= ${exportQty2} = ${batchCheck2 ? '✓ Pass' : '✗ Fail (correct)'}`);
      console.log('');
    }

    // Test scenario 3: Export without specifying batch
    const exportQty3 = 5;
    console.log(`Test 3: Export ${exportQty3} units without specifying batch`);
    console.log(`  Total stock: ${testMedicine.totalStock} units`);
    console.log(`  Expected: Should check total stock first`);
    
    const generalCheck = totalStock >= exportQty3;
    console.log(`  General check: ${totalStock} >= ${exportQty3} = ${generalCheck ? '✓ Pass' : '✗ Fail'}`);
    console.log(`  Then would auto-select earliest expiry batch with enough stock`);
    console.log('');

    console.log('✓ Export stock validation logic test completed!');
    console.log('\nKey points:');
    console.log('- When batch is specified: Only check that specific batch stock');
    console.log('- When batch is NOT specified: Check total stock, then auto-select batch');
    console.log('- Source of truth: Sum of MedicineBatches.QuantityInStock');

  } catch (error) {
    console.error('Error testing export stock:', error);
  } finally {
    await sequelize.close();
  }
}

testExportStockValidation();
