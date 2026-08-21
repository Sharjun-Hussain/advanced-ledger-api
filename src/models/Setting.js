module.exports = (sequelize, DataTypes) => {
  const Setting = sequelize.define('Setting', {
    shop_id: { type: DataTypes.INTEGER, allowNull: true },
    category: { type: DataTypes.STRING(100), allowNull: false },
    settings_data: { type: DataTypes.JSON, allowNull: false },
  }, {
    tableName: 'settings',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });

  Setting.associate = (models) => {
    Setting.belongsTo(models.Shop, { foreignKey: 'shop_id', as: 'shop' });
  };

  return Setting;
};
