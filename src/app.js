require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const rateLimiter = require('./middleware/rateLimiter');

// Initialize app
const app = express();

// Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev', { stream: logger.stream }));
}
app.use(rateLimiter);

// Health check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'ledger-lk-api', environment: process.env.NODE_ENV });
});

// Import route index
const routes = require('./routes');
app.use('/api', routes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({ status: 'error', message: 'Route not found' });
});

// Error handling
app.use(errorHandler);

module.exports = app;
