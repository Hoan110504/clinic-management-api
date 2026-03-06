/**
 * Database Seeder - Dữ liệu mẫu cho CSDL
 * Seeds initial data into the database
 */
import 'dotenv/config';

import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { sequelize, connectDatabase, syncDatabase } from '../models/database.js';
import models from '../models/index.js';
import logger from '../utils/logger.js';

// =============================================
// HẰNG SỐ
// =============================================
const VAI_TRO = {
  ADMIN: 1,
  BAC_SI: 2,
  LE_TAN: 3,
  DUOC_SI: 4,
  BENH_NHAN: 5
};

const GIOI_TINH = {
  KHAC: 0,
  NAM: 1,
  NU: 2
};

// =============================================
// DỮ LIỆU MẪU - NGƯỜI DÙNG
// =============================================
const nguoiDungData = [
  {
    TenDangNhap: 'admin',
    Email: 'admin@phongkham.com',
    MatKhau: 'Admin@123',
    HoTen: 'Quản Trị Viên',
    VaiTro: VAI_TRO.ADMIN,
    SoDienThoai: '0901234567',
    NgaySinh: new Date('1985-01-15'),
    GioiTinh: GIOI_TINH.NAM,
    DiaChi: 'Hà Nội',
    CCCD: '001085001234',
    TrangThaiHoatDong: true
  },
  {
    TenDangNhap: 'bacsi1',
    Email: 'bacsi1@phongkham.com',
    MatKhau: 'BacSi@123',
    HoTen: 'BS. Nguyễn Văn Hùng',
    VaiTro: VAI_TRO.BAC_SI,
    SoDienThoai: '0901234568',
    NgaySinh: new Date('1980-05-20'),
    GioiTinh: GIOI_TINH.NAM,
    DiaChi: '123 Đường Láng, Hà Nội',
    CCCD: '001080005678',
    TrangThaiHoatDong: true
  },
  {
    TenDangNhap: 'bacsi2',
    Email: 'bacsi2@phongkham.com',
    MatKhau: 'BacSi@123',
    HoTen: 'BS. Trần Thị Mai',
    VaiTro: VAI_TRO.BAC_SI,
    SoDienThoai: '0901234569',
    NgaySinh: new Date('1982-08-10'),
    GioiTinh: GIOI_TINH.NU,
    DiaChi: '456 Kim Mã, Hà Nội',
    CCCD: '001082009012',
    TrangThaiHoatDong: true
  },
  {
    TenDangNhap: 'letan',
    Email: 'letan@phongkham.com',
    MatKhau: 'LeTan@123',
    HoTen: 'Lê Thị Hương',
    VaiTro: VAI_TRO.LE_TAN,
    SoDienThoai: '0901234570',
    NgaySinh: new Date('1995-03-25'),
    GioiTinh: GIOI_TINH.NU,
    DiaChi: '789 Cầu Giấy, Hà Nội',
    CCCD: '001095003456',
    TrangThaiHoatDong: true
  },
  {
    TenDangNhap: 'duocsi',
    Email: 'duocsi@phongkham.com',
    MatKhau: 'DuocSi@123',
    HoTen: 'Phạm Văn Dược',
    VaiTro: VAI_TRO.DUOC_SI,
    SoDienThoai: '0901234571',
    NgaySinh: new Date('1988-11-12'),
    GioiTinh: GIOI_TINH.NAM,
    DiaChi: '321 Hoàng Mai, Hà Nội',
    CCCD: '001088007890',
    TrangThaiHoatDong: true
  },
  // Một số bệnh nhân mẫu
  {
    TenDangNhap: 'benhnhan1',
    Email: 'bn1@gmail.com',
    MatKhau: 'BenhNhan@123',
    HoTen: 'Trần Văn An',
    VaiTro: VAI_TRO.BENH_NHAN,
    SoDienThoai: '0987654321',
    NgaySinh: new Date('1990-06-15'),
    GioiTinh: GIOI_TINH.NAM,
    DiaChi: '100 Thanh Xuân, Hà Nội',
    CCCD: '001090001111',
    TrangThaiHoatDong: true
  },
  {
    TenDangNhap: 'benhnhan2',
    Email: 'bn2@gmail.com',
    MatKhau: 'BenhNhan@123',
    HoTen: 'Nguyễn Thị Bình',
    VaiTro: VAI_TRO.BENH_NHAN,
    SoDienThoai: '0987654322',
    NgaySinh: new Date('1975-12-20'),
    GioiTinh: GIOI_TINH.NU,
    DiaChi: '200 Đống Đa, Hà Nội',
    CCCD: '001075002222',
    TrangThaiHoatDong: true
  }
];

