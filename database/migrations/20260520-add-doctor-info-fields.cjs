/**
 * Migration: Add doctor information fields to users table
 * 
 * Adds optional fields for doctor profiles to support better AI chatbot recommendations:
 * - specialization: Chuyên khoa (e.g., "Tim mạch", "Tiêu hóa")
 * - qualifications: Học vị/Bằng cấp (e.g., "Thạc sĩ Y khoa", "Bác sĩ chuyên khoa II")
 * - experience_years: Số năm kinh nghiệm
 * - bio: Giới thiệu chi tiết về bác sĩ
 * - consultation_note: Ghi chú về lịch khám/tư vấn
 */

'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'specialization', {
      type: Sequelize.STRING(100),
      allowNull: true,
      comment: 'Chuyên khoa của bác sĩ (e.g., Tim mạch, Tiêu hóa, Nội tổng quát)',
    });

    await queryInterface.addColumn('users', 'qualifications', {
      type: Sequelize.STRING(255),
      allowNull: true,
      comment: 'Học vị và bằng cấp (e.g., Thạc sĩ Y khoa, Bác sĩ chuyên khoa II)',
    });

    await queryInterface.addColumn('users', 'experience_years', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'Số năm kinh nghiệm làm việc',
    });

    await queryInterface.addColumn('users', 'bio', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Giới thiệu chi tiết về bác sĩ, kinh nghiệm, thành tích',
    });

    await queryInterface.addColumn('users', 'consultation_note', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Ghi chú về lịch khám, thời gian tư vấn, hoặc thông tin hữu ích cho bệnh nhân',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('users', 'specialization');
    await queryInterface.removeColumn('users', 'qualifications');
    await queryInterface.removeColumn('users', 'experience_years');
    await queryInterface.removeColumn('users', 'bio');
    await queryInterface.removeColumn('users', 'consultation_note');
  },
};
