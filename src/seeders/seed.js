/**
 * Database Seeder
 * Seeds initial data into the database
 */
require('dotenv').config();

const bcrypt = require('bcryptjs');
const { sequelize } = require('../models/database');
const {
  User,
  Patient,
  Medicine,
  LabService,
} = require('../models');
const {
  ROLES,
  GENDERS,
} = require('../config/constants');
const logger = require('../utils/logger');

// Seed data
const users = [
  {
    username: 'admin',
    email: 'admin@noikhoa.com',
    password: 'admin123',
    fullName: 'Quản Trị Viên',
    role: ROLES.ADMIN,
    phone: '0901234567',
    gender: GENDERS.MALE,
  },
  {
    username: 'doctor1',
    email: 'bacsi1@noikhoa.com',
    password: 'doctor123',
    fullName: 'BS. Nguyễn Văn Hùng',
    role: ROLES.DOCTOR,
    phone: '0901234568',
    gender: GENDERS.MALE,
    signature: 'BS. Nguyễn Văn Hùng',
  },
  {
    username: 'doctor2',
    email: 'bacsi2@noikhoa.com',
    password: 'doctor123',
    fullName: 'BS. Trần Thị Mai',
    role: ROLES.DOCTOR,
    phone: '0901234569',
    gender: GENDERS.FEMALE,
    signature: 'BS. Trần Thị Mai',
  },
  {
    username: 'receptionist',
    email: 'tieptan@noikhoa.com',
    password: 'reception123',
    fullName: 'Lê Thị Hương',
    role: ROLES.RECEPTIONIST,
    phone: '0901234570',
    gender: GENDERS.FEMALE,
  },
  {
    username: 'pharmacist',
    email: 'duocsi@noikhoa.com',
    password: 'pharma123',
    fullName: 'Phạm Văn Dược',
    role: ROLES.PHARMACIST,
    phone: '0901234571',
    gender: GENDERS.MALE,
  },
];

const medicines = [
  {
    name: 'Paracetamol 500mg',
    genericName: 'Paracetamol',
    unit: 'Viên',
    price: 2000,
    quantity: 1000,
    minQuantity: 100,
    category: 'Thuốc giảm đau',
    manufacturer: 'Công ty Dược Hà Nội',
    expiryDate: new Date('2026-12-31'),
    dosageInstructions: 'Uống 1-2 viên/lần, 3-4 lần/ngày khi đau',
  },
  {
    name: 'Amoxicillin 500mg',
    genericName: 'Amoxicillin',
    unit: 'Viên',
    price: 5000,
    quantity: 500,
    minQuantity: 50,
    category: 'Kháng sinh',
    manufacturer: 'Công ty Dược Sài Gòn',
    expiryDate: new Date('2025-06-30'),
    dosageInstructions: 'Uống 1 viên/lần, 3 lần/ngày trong 5-7 ngày',
  },
  {
    name: 'Omeprazole 20mg',
    genericName: 'Omeprazole',
    unit: 'Viên',
    price: 3500,
    quantity: 800,
    minQuantity: 80,
    category: 'Thuốc dạ dày',
    manufacturer: 'Công ty Dược Hà Nội',
    expiryDate: new Date('2025-09-30'),
    dosageInstructions: 'Uống 1 viên/lần, 1-2 lần/ngày trước bữa ăn',
  },
  {
    name: 'Metformin 500mg',
    genericName: 'Metformin',
    unit: 'Viên',
    price: 1500,
    quantity: 600,
    minQuantity: 100,
    category: 'Thuốc tiểu đường',
    manufacturer: 'Công ty Dược Trung ương',
    expiryDate: new Date('2026-03-31'),
    dosageInstructions: 'Uống 1 viên/lần, 2-3 lần/ngày sau bữa ăn',
  },
  {
    name: 'Amlodipine 5mg',
    genericName: 'Amlodipine',
    unit: 'Viên',
    price: 2500,
    quantity: 400,
    minQuantity: 50,
    category: 'Thuốc tim mạch',
    manufacturer: 'Công ty Dược Hải Phòng',
    expiryDate: new Date('2025-12-31'),
    dosageInstructions: 'Uống 1 viên/ngày vào buổi sáng',
  },
  {
    name: 'Vitamin C 500mg',
    genericName: 'Ascorbic Acid',
    unit: 'Viên',
    price: 1000,
    quantity: 2000,
    minQuantity: 200,
    category: 'Vitamin',
    manufacturer: 'Công ty Dược OPC',
    expiryDate: new Date('2026-06-30'),
    dosageInstructions: 'Uống 1-2 viên/ngày',
  },
  {
    name: 'Loratadine 10mg',
    genericName: 'Loratadine',
    unit: 'Viên',
    price: 3000,
    quantity: 300,
    minQuantity: 30,
    category: 'Thuốc dị ứng',
    manufacturer: 'Công ty Dược Sài Gòn',
    expiryDate: new Date('2025-10-31'),
    dosageInstructions: 'Uống 1 viên/ngày',
  },
  {
    name: 'Ibuprofen 400mg',
    genericName: 'Ibuprofen',
    unit: 'Viên',
    price: 2500,
    quantity: 500,
    minQuantity: 50,
    category: 'Thuốc giảm đau',
    manufacturer: 'Công ty Dược Hà Nội',
    expiryDate: new Date('2025-08-31'),
    dosageInstructions: 'Uống 1 viên/lần, 2-3 lần/ngày sau bữa ăn',
  },
];