// =============================================
// DỮ LIỆU MẪU - THUỐC
// =============================================
const thuocData = [
  { TenThuoc: 'Paracetamol 500mg', DonVi: 'Viên', NhomThuoc: 'Thuốc giảm đau', TrangThai: true },
  { TenThuoc: 'Amoxicillin 500mg', DonVi: 'Viên', NhomThuoc: 'Kháng sinh', TrangThai: true },
  { TenThuoc: 'Omeprazole 20mg', DonVi: 'Viên', NhomThuoc: 'Thuốc dạ dày', TrangThai: true },
  { TenThuoc: 'Metformin 500mg', DonVi: 'Viên', NhomThuoc: 'Thuốc tiểu đường', TrangThai: true },
  { TenThuoc: 'Amlodipine 5mg', DonVi: 'Viên', NhomThuoc: 'Thuốc tim mạch', TrangThai: true },
  { TenThuoc: 'Vitamin C 500mg', DonVi: 'Viên', NhomThuoc: 'Vitamin', TrangThai: true },
  { TenThuoc: 'Loratadine 10mg', DonVi: 'Viên', NhomThuoc: 'Thuốc dị ứng', TrangThai: true },
  { TenThuoc: 'Captopril 25mg', DonVi: 'Viên', NhomThuoc: 'Thuốc huyết áp', TrangThai: true },
  { TenThuoc: 'Ibuprofen 400mg', DonVi: 'Viên', NhomThuoc: 'Thuốc giảm đau', TrangThai: true },
  { TenThuoc: 'Cetirizine 10mg', DonVi: 'Viên', NhomThuoc: 'Thuốc dị ứng', TrangThai: true }
];

// =============================================
// DỮ LIỆU MẪU - DỊCH VỤ CẬN LÂM SÀNG
// =============================================
const dichVuData = [
  { TenDichVu: 'Xét nghiệm công thức máu', MoTa: 'CBC - Complete Blood Count', DonGia: 150000, TrangThai: true },
  { TenDichVu: 'Xét nghiệm đường huyết', MoTa: 'Glucose máu', DonGia: 50000, TrangThai: true },
  { TenDichVu: 'Xét nghiệm chức năng gan', MoTa: 'AST, ALT, GGT', DonGia: 200000, TrangThai: true },
  { TenDichVu: 'Xét nghiệm chức năng thận', MoTa: 'Creatinine, Urea', DonGia: 180000, TrangThai: true },
  { TenDichVu: 'Xét nghiệm lipid máu', MoTa: 'Cholesterol, Triglyceride', DonGia: 220000, TrangThai: true },
  { TenDichVu: 'X-quang ngực', MoTa: 'Chụp X-quang lồng ngực', DonGia: 150000, TrangThai: true },
  { TenDichVu: 'Siêu âm bụng', MoTa: 'Siêu âm tổng quát ổ bụng', DonGia: 250000, TrangThai: true },
  { TenDichVu: 'Điện tâm đồ', MoTa: 'ECG - Electrocardiogram', DonGia: 100000, TrangThai: true },
  { TenDichVu: 'Xét nghiệm nước tiểu', MoTa: 'Tổng phân tích nước tiểu', DonGia: 80000, TrangThai: true },
  { TenDichVu: 'Xét nghiệm HbA1c', MoTa: 'Hemoglobin A1c - theo dõi tiểu đường', DonGia: 180000, TrangThai: true }
];

