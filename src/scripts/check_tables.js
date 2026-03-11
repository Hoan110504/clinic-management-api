import 'dotenv/config';
import { sequelize } from '../models/database.js';

(async () => {
  await sequelize.authenticate();
  const qi = sequelize.getQueryInterface();
  for (const t of ['BenhNhan', 'NguoiDung', 'LichHen', 'HoSoKham', 'patients', 'users', 'appointments']) {
    try {
      const d = await qi.describeTable(t);
      console.log(`${t}: ${Object.keys(d).join(', ')}`);
    } catch {
      console.log(`${t}: NOT FOUND`);
    }
  }
  process.exit(0);
})();
