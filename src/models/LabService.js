/**
 * Lab Service Model
 * Catalog of available lab test services
 */
import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const LabService = sequelize.define(
    'LabService',
    {
      id: {
        type: DataTypes.STRING(20),
        primaryKey: true,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING(200),
        allowNull: false,
      },
      type: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      price: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      room: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      duration: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Duration in minutes',
      },
      instructions: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: 'is_active',
      },
    },
    {
      tableName: 'lab_services',
      timestamps: true,
      paranoid: true,
      indexes: [
        { fields: ['name'] },
        { fields: ['type'] },
        { fields: ['is_active'] },
      ],
      hooks: {
        beforeCreate: async (service) => {
          if (!service.id) {
            const LabService = sequelize.models.LabService;
            const lastService = await LabService.findOne({
              order: [['createdAt', 'DESC']],
              paranoid: false,
            });
            let nextNum = 1;
            if (lastService && lastService.id) {
              const match = lastService.id.match(/SV(\d+)/);
              if (match) {
                nextNum = parseInt(match[1], 10) + 1;
              }
            }
            service.id = `SV${String(nextNum).padStart(3, '0')}`;
          }
        },
      },
    }
  );

  return LabService;
};
