module.exports = (sequelize, DataTypes) => {
  const TextLkTemplate = sequelize.define('TextLkTemplate', {
    shop_id: { type: DataTypes.INTEGER, allowNull: false },
    name: { type: DataTypes.STRING(150), allowNull: false },
    body: { type: DataTypes.TEXT, allowNull: false },
    dlt_template_id: { type: DataTypes.STRING(255), allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  }, {
    tableName: 'textlk_templates',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });

  TextLkTemplate.associate = (models) => {
    TextLkTemplate.belongsTo(models.Shop, { foreignKey: 'shop_id', as: 'shop' });
  };

  return TextLkTemplate;
};
