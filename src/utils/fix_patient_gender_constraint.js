import { sequelize } from '../models/database.js';

async function fix() {
  try {
    await sequelize.authenticate();
    console.log('DB connected');

    // Find any check constraints that mention the gender column on Patients
    const [results] = await sequelize.query(
      "SELECT name, definition FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('Patients')"
    );

    if (!results || results.length === 0) {
      console.log('No check constraints found on table Patients');
    } else {
      const toDrop = results.filter(r => String(r.definition).toLowerCase().includes('gender'));
      if (toDrop.length === 0) {
        console.log('No gender-related check constraints found');
      } else {
        for (const r of toDrop) {
          console.log(`Dropping constraint: ${r.name}`);
          try {
            await sequelize.query(`ALTER TABLE [Patients] DROP CONSTRAINT [${r.name}]`);
            console.log('Dropped');
          } catch (err) {
            console.error('Failed to drop constraint', r.name, err.message || err);
          }
        }
      }
    }

    // Alter column to varchar null to be permissive
    try {
      console.log('Altering column gender to VARCHAR(255) NULL');
      await sequelize.query("ALTER TABLE [Patients] ALTER COLUMN [gender] VARCHAR(255) NULL");
      console.log('Altered column gender');
    } catch (err) {
      console.error('Failed to alter column gender:', err.message || err);
    }
  } catch (err) {
    console.error('Error:', err.message || err);
  } finally {
    await sequelize.close();
  }
}

fix().catch((e) => {
  console.error('Script failed', e);
  process.exit(1);
});
