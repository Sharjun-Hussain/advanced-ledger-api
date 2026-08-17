module.exports = (sequelize, DataTypes) => {
    const Account = sequelize.define('Account', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        shop_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        code: {
            type: DataTypes.STRING,
            allowNull: false
        },
        type: {
            type: DataTypes.ENUM('asset', 'liability', 'equity', 'revenue', 'expense'),
            allowNull: false
        },
        balance: {
            type: DataTypes.DECIMAL(15, 2),
            defaultValue: 0.00
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        }
    }, {
        tableName: 'accounts',
        underscored: true,
        indexes: [
            {
                name: 'accounts_shop_code_unique_idx',
                unique: true,
                fields: ['shop_id', 'code']
            }
        ]
    });

    Account.associate = (models) => {
        Account.belongsTo(models.Shop, { as: 'shop', foreignKey: 'shop_id' });
        if (models.Transaction) {
            Account.hasMany(models.Transaction, { as: 'transactions', foreignKey: 'account_id' });
        }
        if (models.Cheque) {
            Account.hasMany(models.Cheque, { as: 'cheques', foreignKey: 'account_id' });
        }
    };

    return Account;
};
