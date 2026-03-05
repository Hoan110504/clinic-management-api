/**
 * Models Index - Tải và thiết lập quan hệ cho tất cả models
 */
const fs = require('fs');
const path = require('path');
const db = require('./database');

const sequelize = db.sequelize;
const Sequelize = db.Sequelize;

const models = {};

// Danh sách các file model Vietnamese mới
const modelFilesVietnamese = [
  'NguoiDung.js',
  'BenhNhan.js',
  'LichHen.js',
  'HoSoKham.js',
  'ChiSoSinhTon.js',
  'Thuoc.js',
  'QuanLyLoThuoc.js',
  'DonThuoc.js',
  'ChiTietDonThuoc.js',
  'DichVuCanLamSang.js',
  'YeuCauDichVu.js',
  'ChiTietYeuCauDichVu.js',
  'CanLamSang.js',
  'HoaDon.js',
  'ChiTietHoaDon.js',
  'GiaoDichKho.js'
];

// Danh sách các file model English (cũ) - để hỗ trợ controllers hiện tại
const modelFilesEnglish = [
  'User.js',
  'Patient.js',
  'Appointment.js',
  'MedicalRecord.js',
  'Medicine.js',
  'LabService.js',
  'LabTest.js',
  'Prescription.js',
  'Payment.js',
  'ServiceOrder.js',
  'InventoryTransaction.js'
];

// Load tất cả models (chỉ English models - Vietnamese models tạm tắt để tránh lỗi FK)
// Để kích hoạt Vietnamese models, bỏ comment dòng dưới:
// const allModelFiles = [...modelFilesEnglish, ...modelFilesVietnamese];
const allModelFiles = [...modelFilesEnglish];

allModelFiles.forEach((file) => {
  const modelPath = path.join(__dirname, file);
  if (fs.existsSync(modelPath)) {
    const modelFactory = require(modelPath);
    if (typeof modelFactory === 'function') {
      const model = modelFactory(sequelize, Sequelize.DataTypes);
      models[model.name] = model;
    }
  }
});

// Thiết lập associations sau khi tất cả models đã được load
Object.keys(models).forEach((modelName) => {
  if (typeof models[modelName].associate === 'function') {
    models[modelName].associate(models);
  }
});

module.exports = {
  ...models,
  sequelize,
  Sequelize,
  connectDatabase: db.connectDatabase,
  syncDatabase: db.syncDatabase,
};
