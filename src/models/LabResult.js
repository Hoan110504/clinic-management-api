/**
 * LabResult Model
 * Stores results for each clinical service
 */
import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const LabResult = sequelize.define('LabResult', {
    LabResultID: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
      field: 'LabResultID'
    },

    ExaminationID: {
      type: DataTypes.BIGINT,
      allowNull: false,
      field: 'ExaminationID',
      references: {
        model: 'MedicalExaminations',
        key: 'ExaminationID'
      }
    },

    ServiceID: {
      type: DataTypes.BIGINT,
      allowNull: false,
      field: 'ServiceID',
      references: {
        model: 'LabServices',
        key: 'ServiceID'
      }
    },

    ResultText: {
      type: DataTypes.TEXT('long'),
      allowNull: false,
      field: 'ResultText'
    },

    ImageUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'ImageUrl'
    },

    Conclusion: {
      type: DataTypes.STRING(1000),
      allowNull: true,
      field: 'Conclusion'
    },

    Note: {
      type: DataTypes.STRING(1000),
      allowNull: true,
      field: 'Note'
    },

    DoctorID: {
      type: DataTypes.BIGINT,
      allowNull: false,
      field: 'DoctorID',
      references: {
        model: 'Users', // hoặc 'Staff' nếu bác sĩ lưu ở đó
        key: 'id'
      }
    },

    ResultDate: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW,
      field: 'ResultDate'
    },

    CreatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW,
      field: 'CreatedAt'
    },

    UpdatedAt: {
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
      { fields: ['DoctorID'] }
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