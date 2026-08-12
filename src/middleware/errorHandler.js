const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
    logger.error(`[Error] ${err.message} | Path: ${req.path}`);
    
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    res.status(statusCode).json({
        status: 'error',
        message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
};

module.exports = errorHandler;
