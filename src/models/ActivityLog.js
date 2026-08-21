module.exports = (sequelize, DataTypes) => {
  const ActivityLog = sequelize.define('ActivityLog', {
    shop_id: { type: DataTypes.INTEGER, allowNull: true },
    user_id: { type: DataTypes.INTEGER, allowNull: true },
    action_type: { type: DataTypes.STRING(100), allowNull: false },
    entity_type: { type: DataTypes.STRING(100), allowNull: true },
    entity_id: { type: DataTypes.INTEGER, allowNull: true },
    ip_address: { type: DataTypes.STRING(45), allowNull: true },
    metadata: { type: DataTypes.JSON, allowNull: true },
  }, {
    tableName: 'activity_logs',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false, // Activity logs are immutable, they don't get updated
    indexes: [
      { fields: ['shop_id'] },
      { fields: ['user_id'] },
      { fields: ['action_type'] },
      { fields: ['created_at'] }
    ]
  });

  ActivityLog.associate = (models) => {
    ActivityLog.belongsTo(models.Shop, { foreignKey: 'shop_id', as: 'shop' });
    ActivityLog.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
  };

  return ActivityLog;
};
