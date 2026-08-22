'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // For MySQL and PostgreSQL, changing ENUM values can sometimes be tricky with Sequelize's changeColumn.
    // However, Sequelize changeColumn often works well if the type string is well-formed.
    // If it fails, raw query is preferred, but let's try standard changeColumn first.
    // A safer alternative for MySQL/MariaDB:
    return queryInterface.sequelize.query(
      "ALTER TABLE `otp_logs` MODIFY COLUMN `purpose` ENUM('login', 'register', 'forgot_password') NOT NULL DEFAULT 'login';"
    );
  },

  down: async (queryInterface, Sequelize) => {
    // Revert back, Note: will fail if existing rows have 'forgot_password'
    return queryInterface.sequelize.query(
      "ALTER TABLE `otp_logs` MODIFY COLUMN `purpose` ENUM('login', 'register') NOT NULL DEFAULT 'login';"
    );
  }
};
