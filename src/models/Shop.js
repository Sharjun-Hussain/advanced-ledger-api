module.exports = (sequelize, DataTypes) => {
  const Shop = sequelize.define('Shop', {
    name: { type: DataTypes.STRING(150), allowNull: false },
    address: { type: DataTypes.STRING(255), allowNull: true },
    business_type: { type: DataTypes.STRING(80), allowNull: true },
    language_pref: { type: DataTypes.ENUM('sinhala', 'tamil', 'english'), allowNull: false, defaultValue: 'sinhala' },
    phone: { type: DataTypes.STRING(20), allowNull: false, unique: true },
    plan_id: { type: DataTypes.INTEGER, allowNull: true },
    subscription_status: { type: DataTypes.ENUM('trial', 'active', 'expired', 'locked'), allowNull: false, defaultValue: 'trial' },
    trial_ends_at: { type: DataTypes.DATE, allowNull: true },
    plan_ends_at: { type: DataTypes.DATE, allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    textlk_enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  }, {
    tableName: 'shops',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });

  Shop.associate = (models) => {
    Shop.belongsTo(models.Plan, { foreignKey: 'plan_id', as: 'plan' });
    Shop.hasMany(models.User, { foreignKey: 'shop_id', as: 'users' });
    Shop.hasMany(models.Customer, { foreignKey: 'shop_id', as: 'customers' });
    Shop.hasMany(models.Loan, { foreignKey: 'shop_id', as: 'loans' });
  };

  return Shop;
};
