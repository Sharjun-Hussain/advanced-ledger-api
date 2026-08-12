module.exports = (sequelize, DataTypes) => {
  const Loan = sequelize.define('Loan', {
    shop_id: { type: DataTypes.INTEGER, allowNull: false },
    customer_id: { type: DataTypes.INTEGER, allowNull: false },
    amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    note: { type: DataTypes.STRING(255), allowNull: true },
    created_by: { type: DataTypes.INTEGER, allowNull: true },
    status: { type: DataTypes.ENUM('active', 'paid', 'overdue'), allowNull: false, defaultValue: 'active' },
  }, {
    tableName: 'loans',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
  });

  Loan.associate = (models) => {
    Loan.belongsTo(models.Shop, { foreignKey: 'shop_id', as: 'shop' });
    Loan.belongsTo(models.Customer, { foreignKey: 'customer_id', as: 'customer' });
    Loan.belongsTo(models.User, { foreignKey: 'created_by', as: 'creator' });
  };

  return Loan;
};
