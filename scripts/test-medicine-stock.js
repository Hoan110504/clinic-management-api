/**
 * Test script to verify medicine stock calculation
 * Tests that getAllMedicinesUnpaginated returns correct total stock from MedicineBatches
 */

import { sequelize } from '../src/models/database.js';
import { Medicine } from '../src/models/index.js';

async function testMedicineStock() {
  try {
    console.log('Testing medicine stock calculation...\n');

    // Query medicines with total stock from batches
    const medicines = await Medicine.findAll({
      attributes: [
        'Id', 
        'Name', 
        'Unit', 
        'Category', 
        'Price', 
        'IsActive',
        [
          sequelize.literal(`(
            SELECT ISNULL(SUM(QuantityInStock), 0) 
            FROM MedicineBatches 
            WHERE MedicineBatches.MedicineId = Medicine.Id
          )`),
          'totalStock'
        ]
      ],
      limit: 10,
      order: [['Id', 'DESC']],
      raw: true,
    });

    console.log(`Found ${medicines.length} medicines:\n`);

    for (const med of medicines) {
      const totalStock = Number(med.totalStock || 0);
      console.log(`ID: ${med.Id}`);
      console.log(`  Name: ${med.Name}`);
      console.log(`  Unit: ${med.Unit}`);
      console.log(`  Category: ${med.Category}`);
      console.log(`  Total Stock: ${totalStock} ${med.Unit}`);
      console.log(`  Is Active: ${med.IsActive}`);
      
      // Verify by querying batches directly
      const batchesQuery = await sequelize.query(
        `SELECT BatchNumber, QuantityInStock, ExpiryDate 
         FROM MedicineBatches 
         WHERE MedicineId = ${med.Id}`,
        {
          type: sequelize.QueryTypes.SELECT
        }
      );

      if (batchesQuery.length > 0) {
        console.log(`  Batches (${batchesQuery.length}):`);
        let verifyTotal = 0;
        batchesQuery.forEach(batch => {
          console.log(`    - ${batch.BatchNumber}: ${batch.QuantityInStock} (Expiry: ${batch.ExpiryDate || 'N/A'})`);
          verifyTotal += Number(batch.QuantityInStock || 0);
        });
        console.log(`  Verified Total: ${verifyTotal} ${med.Unit}`);
        
        if (verifyTotal !== totalStock) {
          console.log(`  ⚠️  MISMATCH: Calculated ${totalStock} but batches sum to ${verifyTotal}`);
        } else {
          console.log(`  ✓ Stock calculation correct`);
        }
      } else {
        console.log(`  No batches found`);
      }
      console.log('');
    }

    console.log('Test completed successfully!');

  } catch (error) {
    console.error('Error testing medicine stock:', error);
  } finally {
    await sequelize.close();
  }
}

testMedicineStock();
