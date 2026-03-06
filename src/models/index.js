/**
 * Models Index - Tải và thiết lập quan hệ cho tất cả models
 */
import { sequelize, Sequelize, connectDatabase, syncDatabase } from './database.js';

// Import tất cả English model factories
import UserFactory from './User.js';
import PatientFactory from './Patient.js';
import AppointmentFactory from './Appointment.js';
import MedicalRecordFactory from './MedicalRecord.js';
import MedicineFactory from './Medicine.js';
import LabServiceFactory from './LabService.js';
import LabTestFactory from './LabTest.js';
import PrescriptionFactory from './Prescription.js';
import PaymentFactory from './Payment.js';
import ServiceOrderFactory from './ServiceOrder.js';
import InventoryTransactionFactory from './InventoryTransaction.js';

// Khởi tạo models từ factories
const models = {};

const factories = [
  UserFactory,
  PatientFactory,
  AppointmentFactory,
  MedicalRecordFactory,
  MedicineFactory,
  LabServiceFactory,
  LabTestFactory,
  PrescriptionFactory,
  PaymentFactory,
  ServiceOrderFactory,
  InventoryTransactionFactory,
];

factories.forEach((factory) => {
  if (typeof factory === 'function') {
    const model = factory(sequelize, Sequelize.DataTypes);
    models[model.name] = model;
  }
});

// Thiết lập associations sau khi tất cả models đã được load
Object.keys(models).forEach((modelName) => {
  if (typeof models[modelName].associate === 'function') {
    models[modelName].associate(models);
  }
});

export const {
  User,
  Patient,
  Appointment,
  MedicalRecord,
  Medicine,
  LabService,
  LabTest,
  Prescription,
  Payment,
  ServiceOrder,
  InventoryTransaction,
} = models;

export { sequelize, Sequelize, connectDatabase, syncDatabase };
export default models;

