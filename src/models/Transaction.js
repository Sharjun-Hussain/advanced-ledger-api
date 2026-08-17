module.exports = (sequelize, DataTypes) => {
    const Transaction = sequelize.define('Transaction', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        shop_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        account_id: {
            type: DataTypes.UUID,
            allowNull: false
        },
        amount: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false
        },
        type: {
            type: DataTypes.ENUM('debit', 'credit'),
            allowNull: false
        },
        transaction_date: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        reference_type: {
            type: DataTypes.STRING, 
            allowNull: true
        },
        reference_id: {
            type: DataTypes.STRING, // Use string to accommodate INTs (Shop IDs, Customer IDs) or UUIDs
            allowNull: true
        },
        customer_id: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        description: {
            type: DataTypes.STRING,
            allowNull: true
        }
    }, {
        tableName: 'transactions',
        underscored: true
    });

    Transaction.associate = (models) => {
        Transaction.belongsTo(models.Shop, { as: 'shop', foreignKey: 'shop_id' });
        Transaction.belongsTo(models.Account, { as: 'account', foreignKey: 'account_id' });
        if(models.Customer) {
            Transaction.belongsTo(models.Customer, { as: 'customer', foreignKey: 'customer_id' });
        }
    };

    return Transaction;
};
