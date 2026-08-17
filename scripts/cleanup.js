require('dotenv').config();
const { Sequelize } = require('sequelize');
const config = require('./config/config.js')[process.env.NODE_ENV || 'development'];

const sequelize = new Sequelize(config.database, config.username, config.password, config);

async function cleanup() {
  try {
    await sequelize.query('DROP TABLE IF EXISTS cheques;');
    await sequelize.query('DROP TABLE IF EXISTS accounts;');
    console.log('Cleanup successful.');
  } catch (err) {
    console.error('Cleanup failed:', err);
  } finally {
    await sequelize.close();
  }
}

cleanup();
