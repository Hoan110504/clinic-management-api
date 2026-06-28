/**
 * Test script to verify new patients count query
 */
import { sequelize } from '../src/models/database.js';

async function testNewPatientsCount() {
  try {
    console.log('Testing new patients count query...\n');

    // Test raw query
    const result = await sequelize.query(`
      SELECT COUNT(*) as count
      FROM [dbo].[Patients]
      WHERE YEAR([created_at]) = YEAR(GETDATE())
        AND MONTH([created_at]) = MONTH(GETDATE())
        AND [deleted_at] IS NULL
    `, {
      type: sequelize.QueryTypes.SELECT,
    });

    const count = (result && result[0]) ? parseInt(result[0].count) || 0 : 0;
    console.log('✓ New patients this month:', count);

    // Also check all patients with created_at
    const allPatientsResult = await sequelize.query(`
      SELECT 
        COUNT(*) as total,
        COUNT([created_at]) as with_created_at,
        MIN([created_at]) as earliest,
        MAX([created_at]) as latest
      FROM [dbo].[Patients]
      WHERE [deleted_at] IS NULL
    `, {
      type: sequelize.QueryTypes.SELECT,
    });

    console.log('\nPatient statistics:');
    console.log('- Total patients:', allPatientsResult[0].total);
    console.log('- With created_at:', allPatientsResult[0].with_created_at);
    console.log('- Earliest created:', allPatientsResult[0].earliest);
    console.log('- Latest created:', allPatientsResult[0].latest);

    // Check current month range
    const currentMonthResult = await sequelize.query(`
      SELECT 
        id,
        full_name,
        created_at
      FROM [dbo].[Patients]
      WHERE YEAR([created_at]) = YEAR(GETDATE())
        AND MONTH([created_at]) = MONTH(GETDATE())
        AND [deleted_at] IS NULL
      ORDER BY [created_at] DESC
    `, {
      type: sequelize.QueryTypes.SELECT,
    });

    console.log('\nPatients created this month:');
    if (currentMonthResult.length === 0) {
      console.log('(No patients created this month)');
    } else {
      currentMonthResult.forEach((p, idx) => {
        console.log(`${idx + 1}. ${p.full_name || 'N/A'} - ${p.created_at}`);
      });
    }

    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testNewPatientsCount();
