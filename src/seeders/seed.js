/**
 * Database Seeder
 * Seeds initial data into the database
 */
import 'dotenv/config';

import bcrypt from 'bcryptjs';
import { sequelize } from '../models/database.js';
import {
  User,
  Patient,
  Medicine,
  LabService,
} from '../models/index.js';
import {
  ROLES,
  GENDER,
} from '../config/constants.js';
import logger from '../utils/logger.js';

// Seed data
const users = [
  {
    username: 'admin',
    email: 'admin@noikhoa.com',
    password: 'admin123',
    fullName: 'Quản Trị Viên',
    role: ROLES.ADMIN,
    phone: '0901234567',
    gender: GENDER.MALE,
  },
  {
    username: 'doctor1',
    email: 'bacsi1@noikhoa.com',
    password: 'doctor123',
    fullName: 'BS. Nguyễn Văn Hùng',
    role: ROLES.DOCTOR,
    phone: '0901234568',
    gender: GENDER.MALE,
    signature: 'BS. Nguyễn Văn Hùng',
  },
  {
    username: 'doctor2',
    email: 'bacsi2@noikhoa.com',
    password: 'doctor123',
    fullName: 'BS. Trần Thị Mai',
    role: ROLES.DOCTOR,
    phone: '0901234569',
    gender: GENDER.FEMALE,
    signature: 'BS. Trần Thị Mai',
  },
  {
    username: 'receptionist',
    email: 'tieptan@noikhoa.com',
    password: 'reception123',
    fullName: 'Lê Thị Hương',
    role: ROLES.RECEPTIONIST,
    phone: '0901234570',
    gender: GENDER.FEMALE,
  },
  {
    username: 'pharmacist',
    email: 'duocsi@noikhoa.com',
    password: 'pharma123',
    fullName: 'Phạm Văn Dược',
    role: ROLES.PHARMACIST,
    phone: '0901234571',
    gender: GENDER.MALE,
  },
];

