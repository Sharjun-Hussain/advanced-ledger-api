const jwt = require('jsonwebtoken');
const db = require('../models');

const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: token missing' });
  }

  try {
    const payload = verifyToken(token);
    
    // Customer app authentication
    if (payload.role === 'customer') {
      const customer = await db.sequelize.query(
        `SELECT c.id, c.name, c.phone, c.shop_id, c.customer_code, c.is_active,
                'customer' AS role, s.name AS shop_name
           FROM customers c JOIN shops s ON s.id = c.shop_id WHERE c.id = :id`,
        { replacements: { id: payload.sub || payload.id }, type: db.sequelize.QueryTypes.SELECT }
      );
      if (!customer || customer.length === 0 || !customer[0].is_active) {
        return res.status(401).json({ error: 'Unauthorized: inactive or missing customer' });
      }
      req.user = customer[0];
      return next();
    }
    
    // Shop owner / staff / admin authentication
    const user = await db.sequelize.query(
      `SELECT u.id, u.name, u.phone, u.role, u.shop_id, u.is_active,
              s.name AS shop_name, s.plan_id, s.subscription_status,
              s.trial_ends_at, s.plan_ends_at
         FROM users u LEFT JOIN shops s ON s.id = u.shop_id WHERE u.id = :id`,
      { replacements: { id: payload.sub || payload.id }, type: db.sequelize.QueryTypes.SELECT }
    );
    if (!user || user.length === 0 || !user[0].is_active) {
      return res.status(401).json({ error: 'Unauthorized: inactive or missing user' });
    }
    req.user = user[0];
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: invalid token' });
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: insufficient permissions' });
    }
    next();
  };
}

module.exports = {
  signToken,
  verifyToken,
  authenticate,
  authorize,
};
