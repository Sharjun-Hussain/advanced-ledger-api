'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      await queryInterface.addColumn('shops', 'logo', {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
    } catch (e) {
      // Ignored if column already exists
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('shops', 'logo');
  }
};
