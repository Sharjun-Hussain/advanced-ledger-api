'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Check if the column exists first to prevent errors on environments that manually added it
    const tableDesc = await queryInterface.describeTable('customers');
    if (!tableDesc.nic) {
      await queryInterface.addColumn('customers', 'nic', {
        type: Sequelize.STRING(20),
        allowNull: true,
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const tableDesc = await queryInterface.describeTable('customers');
    if (tableDesc.nic) {
      await queryInterface.removeColumn('customers', 'nic');
    }
  }
};
