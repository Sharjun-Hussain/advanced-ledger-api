module.exports = (sequelize, DataTypes) => {
  const Plan = sequelize.define('Plan', {
    name: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    price_monthly: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    price_yearly: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    max_customers: { type: DataTypes.INTEGER, allowNull: true },
    trial_days: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 90 },
    features: { type: DataTypes.JSON, allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  }, {
    tableName: 'plans',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
  });

  Plan.associate = (models) => {
    Plan.hasMany(models.Shop, { foreignKey: 'plan_id', as: 'shops' });
  };

  return Plan;
};
