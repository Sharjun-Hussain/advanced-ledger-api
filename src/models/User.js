module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    shop_id: { type: DataTypes.INTEGER, allowNull: true },
    name: { type: DataTypes.STRING(100), allowNull: false },
    phone: { type: DataTypes.STRING(20), allowNull: false, unique: true },
    password_hash: { type: DataTypes.STRING(255), allowNull: false },
    role: { type: DataTypes.ENUM('owner', 'staff', 'admin'), allowNull: false, defaultValue: 'staff' },
    permissions: { type: DataTypes.JSON, allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  }, {
    tableName: 'users',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });

  User.associate = (models) => {
    User.belongsTo(models.Shop, { foreignKey: 'shop_id', as: 'shop' });
    User.hasMany(models.Loan, { foreignKey: 'created_by', as: 'created_loans' });
  };

  return User;
};
