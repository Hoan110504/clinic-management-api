/**
 * LabResult Model
 * Stores results for each clinical service
 */
import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const LabResult = sequelize.define('LabResult', {
    labResultId: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
      field: 'LabResultID'
    },

    examinationId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      field: 'ExaminationID',
      references: {
        model: 'MedicalExaminations',
        key: 'ExaminationID'
      }
    },

    serviceId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      field: 'ServiceID',
      references: {
        model: 'LabServices',
        key: 'ServiceID'
      }
    },

    labOrderItemId: {
      type: DataTypes.BIGINT,
      allowNull: true,
      field: 'LabOrderItemID',
    },

    roomId: {
      type: DataTypes.BIGINT,
      allowNull: true,
      field: 'RoomID',
    },

    resultText: {
      type: DataTypes.TEXT('long'),
      allowNull: false,
      field: 'ResultText'
    },

    imageUrl: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
      field: 'ImageUrl'
    },

    conclusion: {
      type: DataTypes.STRING(1000),
      allowNull: true,
      field: 'Conclusion'
    },

    note: {
      type: DataTypes.STRING(1000),
      allowNull: true,
      field: 'Note'
    },

    doctorId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      field: 'DoctorID',
      references: {
        model: 'Users',
        key: 'id'
      }
    },

    resultDate: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW,
      field: 'ResultDate'
    },

    createdAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW,
      field: 'CreatedAt'
    },

    updatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'UpdatedAt'
    }

  }, {
    tableName: 'LabResults',
    schema: 'dbo',
    timestamps: false,
    indexes: [
      { fields: ['ExaminationID'] },
      { fields: ['ServiceID'] },
      { fields: ['DoctorID'] },
      { fields: ['LabOrderItemID'] },
      { fields: ['RoomID'] }
    ]
  });

  // Enum trạng thái kết quả (nếu cần)
  LabResult.STATUS = {
    PENDING: 0,        // Chưa nhập kết quả
    COMPLETED: 1       // Đã nhập kết quả
  };

  LabResult.associate = (models) => {
    if (models.LabService) {
      LabResult.belongsTo(models.LabService, {
        foreignKey: 'ServiceID',
        as: 'Service'
      });
    }

    if (models.MedicalExamination) {
      LabResult.belongsTo(models.MedicalExamination, {
        foreignKey: 'ExaminationID',
        as: 'Examination'
      });
    }

    if (models.User) {
      LabResult.belongsTo(models.User, {
        foreignKey: 'DoctorID',
        as: 'Doctor'
      });
    }
  };

  return LabResult;
};