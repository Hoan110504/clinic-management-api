/**
 * MedicalExamination Model
 * Maps to dbo.MedicalExaminations
 */
import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const MedicalExamination = sequelize.define(
    'MedicalExamination',
    {
      ExaminationID: { type: DataTypes.BIGINT, primaryKey: true, allowNull: false, autoIncrement: true, field: 'ExaminationID' },
      AppointmentID: { type: DataTypes.BIGINT, allowNull: false, field: 'AppointmentID' },
      PatientId: { type: DataTypes.BIGINT, allowNull: true, field: 'PatientId' },
      DoctorID: { type: DataTypes.BIGINT, allowNull: true, field: 'DoctorID' },
      ExaminationDate: { type: DataTypes.DATE, allowNull: true, field: 'ExaminationDate' },

      Symptoms: { type: DataTypes.TEXT('long'), allowNull: true, field: 'Symptoms' },
      BloodPressure: { type: DataTypes.STRING(20), allowNull: true, field: 'BloodPressure' },
      Pulse: { type: DataTypes.INTEGER, allowNull: true, field: 'Pulse' },
      Temperature: { type: DataTypes.DECIMAL(5, 2), allowNull: true, field: 'Temperature' },
      SpO2: { type: DataTypes.INTEGER, allowNull: true, field: 'SpO2' },
      RespirationRate: { type: DataTypes.INTEGER, allowNull: true, field: 'RespirationRate' },
      Weight: { type: DataTypes.DECIMAL(8, 2), allowNull: true, field: 'Weight' },
      Height: { type: DataTypes.DECIMAL(8, 2), allowNull: true, field: 'Height' },
      BMI: { type: DataTypes.DECIMAL(8, 2), allowNull: true, field: 'BMI' },

      Diagnosis: { type: DataTypes.TEXT('long'), allowNull: true, field: 'Diagnosis' },
      ICD10Code: { type: DataTypes.STRING(20), allowNull: true, field: 'ICD10Code' },
      TreatmentAdvice: { type: DataTypes.TEXT('long'), allowNull: true, field: 'TreatmentAdvice' },
      Notes: { type: DataTypes.TEXT('long'), allowNull: true, field: 'Notes' },
      ReExaminationDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'ReExaminationDate' },
      PrescriptionStatus: { type: DataTypes.TINYINT, allowNull: true, field: 'PrescriptionStatus' },
    },
    {
      tableName: 'MedicalExaminations',
      timestamps: true,
      createdAt: 'CreatedAt',
      updatedAt: 'UpdatedAt',
      paranoid: false,
      underscored: false,
    }
  );

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
      patientId: raw.PatientId,
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
      prescriptionStatus: raw.PrescriptionStatus,
      createdAt: raw.CreatedAt,
      updatedAt: raw.UpdatedAt,
    };
  };

  MedicalExamination.associate = function (models) {
    if (models && models.Patient) {
      MedicalExamination.belongsTo(models.Patient, { as: 'patient', foreignKey: 'PatientId' });
    }
    if (models && models.User) {
      MedicalExamination.belongsTo(models.User, { as: 'doctor', foreignKey: 'DoctorID' });
    }
  };

  return MedicalExamination;
};