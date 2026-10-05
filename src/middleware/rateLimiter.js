const { RateLimiterMemory } = require('rate-limiter-flexible');

const rateLimiter = new RateLimiterMemory({
  points: 1000, // 1000 requests
  duration: 15 * 60, // Per 15 minutes
});

// Strict limiters for brute-force / OTP-guess / SMS-burn protection.
const authLimiter = new RateLimiterMemory({ points: 20, duration: 15 * 60 });
const smsLimiter = new RateLimiterMemory({ points: 30, duration: 60 * 60 });

const consume = (limiter) => (req, res, next) => {
  // req.ip respects 'trust proxy' set in app.js
  limiter.consume(req.ip)
    .then(() => {
      next();
    })
    .catch(() => {
      res.status(429).json({
        status: 'error',
        message: 'Too Many Requests'
      });
    });
};

const rateLimiterMiddleware = consume(rateLimiter);

rateLimiterMiddleware.authLimiter = consume(authLimiter);
rateLimiterMiddleware.smsLimiter = consume(smsLimiter);

module.exports = rateLimiterMiddleware;
