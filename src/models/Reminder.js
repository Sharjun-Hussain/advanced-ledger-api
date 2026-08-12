module.exports = (sequelize, DataTypes) => {
  const Reminder = sequelize.define('Reminder', {
    shop_id: { type: DataTypes.INTEGER, allowNull: false },
    customer_id: { type: DataTypes.INTEGER, allowNull: true },
    type: { type: DataTypes.ENUM('sms', 'whatsapp', 'push'), allowNull: false, defaultValue: 'sms' },
    message: { type: DataTypes.STRING(500), allowNull: false },
    scheduled_at: { type: DataTypes.DATE, allowNull: false },
    sent_at: { type: DataTypes.DATE, allowNull: true },
    status: { type: DataTypes.ENUM('pending', 'sent', 'failed', 'cancelled'), allowNull: false, defaultValue: 'pending' },
  }, {
    tableName: 'reminders',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
  });

  Reminder.associate = (models) => {
    Reminder.belongsTo(models.Shop, { foreignKey: 'shop_id', as: 'shop' });
    Reminder.belongsTo(models.Customer, { foreignKey: 'customer_id', as: 'customer' });
  };

  return Reminder;
};
