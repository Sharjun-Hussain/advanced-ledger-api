const app = require('./app');
const logger = require('./utils/logger');

// Database models placeholder
// const db = require('./models');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
    try {
        // Authenticate database here
        // await db.sequelize.authenticate();
        // logger.info('✅ Database connection established successfully.');

        app.listen(PORT, () => {
            logger.info(`🚀 LedgerLK Server listening on port ${PORT}`);
        });
    } catch (error) {
        logger.error(`❌ Failed to start server: ${error.message}`);
        process.exit(1);
    }
};

// Graceful shutdown
const gracefulShutdown = async (signal) => {
    logger.info(`\n${signal} received. Shutting down...`);
    // await db.sequelize.close();
    process.exit(0);
};

process.on('unhandledRejection', (err) => {
    logger.error('UNHANDLED REJECTION! Shutting down...', err);
    process.exit(1);
});

process.on('uncaughtException', (err) => {
    logger.error('UNCAUGHT EXCEPTION! Shutting down...', err);
    process.exit(1);
});

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

startServer();
