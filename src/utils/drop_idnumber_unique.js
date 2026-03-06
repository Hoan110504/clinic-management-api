const { sequelize } = require('../models/database');

async function dropConstraint() {
  try {
    await sequelize.authenticate();
    console.log('DB connected');

    const findSql = `
      SELECT i.name AS index_name
      FROM sys.indexes i
      JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
      JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
      JOIN sys.tables t ON i.object_id = t.object_id
      WHERE t.name = 'users' AND c.name = 'id_number' AND i.is_unique = 1
    `;

    const [rows] = await sequelize.query(findSql, { raw: true });
    if (!rows || rows.length === 0) {
      console.log('No unique constraint on id_number found');
      return;
    }

    for (const r of rows) {
      const constraintName = r.index_name;
      console.log('Dropping constraint', constraintName);
      const dropSql = `ALTER TABLE [users] DROP CONSTRAINT [${constraintName}]`;
      await sequelize.query(dropSql);
      console.log('Dropped', constraintName);
    }
  } catch (err) {
    console.error('Error dropping constraint:', err);
  } finally {
    await sequelize.close();
  }
}

dropConstraint();
