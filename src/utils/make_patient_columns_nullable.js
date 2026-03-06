const { sequelize } = require('../models/database');

async function alter() {
  try {
    await sequelize.authenticate();
    console.log('DB connected');

    const stmts = [
      "ALTER TABLE [patients] ALTER COLUMN [date_of_birth] DATE NULL",
      "ALTER TABLE [patients] ALTER COLUMN [gender] VARCHAR(255) NULL",
      "ALTER TABLE [patients] ALTER COLUMN [phone] NVARCHAR(15) NULL",
    ];

    for (const s of stmts) {
      try {
        console.log('Executing:', s);
        await sequelize.query(s);
        console.log('OK');
      } catch (e) {
        console.error('Failed:', e.message);
      }
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await sequelize.close();
  }
}

alter();
