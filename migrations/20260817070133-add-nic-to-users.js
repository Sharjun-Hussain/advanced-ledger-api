'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      await queryInterface.addColumn('users', 'nic', {
        type: Sequelize.STRING(20),
        allowNull: true,
      });
    } catch (e) {
      // Ignored if column already exists
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('users', 'nic');
  }
};
