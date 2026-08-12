module.exports = (sequelize, DataTypes) => {
  const OtpLog = sequelize.define('OtpLog', {
    phone: { type: DataTypes.STRING(20), allowNull: false },
    otp_code: { type: DataTypes.STRING(8), allowNull: false },
    purpose: { type: DataTypes.ENUM('login', 'register'), allowNull: false, defaultValue: 'login' },
    used: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    expires_at: { type: DataTypes.DATE, allowNull: false },
  }, {
    tableName: 'otp_logs',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      {
        fields: ['phone'],
        name: 'idx_otp_phone'
      }
    ]
  });

  return OtpLog;
};
