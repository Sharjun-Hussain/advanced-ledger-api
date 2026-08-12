module.exports = (sequelize, DataTypes) => {
  const Subscription = sequelize.define('Subscription', {
    shop_id: { type: DataTypes.INTEGER, allowNull: false },
    plan_id: { type: DataTypes.INTEGER, allowNull: false },
    amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    status: { type: DataTypes.ENUM('trial', 'pending', 'paid', 'failed', 'cancelled'), allowNull: false, defaultValue: 'pending' },
    period_start: { type: DataTypes.DATEONLY, allowNull: true },
    period_end: { type: DataTypes.DATEONLY, allowNull: true },
    payhere_txn: { type: DataTypes.STRING(100), allowNull: true },
  }, {
    tableName: 'subscriptions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
  });

  Subscription.associate = (models) => {
    Subscription.belongsTo(models.Shop, { foreignKey: 'shop_id', as: 'shop' });
    Subscription.belongsTo(models.Plan, { foreignKey: 'plan_id', as: 'plan' });
  };

  return Subscription;
};
