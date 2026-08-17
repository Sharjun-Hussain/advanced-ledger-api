'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('accounts', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      shop_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'shops', key: 'id' } },
      name: { type: Sequelize.STRING, allowNull: false },
      code: { type: Sequelize.STRING, allowNull: false },
      type: { type: Sequelize.ENUM('asset', 'liability', 'equity', 'revenue', 'expense'), allowNull: false },
      balance: { type: Sequelize.DECIMAL(15, 2), defaultValue: 0 },
      is_active: { type: Sequelize.BOOLEAN, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });
    
    await queryInterface.addIndex('accounts', ['shop_id', 'code'], { unique: true, name: 'accounts_shop_code_unique_idx' });

    await queryInterface.createTable('cheques', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      shop_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'shops', key: 'id' } },
      type: { type: Sequelize.ENUM('receivable', 'payable'), allowNull: false },
      cheque_number: { type: Sequelize.STRING, allowNull: false },
      bank_name: { type: Sequelize.STRING, allowNull: false },
      branch_name: { type: Sequelize.STRING, allowNull: true },
      amount: { type: Sequelize.DECIMAL(15, 2), allowNull: false },
      cheque_date: { type: Sequelize.DATEONLY, allowNull: false },
      received_issued_date: { type: Sequelize.DATEONLY, allowNull: false },
      status: { type: Sequelize.ENUM('pending', 'cleared', 'bounced', 'cancelled'), allowNull: false, defaultValue: 'pending' },
      cleared_date: { type: Sequelize.DATE, allowNull: true },
      payee_payor_name: { type: Sequelize.STRING, allowNull: true },
      reference_type: { type: Sequelize.STRING, allowNull: true, defaultValue: 'manual' },
      reference_id: { type: Sequelize.UUID, allowNull: true },
      account_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'accounts', key: 'id' } },
      note: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });

    // Rename old transactions
    await queryInterface.renameTable('transactions', 'legacy_transactions');

    // Create new transactions
    await queryInterface.createTable('transactions', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      shop_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'shops', key: 'id' } },
      account_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'accounts', key: 'id' } },
      amount: { type: Sequelize.DECIMAL(15, 2), allowNull: false },
      type: { type: Sequelize.ENUM('debit', 'credit'), allowNull: false },
      transaction_date: { type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      reference_type: { type: Sequelize.STRING, allowNull: true },
      reference_id: { type: Sequelize.STRING, allowNull: true },
      customer_id: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'customers', key: 'id' } },
      description: { type: Sequelize.STRING, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('transactions');
    await queryInterface.renameTable('legacy_transactions', 'transactions');
    await queryInterface.dropTable('cheques');
    await queryInterface.dropTable('accounts');
  }
};
