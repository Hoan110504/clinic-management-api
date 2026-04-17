/**
 * User Model
 * Handles all user types: admin, doctor, receptionist, pharmacist, patient
 */
import { DataTypes } from 'sequelize';
import bcrypt from 'bcryptjs';
import validator from 'validator';
import config from '../config/index.js';
import { ROLES, GENDER } from '../config/constants.js';

export default (sequelize) => {
  const User = sequelize.define(
    'User',
    {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
        field: 'id',
      },
      username: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
        validate: {
          len: [3, 50],
          isAlphanumeric: true,
        },
      },
      staffCode: {
        type: DataTypes.STRING(16),
        allowNull: true,
        field: 'staff_code',
      },
      email: {
        type: DataTypes.STRING(100),
        allowNull: true,
        // Remove DB-level unique constraint so email can be null for many users on SQL Server
        validate: {
          isEmailOrEmpty(value) {
            // allow null or empty string
            if (value === null || value === '') return;
            if (!validator.isEmail(String(value))) {
              throw new Error('Email không hợp lệ');
            }
          },
        },
      },
      password: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      fullName: {
        type: DataTypes.STRING(100),
        allowNull: false,
        field: 'full_name',
      },
      role: {
        type: DataTypes.TINYINT,
        allowNull: true,
        defaultValue: 5, // ROLES.PATIENT
        validate: {
          isIn: {
            args: [[1, 2, 3, 4, 5]],
            msg: 'Vai trò không hợp lệ',
          },
        },
      },
      phone: {
        type: DataTypes.STRING(15),
        allowNull: true,
        validate: {
          is: /^[0-9+\-\s()]*$/,
        },
      },
      dateOfBirth: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'date_of_birth',
      },
      gender: {
        type: DataTypes.STRING(10),
        allowNull: true,
        validate: {
          isIn: {
            args: [Object.values(GENDER)],
            msg: 'Giới tính không hợp lệ'
          }
        }
      },
      address: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      idNumber: {
        type: DataTypes.STRING(20),
        allowNull: true,
        // unique: true - removed because SQL Server doesn't allow multiple NULLs in unique columns
        field: 'id_number',
      },
      signature: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      avatar: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: 'is_active',
      },
      lastLoginAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'last_login_at',
      },
      refreshToken: {
        type: DataTypes.STRING(500),
        allowNull: true,
        field: 'refresh_token',
      },
      mustChangePassword: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'must_change_password',
      },
    },
    {
      tableName: 'users',
      timestamps: true,
      paranoid: true, // Soft delete
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      deletedAt: 'deleted_at',
      indexes: [
        { fields: ['username'] },
        { fields: ['email'] },
        { fields: ['role'] },
        { fields: ['phone'] },
        { fields: ['is_active'] },
      ],
      hooks: {
        beforeValidate: (user) => {
          // Normalize email: convert empty/whitespace-only string to NULL so DB filtered unique index works
          if (user && Object.prototype.hasOwnProperty.call(user, 'email')) {
            if (user.email === null) return;
            if (String(user.email).trim() === '') {
              user.email = null;
            } else {
              user.email = String(user.email).trim();
            }
          }
        },
        beforeCreate: async (user) => {
          if (user.password) {
            user.password = await bcrypt.hash(
              user.password,
              config.bcrypt.saltRounds
            );
          }
        },
        beforeUpdate: async (user) => {
          if (user.changed('password')) {
            user.password = await bcrypt.hash(
              user.password,
              config.bcrypt.saltRounds
            );
          }
        },
      },
    }
  );

  // Instance methods
  User.prototype.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
  };

  User.prototype.toJSON = function () {
    const values = { ...this.get() };
    delete values.password;
    delete values.refreshToken;
    return values;
  };

  // Class methods
  User.findByUsername = function (username) {
    return this.findOne({ where: { username, isActive: true } });
  };

  User.findByEmail = function (email) {
    return this.findOne({ where: { email, isActive: true } });
  };

  // Associations
  User.associate = (models) => {
    if (models && models.Patient) {
      User.hasOne(models.Patient, { foreignKey: 'userId', as: 'patient' });
    }
    // Link doctor user to medical examinations when present
    if (models && models.MedicalExamination) {
      User.hasMany(models.MedicalExamination, { foreignKey: 'DoctorID', as: 'medicalExaminations' });
    }
    // Người dùng chỉ định dịch vụ (prefer modern LabOrderRequest)
    if (models && (models.LabOrderRequest || models.YeuCauDichVu)) {
      const OrderModel = models.LabOrderRequest || models.YeuCauDichVu;
      User.hasMany(OrderModel, {
        foreignKey: OrderModel.rawAttributes && ('OrderedByUserId' in OrderModel.rawAttributes) ? 'OrderedByUserId' : 'NguoiChiDinhId',
        as: 'YeuCauDichVuChiDinh'
      });
    }
  };

  return User;
};
