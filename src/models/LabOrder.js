/**
 * LabOrder Model
 * Maps to dbo.LabOrders
 */
import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const LabOrder = sequelize.define(
    'LabOrder',
    {
      LabOrderID: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
        field: 'LabOrderID',
      },
      ExaminationID: {
        type: DataTypes.BIGINT,
        allowNull: false,
        field: 'ExaminationID',
      },
      DoctorID: {
        type: DataTypes.BIGINT,
        allowNull: false,
        field: 'DoctorID',
      },
      Status: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 0,
        field: 'Status',
      },
      CreatedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'CreatedAt',
      },
    },
    {
      tableName: 'LabOrders',
      timestamps: false,
      indexes: [
        { fields: ['ExaminationID'] },
        { fields: ['DoctorID'] },
        { fields: ['CreatedAt'] },
      ],
    }
  );

  LabOrder.associate = (models) => {
    if (models && models.MedicalExamination) {
      LabOrder.belongsTo(models.MedicalExamination, {
        foreignKey: 'ExaminationID',
        as: 'examination',
      });
    }
    if (models && models.User) {
      LabOrder.belongsTo(models.User, {
        foreignKey: 'DoctorID',
        as: 'doctor',
        constraints: false,
      });
    }

    if (models && models.LabOrderItem) {
      LabOrder.hasMany(models.LabOrderItem, {
        foreignKey: 'LabOrderID',
        as: 'items',
      });
    }
  };

  return LabOrder;
};