const medicines = [
  // 1) Giảm đau, hạ sốt, kháng viêm
  { name: 'Paracetamol 500mg', category: 'Giảm đau, hạ sốt, kháng viêm', unit: 'Viên' },
  { name: 'Ibuprofen 200mg', category: 'Giảm đau, hạ sốt, kháng viêm', unit: 'Viên' },
  { name: 'Ibuprofen 400mg', category: 'Giảm đau, hạ sốt, kháng viêm', unit: 'Viên' },
  { name: 'Diclofenac 50mg', category: 'Giảm đau, hạ sốt, kháng viêm', unit: 'Viên' },
  { name: 'Meloxicam 7.5mg', category: 'Giảm đau, hạ sốt, kháng viêm', unit: 'Viên' },
  { name: 'Meloxicam 15mg', category: 'Giảm đau, hạ sốt, kháng viêm', unit: 'Viên' },
  { name: 'Celecoxib 200mg', category: 'Giảm đau, hạ sốt, kháng viêm', unit: 'Viên' },

  // 2) Kháng sinh
  { name: 'Amoxicillin', category: 'Kháng sinh', unit: 'Viên' },
  { name: 'Cefixime', category: 'Kháng sinh', unit: 'Viên' },
  { name: 'Cefpodoxime', category: 'Kháng sinh', unit: 'Viên' },
  { name: 'Azithromycin', category: 'Kháng sinh', unit: 'Viên' },
  { name: 'Clarithromycin', category: 'Kháng sinh', unit: 'Viên' },
  { name: 'Levofloxacin', category: 'Kháng sinh', unit: 'Viên' },
  { name: 'Ciprofloxacin', category: 'Kháng sinh', unit: 'Viên' },

  // 3) Hô hấp - ho - hen - viêm mũi xoang
  { name: 'Acetylcysteine', category: 'Hô hấp - ho - hen - viêm mũi xoang', unit: 'Gói' },
  { name: 'Bromhexine', category: 'Hô hấp - ho - hen - viêm mũi xoang', unit: 'Viên' },
  { name: 'Ambroxol', category: 'Hô hấp - ho - hen - viêm mũi xoang', unit: 'Viên' },
  { name: 'Dextromethorphan', category: 'Hô hấp - ho - hen - viêm mũi xoang', unit: 'Viên' },
  { name: 'Salbutamol xịt', category: 'Hô hấp - ho - hen - viêm mũi xoang', unit: 'Bình' },
  { name: 'Montelukast', category: 'Hô hấp - ho - hen - viêm mũi xoang', unit: 'Viên' },
  { name: 'Loratadine', category: 'Hô hấp - ho - hen - viêm mũi xoang', unit: 'Viên' },
  { name: 'Cetirizine', category: 'Hô hấp - ho - hen - viêm mũi xoang', unit: 'Viên' },
  { name: 'Fexofenadine', category: 'Hô hấp - ho - hen - viêm mũi xoang', unit: 'Viên' },

  // 4) Tim mạch
  { name: 'Amlodipine', category: 'Tim mạch', unit: 'Viên' },
  { name: 'Nifedipine', category: 'Tim mạch', unit: 'Viên' },
  { name: 'Perindopril', category: 'Tim mạch', unit: 'Viên' },
  { name: 'Enalapril', category: 'Tim mạch', unit: 'Viên' },
  { name: 'Losartan', category: 'Tim mạch', unit: 'Viên' },
  { name: 'Valsartan', category: 'Tim mạch', unit: 'Viên' },
  { name: 'Furosemide', category: 'Tim mạch', unit: 'Viên' },
  { name: 'Spironolactone', category: 'Tim mạch', unit: 'Viên' },
  { name: 'Aspirin', category: 'Tim mạch', unit: 'Viên' },
  { name: 'Clopidogrel', category: 'Tim mạch', unit: 'Viên' },
  { name: 'Atorvastatin', category: 'Tim mạch', unit: 'Viên' },
  { name: 'Rosuvastatin', category: 'Tim mạch', unit: 'Viên' },

  // 5) Thuốc tiêu hóa
  { name: 'Omeprazole', category: 'Thuốc tiêu hóa', unit: 'Viên' },
  { name: 'Esomeprazole', category: 'Thuốc tiêu hóa', unit: 'Viên' },
  { name: 'Pantoprazole', category: 'Thuốc tiêu hóa', unit: 'Viên' },
  { name: 'Sucralfate', category: 'Thuốc tiêu hóa', unit: 'Gói' },
  { name: 'Gaviscon', category: 'Thuốc tiêu hóa', unit: 'Gói' },
  { name: 'Smecta', category: 'Thuốc tiêu hóa', unit: 'Gói' },
  { name: 'Loperamide', category: 'Thuốc tiêu hóa', unit: 'Viên' },
  { name: 'Racecadotril', category: 'Thuốc tiêu hóa', unit: 'Viên' },
  { name: 'Men vi sinh', category: 'Thuốc tiêu hóa', unit: 'Gói' },
  { name: 'Ursodeoxycholic acid', category: 'Thuốc tiêu hóa', unit: 'Viên' },
  { name: 'Silymarin', category: 'Thuốc tiêu hóa', unit: 'Viên' },

  // 6) Nội tiết - đái tháo đường
  { name: 'Metformin', category: 'Nội tiết - đái tháo đường', unit: 'Viên' },
  { name: 'Gliclazide MR', category: 'Nội tiết - đái tháo đường', unit: 'Viên' },
  { name: 'Glimepiride', category: 'Nội tiết - đái tháo đường', unit: 'Viên' },
  { name: 'Sitagliptin', category: 'Nội tiết - đái tháo đường', unit: 'Viên' },
  { name: 'Empagliflozin', category: 'Nội tiết - đái tháo đường', unit: 'Viên' },

  // 7) Thuốc tiết niệu - sinh dục
  { name: 'Alphachymotrypsin', category: 'Thuốc tiết niệu - sinh dục', unit: 'Viên' },
  { name: 'Tamsulosin 0.4mg', category: 'Thuốc tiết niệu - sinh dục', unit: 'Viên' },
  { name: 'Nitrofurantoin', category: 'Thuốc tiết niệu - sinh dục', unit: 'Viên' },
  { name: 'Cranberry', category: 'Thuốc tiết niệu - sinh dục', unit: 'Viên' },

  // 8) Vitamin - khoáng chất - bổ trợ
  { name: 'Vitamin C', category: 'Vitamin - khoáng chất - bổ trợ', unit: 'Viên' },
  { name: 'Vitamin B1-6-12', category: 'Vitamin - khoáng chất - bổ trợ', unit: 'Viên' },
  { name: 'Magne B6', category: 'Vitamin - khoáng chất - bổ trợ', unit: 'Viên' },
  { name: 'Canxi + Vitamin D', category: 'Vitamin - khoáng chất - bổ trợ', unit: 'Viên' },
  { name: 'Ferrous fumarate', category: 'Vitamin - khoáng chất - bổ trợ', unit: 'Viên' },
  { name: 'Kẽm', category: 'Vitamin - khoáng chất - bổ trợ', unit: 'Viên' },

  // 9) Vật tư y tế
  { name: 'Dịch truyền NaCl', category: 'Vật tư y tế', unit: 'Chai' },
  { name: 'Dịch truyền Ringer lactate', category: 'Vật tư y tế', unit: 'Chai' },
  { name: 'Kim tiêm', category: 'Vật tư y tế', unit: 'Cái' },
  { name: 'Dây truyền', category: 'Vật tư y tế', unit: 'Bộ' },
  { name: 'Test đường huyết', category: 'Vật tư y tế', unit: 'Que' },
  { name: 'Test nước tiểu', category: 'Vật tư y tế', unit: 'Que' },
].map((item) => ({
  ...item,
  genericName: item.name,
  price: 1000,
  quantity: 100,
  minQuantity: 10,
  manufacturer: 'Nhà cung cấp mặc định',
  expiryDate: new Date('2028-12-31'),
  dosageInstructions: '',
}));

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
    gender: GENDER.MALE,
    phone: '0912345678',
    email: 'nguyenvanan@email.com',
    address: '123 Đường Lê Lợi, Quận 1, TP.HCM',
    idNumber: '079085123456',
  },
  {
    fullName: 'Trần Thị Bích',
    dateOfBirth: new Date('1990-07-22'),
    gender: GENDER.FEMALE,
    phone: '0923456789',
    email: 'tranthibich@email.com',
    address: '456 Đường Nguyễn Huệ, Quận 1, TP.HCM',
    idNumber: '079090234567',
    allergies: 'Penicillin',
  },
  {
    fullName: 'Lê Minh Cường',
    dateOfBirth: new Date('1978-11-08'),
    gender: GENDER.MALE,
    phone: '0934567890',
    email: 'leminhcuong@email.com',
    address: '789 Đường Hai Bà Trưng, Quận 3, TP.HCM',
    idNumber: '079078345678',
    medicalHistory: 'Tiểu đường type 2',
  },
  {
    fullName: 'Phạm Thị Dung',
    dateOfBirth: new Date('1995-01-30'),
    gender: GENDER.FEMALE,
    phone: '0945678901',
    email: 'phamthidung@email.com',
    address: '321 Đường Pasteur, Quận 3, TP.HCM',
    idNumber: '079095456789',
  },
  {
    fullName: 'Hoàng Văn Em',
    dateOfBirth: new Date('1960-06-12'),
    gender: GENDER.MALE,
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
