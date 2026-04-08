/**
 * LabOrderRequest Model
 * Manage clinical service requests
 */
import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const LabOrderRequest = sequelize.define('LabOrderRequest', {
    Id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
      field: 'Id',
      allowNull: false
    },
    MedicalRecordId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      field: 'MedicalRecordId',
      references: {
        model: 'MedicalExaminations',
        key: 'ExaminationID'
      }
    },
    PatientId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      field: 'PatientId',
      references: {
        model: 'patients',
        key: 'id'
      }
    },
    OrderedByUserId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      field: 'OrderedByUserId',
      references: {
        model: 'users',
        key: 'id'
      }
    },

    Status: {                    // TrangThai
      type: DataTypes.TINYINT,
      allowNull: false,
      defaultValue: 0,
      field: 'Status'
    },

    OrderedAt: {                 // NgayChiDinh
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'OrderedAt'
    },

    DoctorNotes: {               // GhiChuBacSi
      type: DataTypes.TEXT('long'),
      allowNull: true,
      field: 'DoctorNotes'
    }
  }, {
    tableName: 'LabOrderRequests',
    timestamps: false,
    indexes: [
      { fields: ['MedicalRecordId'] },
      { fields: ['PatientId'] },
      { fields: ['Status'] }
    ]
  });

  // Enum for Status
  LabOrderRequest.STATUS = {
    PENDING: 0,        // CHO_THUC_HIEN
    IN_PROGRESS: 1,    // DANG_THUC_HIEN
    COMPLETED: 2,      // HOAN_THANH
    CANCELLED: 3       // DA_HUY
  };

  LabOrderRequest.associate = (models) => {
    // Belongs to Medical Record
    if (models && models.MedicalExamination) {
      LabOrderRequest.belongsTo(models.MedicalExamination, {
        foreignKey: 'MedicalRecordId',
        as: 'MedicalRecord'
      });
    }

    // Belongs to Patient
    if (models && models.Patient) {
      LabOrderRequest.belongsTo(models.Patient, {
        foreignKey: 'PatientId',
        as: 'Patient'
      });
    }

    // Ordered by User
    if (models && models.User) {
      LabOrderRequest.belongsTo(models.User, {
        foreignKey: 'OrderedByUserId',
        as: 'OrderedBy'
      });
    }

    // Has many LabOrderRequestDetails (chi tiết dịch vụ)
    if (models && models.LabOrderRequestDetail) {
      LabOrderRequest.hasMany(models.LabOrderRequestDetail, {
        foreignKey: 'LabOrderRequestId',
        as: 'OrderDetails'
      });
    }
  };

  return LabOrderRequest;
};