// =============================================
// HÀM SEED
// =============================================
async function seedDatabase() {
  try {
    // Kết nối database
    await connectDatabase();
    logger.info('🔗 Đã kết nối database');

    // Sync database (tạo bảng nếu chưa có)
    await syncDatabase(true); // force = true sẽ xóa và tạo lại bảng
    logger.info('📊 Đã đồng bộ schema database');

    // 1. Seed Người dùng
    logger.info('👤 Đang tạo người dùng...');
    const createdUsers = [];
    for (const user of nguoiDungData) {
      const hashedPassword = await bcrypt.hash(user.MatKhau, 12);
      const createdUser = await models.NguoiDung.create({
        ...user,
        MatKhau: hashedPassword
      });
      createdUsers.push(createdUser);
      logger.info(`   ✅ Đã tạo: ${user.HoTen} (${user.TenDangNhap})`);
    }

    // 2. Seed Bệnh nhân (từ người dùng có vai trò bệnh nhân)
    logger.info('🏥 Đang tạo hồ sơ bệnh nhân...');
    const benhNhanUsers = createdUsers.filter(u => u.VaiTro === VAI_TRO.BENH_NHAN);
    const benhNhanData = [
      {
        MaNguoiDung: benhNhanUsers[0].Id,
        TienSuBenh: 'Tăng huyết áp, tiểu đường type 2',
        DiUng: 'Dị ứng Penicillin',
        NguoiLienHeKhanCap: 'Trần Văn Bình',
        SDTNguoiLienHe: '0987111222',
        GhiChu: 'Bệnh nhân cần theo dõi huyết áp thường xuyên'
      },
      {
        MaNguoiDung: benhNhanUsers[1].Id,
        TienSuBenh: 'Viêm dạ dày mạn tính',
        DiUng: null,
        NguoiLienHeKhanCap: 'Nguyễn Văn Cường',
        SDTNguoiLienHe: '0987333444',
        GhiChu: null
      }
    ];

    for (const bn of benhNhanData) {
      await models.BenhNhan.create(bn);
    }
    logger.info(`   ✅ Đã tạo ${benhNhanData.length} hồ sơ bệnh nhân`);

    // 3. Seed Thuốc
    logger.info('💊 Đang tạo danh mục thuốc...');
    const createdThuoc = [];
    for (const thuoc of thuocData) {
      const created = await models.Thuoc.create(thuoc);
      createdThuoc.push(created);
    }
    logger.info(`   ✅ Đã tạo ${thuocData.length} loại thuốc`);

    // 4. Seed Lô thuốc
    logger.info('📦 Đang tạo lô thuốc...');
    const loThuocData = createdThuoc.map((thuoc, index) => ({
      MaThuoc: thuoc.Id,
      SoLo: `LO2024${String(index + 1).padStart(4, '0')}`,
      HanSuDung: new Date('2026-12-31'),
      NgaySanXuat: new Date('2024-01-01'),
      SoLuongTon: 500 + index * 100,
      GiaNhap: 1000 + index * 500,
      TrangThai: 1
    }));

    for (const lo of loThuocData) {
      await models.QuanLyLoThuoc.create(lo);
    }
    logger.info(`   ✅ Đã tạo ${loThuocData.length} lô thuốc`);

    // 5. Seed Dịch vụ cận lâm sàng
    logger.info('🔬 Đang tạo dịch vụ cận lâm sàng...');
    for (const dv of dichVuData) {
      await models.DichVuCanLamSang.create(dv);
    }
    logger.info(`   ✅ Đã tạo ${dichVuData.length} dịch vụ`);

    logger.info('');
    logger.info('🎉 ============================================');
    logger.info('🎉 SEED DATABASE HOÀN TẤT!');
    logger.info('🎉 ============================================');
    logger.info('');
    logger.info('📋 Tài khoản đăng nhập:');
    logger.info('   Admin:     admin / Admin@123');
    logger.info('   Bác sĩ 1:  bacsi1 / BacSi@123');
    logger.info('   Bác sĩ 2:  bacsi2 / BacSi@123');
    logger.info('   Lễ tân:    letan / LeTan@123');
    logger.info('   Dược sĩ:   duocsi / DuocSi@123');
    logger.info('   Bệnh nhân: benhnhan1 / BenhNhan@123');
    logger.info('');

    process.exit(0);
  } catch (error) {
    logger.error('❌ Lỗi seed database:', error);
    process.exit(1);
  }
}

// Chạy seed
seedDatabase();
