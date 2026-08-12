module.exports = (sequelize, DataTypes) => {
  const Transaction = sequelize.define('Transaction', {
    shop_id: { type: DataTypes.INTEGER, allowNull: false },
    customer_id: { type: DataTypes.INTEGER, allowNull: false },
    loan_id: { type: DataTypes.INTEGER, allowNull: true },
    type: { type: DataTypes.ENUM('payment', 'loan', 'adjustment'), allowNull: false },
    amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    balance_after: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    created_by: { type: DataTypes.INTEGER, allowNull: true },
  }, {
    tableName: 'transactions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
  });

  Transaction.associate = (models) => {
    Transaction.belongsTo(models.Shop, { foreignKey: 'shop_id', as: 'shop' });
    Transaction.belongsTo(models.Customer, { foreignKey: 'customer_id', as: 'customer' });
    Transaction.belongsTo(models.Loan, { foreignKey: 'loan_id', as: 'loan' });
    Transaction.belongsTo(models.User, { foreignKey: 'created_by', as: 'creator' });
  };

  return Transaction;
};
