/**
 * MedicalExamination Model
 * Maps to dbo.MedicalExamination. Provides full fields for doctor's
 * "Khám và tư vấn" workflow.
 */
import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const MedicalExamination = sequelize.define(
    'MedicalExamination',
    {
      ExaminationID: { type: DataTypes.BIGINT, primaryKey: true, allowNull: false, autoIncrement: true, columnName: 'ExaminationID' },
      AppointmentID: { type: DataTypes.STRING(20), allowNull: false, columnName: 'AppointmentID' },
      PatientID: { type: DataTypes.STRING(50), allowNull: false, columnName: 'PatientID' },
      DoctorID: { type: DataTypes.CHAR(36), allowNull: true, columnName: 'DoctorID' },
      ExaminationDate: { type: DataTypes.DATE, allowNull: true, columnName: 'ExaminationDate' },

      // I. TRIỆU CHỨNG
      Symptoms: { type: DataTypes.TEXT, allowNull: true, columnName: 'Symptoms' },

      // II. CHỈ SỐ SỨC KHỎE
      BloodPressure: { type: DataTypes.STRING(20), allowNull: true, columnName: 'BloodPressure' },
      Pulse: { type: DataTypes.INTEGER, allowNull: true, columnName: 'Pulse' },
      Temperature: { type: DataTypes.DECIMAL(4,1), allowNull: true, columnName: 'Temperature' },
      SpO2: { type: DataTypes.INTEGER, allowNull: true, columnName: 'SpO2' },
      RespirationRate: { type: DataTypes.INTEGER, allowNull: true, columnName: 'RespirationRate' },
      Weight: { type: DataTypes.DECIMAL(5,2), allowNull: true, columnName: 'Weight' },
      Height: { type: DataTypes.DECIMAL(5,2), allowNull: true, columnName: 'Height' },
      BMI: { type: DataTypes.DECIMAL(5,2), allowNull: true, columnName: 'BMI' },

      // III. CHẨN ĐOÁN & HƯỚNG ĐIỀU TRỊ
      Diagnosis: { type: DataTypes.TEXT, allowNull: true, columnName: 'Diagnosis' },
      ICD10Code: { type: DataTypes.STRING(20), allowNull: true, columnName: 'ICD10Code' },
      TreatmentAdvice: { type: DataTypes.TEXT, allowNull: true, columnName: 'TreatmentAdvice' },
      Notes: { type: DataTypes.TEXT, allowNull: true, columnName: 'Notes' },
      ReExaminationDate: { type: DataTypes.DATEONLY, allowNull: true, columnName: 'ReExaminationDate' },

      // IV. CHỈ ĐỊNH CẬN LÂM SÀNG
      LabOrders: { type: DataTypes.TEXT, allowNull: true, columnName: 'LabOrders' },
      ImagingOrders: { type: DataTypes.TEXT, allowNull: true, columnName: 'ImagingOrders' },
      ECGOrders: { type: DataTypes.TEXT, allowNull: true, columnName: 'ECGOrders' },
      LabResults: { type: DataTypes.TEXT, allowNull: true, columnName: 'LabResults' },
      ImagingResults: { type: DataTypes.TEXT, allowNull: true, columnName: 'ImagingResults' },
      ECGResults: { type: DataTypes.TEXT, allowNull: true, columnName: 'ECGResults' },

      // V. KÊ ĐƠN THUỐC
      PrescriptionID: { type: DataTypes.UUID, allowNull: true, columnName: 'PrescriptionID' },
      PrescriptionStatus: { type: DataTypes.TINYINT, allowNull: true, defaultValue: 0, columnName: 'PrescriptionStatus' },
    },
    {
      tableName: 'MedicalExamination',
      timestamps: true,
      createdAt: 'CreatedAt',
      updatedAt: 'UpdatedAt',
      paranoid: false,
      underscored: false,  // ← QUAN TRỌNG: Không convert sang snake_case
    }
  );

  // Aliases camelCase - compute readable code from ExaminationID when DB column was removed
  const formatExaminationIDString = (seq, createdAt) => {
    if (!seq) return null;
    const d = createdAt ? new Date(createdAt) : new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `PK-${y}${m}${day}-${String(seq).padStart(6, '0')}`;
  };

  MedicalExamination.prototype.toJSON = function () {
    const raw = this.get ? this.get({ plain: true }) : this;
    const computedCode = raw && (raw.ExaminationID || raw.id) ? formatExaminationIDString(raw.ExaminationID || raw.id, raw.CreatedAt || raw.ExaminationDate) : (raw && raw.ExaminationCode) || null;
    return {
      id: raw.ExaminationID,
      examinationCode: computedCode,
      appointmentId: raw.AppointmentID,
      patientId: raw.PatientID,
      doctorId: raw.DoctorID,
      examinationDate: raw.ExaminationDate,
      symptoms: raw.Symptoms,
      bloodPressure: raw.BloodPressure,
      pulse: raw.Pulse,
      temperature: raw.Temperature,
      spO2: raw.SpO2,
      respirationRate: raw.RespirationRate,
      weight: raw.Weight,
      height: raw.Height,
      bmi: raw.BMI,
      diagnosis: raw.Diagnosis,
      icd10Code: raw.ICD10Code,
      treatmentAdvice: raw.TreatmentAdvice,
      notes: raw.Notes,
      reExaminationDate: raw.ReExaminationDate,
      labOrders: raw.LabOrders,
      imagingOrders: raw.ImagingOrders,
      ecgOrders: raw.ECGOrders,
      labResults: raw.LabResults,
      imagingResults: raw.ImagingResults,
      ecgResults: raw.ECGResults,
      prescriptionId: raw.PrescriptionID,
      prescriptionStatus: raw.PrescriptionStatus,
      createdAt: raw.CreatedAt,
      updatedAt: raw.UpdatedAt,
    };
  };

  // Define associations so eager-loading by "patient" and "doctor" works
  MedicalExamination.associate = function (models) {
    try {
      if (models && models.Patient) {
        MedicalExamination.belongsTo(models.Patient, { as: 'patient', foreignKey: 'PatientID' });
      }
      if (models && models.User) {
        MedicalExamination.belongsTo(models.User, { as: 'doctor', foreignKey: 'DoctorID' });
      }
    } catch (err) {
      // defensive: don't crash module load if associations cannot be set yet
      // real errors will surface when calling associations elsewhere
      // eslint-disable-next-line no-console
      console.warn('MedicalExamination.associate: failed to attach associations', err && err.message);
    }
  };

  return MedicalExamination;
};