/**
 * Models Index - Tải và thiết lập quan hệ cho tất cả models
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sequelize, Sequelize, connectDatabase, syncDatabase } from './database.js';

// Tự động load tất cả model factories trong cùng thư mục (hỗ trợ ESM và CJS)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const models = {};

const files = fs.readdirSync(__dirname).filter((f) => f.endsWith('.js') && f !== 'index.js' && f !== 'database.js');

for (const file of files) {
  const filePath = path.join(__dirname, file);
  const content = fs.readFileSync(filePath, 'utf8');
  let factory;

  // Heuristic: if file contains CommonJS patterns, use require
  const looksLikeCJS = /module\.exports|exports\.|require\(/.test(content);
  if (looksLikeCJS) {
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    // Evaluate CommonJS file in a VM with a fake module to capture module.exports
    const vm = await import('vm');
    const mod = { exports: {} };
    const script = new vm.Script(content, { filename: filePath });
    const context = vm.createContext({ module: mod, exports: mod.exports, require, __filename: filePath, __dirname: path.dirname(filePath) });
    script.runInContext(context);
    factory = mod.exports;
  } else {
    const mod = await import(`./${file}`);
    factory = mod.default || mod;
  }

  if (typeof factory === 'function') {
    const model = factory(sequelize, Sequelize.DataTypes);
    models[model.name] = model;
  }
}

// Thiết lập associations sau khi tất cả models đã được load
Object.keys(models).forEach((modelName) => {
  if (typeof models[modelName].associate === 'function') {
    models[modelName].associate(models);
  }
});

// Export tất cả models (dùng spread để đảm bảo cập nhật tên dynamic)
export default models;
export { sequelize, Sequelize, connectDatabase, syncDatabase };

// Đồng thời export tên phổ biến nếu tồn tại để tiện import riêng lẻ
export const User = models.User;
export const Patient = models.Patient;
export const Appointment = models.Appointment;
// MedicalRecord uses the English model (STRING PK, patient_id / doctor_id columns)
// If the project has the legacy Vietnamese models (HoSoKham), prefer exporting that
// as the primary `MedicalRecord` export so existing DB schema (HoSoKham table)
// continues to work. If there is an English `MedicalRecord` model, it will
// still be available in `models.MedicalRecord`.
export const MedicalRecord = models.HoSoKham || models.MedicalRecord;
// Keep a dedicated alias for the legacy model name
export const HoSoKham = models.HoSoKham;
export const Medicine = models.Medicine;
export const LabService = models.LabService;
export const LabTest = models.LabTest;
export const Prescription = models.Prescription;
export const Payment = models.Payment;
export const HoaDon = models.HoaDon;
export const ServiceOrder = models.ServiceOrder;
export const InventoryTransaction = models.InventoryTransaction;

