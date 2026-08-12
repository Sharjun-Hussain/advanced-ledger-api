module.exports = (sequelize, DataTypes) => {
  const TextLkCampaign = sequelize.define('TextLkCampaign', {
    shop_id: { type: DataTypes.INTEGER, allowNull: false },
    name: { type: DataTypes.STRING(255), allowNull: false },
    message: { type: DataTypes.TEXT, allowNull: false },
    contact_list_id: { type: DataTypes.STRING(255), allowNull: true },
    dlt_template_id: { type: DataTypes.STRING(255), allowNull: true },
    schedule_time: { type: DataTypes.DATE, allowNull: true },
    status: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'Pending' },
    response_data: { type: DataTypes.JSON, allowNull: true },
  }, {
    tableName: 'textlk_campaigns',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });

  TextLkCampaign.associate = (models) => {
    TextLkCampaign.belongsTo(models.Shop, { foreignKey: 'shop_id', as: 'shop' });
  };

  return TextLkCampaign;
};
