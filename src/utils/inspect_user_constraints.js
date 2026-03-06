const { sequelize } = require('../models/database');

async function inspect() {
  try {
    await sequelize.authenticate();
    console.log('DB connected');
    const sql = `
      SELECT i.name AS index_name, i.is_unique, c.name AS column_name
      FROM sys.indexes i
      JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
      JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
      JOIN sys.tables t ON i.object_id = t.object_id
      WHERE t.name = 'users' AND i.is_unique = 1
      ORDER BY i.name;
    `;
    const [results] = await sequelize.query(sql, { raw: true });
    console.log('Unique indexes on users:');
    console.table(results);
  } catch (err) {
    console.error('Error inspecting constraints:', err);
  } finally {
    await sequelize.close();
  }
}

inspect();
