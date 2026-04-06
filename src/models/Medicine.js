import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const Medicine = sequelize.define(
    'Medicine',
    {
      Id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
        field: 'Id',
      },
      Name: {
        type: DataTypes.STRING(300),
        allowNull: false,
        field: 'Name',
      },
      Unit: {
        type: DataTypes.STRING(100),
        field: 'Unit',
      },
      Category: {
        type: DataTypes.STRING(200),
        field: 'Category',
      },
      Price: {
        type: DataTypes.DECIMAL(18, 2),
        field: 'Price',
      },
      IsActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: 'IsActive',
      },
    },
    {
      tableName: 'Medicine',
      timestamps: false,
    }
  );

  return Medicine;
};