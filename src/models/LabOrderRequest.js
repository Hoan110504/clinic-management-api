/**
 * LabOrderRequest Model
 * Manage clinical service requests
 */

module.exports = (sequelize, DataTypes) => {
  const LabOrderRequest = sequelize.define('LabOrderRequest', {
    Id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      field: 'Id'
    },

    MedicalRecordId: {           // MaHoSoKham
      type: DataTypes.UUID,
      allowNull: false,
      field: 'MedicalRecordId',
      references: {
        model: 'MedicalExamination', // or table where medical records are stored
        key: 'ExaminationID'
      }
    },

    PatientId: {                 // MaBenhNhan
      type: DataTypes.UUID,
      allowNull: false,
      field: 'PatientId',
      references: {
        model: 'Patients',
        key: 'id'
      }
    },

    OrderedByUserId: {           // NguoiChiDinhId
      type: DataTypes.UUID,
      allowNull: false,
      field: 'OrderedByUserId',
      references: {
        model: 'users',
        key: 'id'
      }
    },

    Status: {                    // TrangThai
      type: DataTypes.TINYINT,
      field: 'Status'
    },

    OrderedAt: {                 // NgayChiDinh
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'OrderedAt'
    },

    DoctorNotes: {               // GhiChuBacSi
      type: DataTypes.TEXT,
      field: 'DoctorNotes'
    }
  }, {
    tableName: 'LabOrderRequest',
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
    if (models && models.Patients) {
      LabOrderRequest.belongsTo(models.Patients, {
        foreignKey: 'PatientId',
        as: 'Patient'
      });
    }

    // Ordered by User
    if (models && models.users) {
      LabOrderRequest.belongsTo(models.users, {
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

    // Has many LabResults
    if (models && models.LabOrder) {
      LabOrderRequest.hasMany(models.LabOrder, {
        foreignKey: 'LabOrderID',
        as: 'LabResults'
      });
    }
  };

  return LabOrderRequest;
};