const labServices = [
  {
    name: 'Công thức máu',
    type: 'Xét nghiệm máu',
    price: 80000,
    room: 'Phòng XN 1',
    duration: 30,
    description: 'Xét nghiệm công thức máu toàn phần',
  },
  {
    name: 'Đường huyết',
    type: 'Xét nghiệm máu',
    price: 50000,
    room: 'Phòng XN 1',
    duration: 15,
    description: 'Xét nghiệm đường huyết lúc đói',
  },
  {
    name: 'Chức năng gan',
    type: 'Xét nghiệm máu',
    price: 150000,
    room: 'Phòng XN 1',
    duration: 45,
    description: 'Xét nghiệm men gan SGOT, SGPT',
  },
  {
    name: 'Chức năng thận',
    type: 'Xét nghiệm máu',
    price: 120000,
    room: 'Phòng XN 1',
    duration: 45,
    description: 'Xét nghiệm BUN, Creatinine',
  },
  {
    name: 'Nước tiểu toàn phần',
    type: 'Xét nghiệm nước tiểu',
    price: 50000,
    room: 'Phòng XN 2',
    duration: 30,
    description: 'Xét nghiệm 10 thông số nước tiểu',
  },
  {
    name: 'Siêu âm bụng tổng quát',
    type: 'Siêu âm',
    price: 200000,
    room: 'Phòng SA',
    duration: 30,
    description: 'Siêu âm gan, mật, tụy, lách, thận',
  },
  {
    name: 'Điện tâm đồ (ECG)',
    type: 'Chẩn đoán hình ảnh',
    price: 100000,
    room: 'Phòng ECG',
    duration: 15,
    description: 'Đo điện tâm đồ 12 chuyển đạo',
  },
  {
    name: 'X-quang ngực',
    type: 'Chẩn đoán hình ảnh',
    price: 150000,
    room: 'Phòng X-quang',
    duration: 20,
    description: 'X-quang ngực thẳng',
  },
];

const patients = [
  {
    fullName: 'Nguyễn Văn An',
    dateOfBirth: new Date('1985-03-15'),
    gender: GENDERS.MALE,
    phone: '0912345678',
    email: 'nguyenvanan@email.com',
    address: '123 Đường Lê Lợi, Quận 1, TP.HCM',
    idNumber: '079085123456',
  },
  {
    fullName: 'Trần Thị Bích',
    dateOfBirth: new Date('1990-07-22'),
    gender: GENDERS.FEMALE,
    phone: '0923456789',
    email: 'tranthibich@email.com',
    address: '456 Đường Nguyễn Huệ, Quận 1, TP.HCM',
    idNumber: '079090234567',
    allergies: 'Penicillin',
  },
  {
    fullName: 'Lê Minh Cường',
    dateOfBirth: new Date('1978-11-08'),
    gender: GENDERS.MALE,
    phone: '0934567890',
    email: 'leminhcuong@email.com',
    address: '789 Đường Hai Bà Trưng, Quận 3, TP.HCM',
    idNumber: '079078345678',
    medicalHistory: 'Tiểu đường type 2',
  },
  {
    fullName: 'Phạm Thị Dung',
    dateOfBirth: new Date('1995-01-30'),
    gender: GENDERS.FEMALE,
    phone: '0945678901',
    email: 'phamthidung@email.com',
    address: '321 Đường Pasteur, Quận 3, TP.HCM',
    idNumber: '079095456789',
  },
  {
    fullName: 'Hoàng Văn Em',
    dateOfBirth: new Date('1960-06-12'),
    gender: GENDERS.MALE,
    phone: '0956789012',
    email: 'hoangvanem@email.com',
    address: '654 Đường Cách Mạng Tháng 8, Quận 10, TP.HCM',
    idNumber: '079060567890',
    medicalHistory: 'Tăng huyết áp, Tim mạch',
    emergencyContact: 'Hoàng Thị Phúc',
    emergencyPhone: '0967890123',
  },
];

// Run seeder
const runSeeder = async () => {
  try {
    // Connect to database
    await sequelize.authenticate();
    logger.info('Database connected for seeding');

    // Sync database (create tables if not exist)
    await sequelize.sync({ force: true }); // WARNING: This drops all tables
    logger.info('Database synchronized (tables recreated)');

    // Seed users
    logger.info('Seeding users...');
    for (const userData of users) {
      await User.create(userData);
    }
    logger.info(`Created ${users.length} users`);

    // Seed medicines
    logger.info('Seeding medicines...');
    for (const medicineData of medicines) {
      await Medicine.create(medicineData);
    }
    logger.info(`Created ${medicines.length} medicines`);

    // Seed lab services
    logger.info('Seeding lab services...');
    for (const serviceData of labServices) {
      await LabService.create(serviceData);
    }
    logger.info(`Created ${labServices.length} lab services`);

    // Seed patients
    logger.info('Seeding patients...');
    for (const patientData of patients) {
      await Patient.create(patientData);
    }
    logger.info(`Created ${patients.length} patients`);

    logger.info('✅ Seeding completed successfully!');
    logger.info('');
    logger.info('=== Default Login Credentials ===');
    logger.info('Admin:        admin / admin123');
    logger.info('Doctor 1:     doctor1 / doctor123');
    logger.info('Doctor 2:     doctor2 / doctor123');
    logger.info('Receptionist: receptionist / reception123');
    logger.info('Pharmacist:   pharmacist / pharma123');
    logger.info('Lab Tech:     labtech / labtech123');
    logger.info('================================');

  } catch (error) {
    logger.error('Seeding failed:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
};

// Execute seeder
runSeeder()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
