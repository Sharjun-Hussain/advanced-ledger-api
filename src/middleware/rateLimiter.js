const { RateLimiterMemory } = require('rate-limiter-flexible');

const rateLimiter = new RateLimiterMemory({
  points: 100, // 100 requests
  duration: 15 * 60, // Per 15 minutes
});

const rateLimiterMiddleware = (req, res, next) => {
  rateLimiter.consume(req.ip)
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

module.exports = rateLimiterMiddleware;
