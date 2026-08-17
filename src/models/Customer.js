module.exports = (sequelize, DataTypes) => {
  const Customer = sequelize.define('Customer', {
    shop_id: { type: DataTypes.INTEGER, allowNull: false },
    kind: { type: DataTypes.ENUM('customer', 'distributor'), allowNull: false, defaultValue: 'customer' },
    customer_code: { type: DataTypes.STRING(20), allowNull: false },
    name: { type: DataTypes.STRING(100), allowNull: false },
    phone: { type: DataTypes.STRING(20), allowNull: true },
    nic: { type: DataTypes.STRING(20), allowNull: true },
    qr_code: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    type: { type: DataTypes.ENUM('daily', 'weekly', 'monthly', 'custom'), allowNull: false, defaultValue: 'daily' },
    custom_cycle_days: { type: DataTypes.INTEGER, allowNull: true },
    loan_limit: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    balance: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    is_locked: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  }, {
    tableName: 'customers',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        unique: true,
        fields: ['shop_id', 'customer_code'],
        name: 'uq_customers_shop_code'
      }
    ]
  });

  Customer.associate = (models) => {
    Customer.belongsTo(models.Shop, { foreignKey: 'shop_id', as: 'shop' });
    Customer.hasMany(models.Loan, { foreignKey: 'customer_id', as: 'loans' });
  };

  return Customer;
};
