const db = require('../models');

class ActivityService {
  /**
   * Universal Logging Method
   * @param {Object} req - The Express Request object (to extract IP and user auth automatically)
   * @param {String} actionType - 'LOGIN', 'LOAN_ADDED', etc.
   * @param {String} entityType - Model name basically: 'User', 'Loan', 'Customer'
   * @param {Number} entityId - Model Primary Key
   * @param {Object} metadata - Optional JSON metadata
   */
  async logAction(req, actionType, entityType = null, entityId = null, metadata = {}) {
    try {
      const shopId = req.user?.shop_id || null;
      const userId = req.user?.id || null;
      const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || null;

      await db.ActivityLog.create({
        shop_id: shopId,
        user_id: userId,
        action_type: actionType,
        entity_type: entityType,
        entity_id: entityId,
        ip_address: ipAddress,
        metadata: metadata
      });
    } catch (err) {
      console.error('Failed to write activity log. Ignoring to prevent blocking process.', err);
    }
  }

  /**
   * System-level logging where we might not have a `req` object.
   */
  async logSystemAction(shopId, userId, actionType, entityType = null, entityId = null, metadata = {}, ipAddress = null) {
    try {
      await db.ActivityLog.create({
        shop_id: shopId,
        user_id: userId,
        action_type: actionType,
        entity_type: entityType,
        entity_id: entityId,
        ip_address: ipAddress,
        metadata: metadata
      });
    } catch (err) {
      console.error('Failed to write system activity log.', err);
    }
  }

  /**
   * Fetch Unified Activity Feed
   */
  async getFeed(shopId, limitStr = '50') {
    const limit = parseInt(limitStr, 10);
    
    // Fetch newly scaffolded activity logs
    const activities = await db.sequelize.query(
      `SELECT a.action_type as type, a.created_at, a.ip_address, a.metadata, 
              u.name as user_name
         FROM activity_logs a
         LEFT JOIN users u ON a.user_id = u.id
        WHERE a.shop_id = :shopId
        ORDER BY a.created_at DESC
        LIMIT :limit`,
      { replacements: { shopId, limit }, type: db.sequelize.QueryTypes.SELECT }
    );

    // Fetch robust legacy transactions (which are basically double-entry financial activities)
    const transactions = await db.sequelize.query(
      `SELECT t.type, t.transaction_date as created_at, t.amount, t.description, t.reference_type,
              c.name as customer_name, a.name as account_name
         FROM transactions t
         LEFT JOIN customers c ON t.customer_id = c.id
         LEFT JOIN accounts a ON t.account_id = a.id
        WHERE t.shop_id = :shopId
        ORDER BY t.transaction_date DESC, t.id DESC
        LIMIT :limit`,
      { replacements: { shopId, limit }, type: db.sequelize.QueryTypes.SELECT }
    );

    // Unify them in JS (fast enough for top ~100 records)
    const unified = [
      ...activities.map(a => ({
        source: 'audit',
        type: a.type,
        created_at: a.created_at,
        actor: a.user_name || 'System',
        ip_address: a.ip_address,
        metadata: typeof a.metadata === 'string' ? JSON.parse(a.metadata) : a.metadata
      })),
      ...transactions.map(t => ({
        source: 'financial',
        type: t.type === 'debit' ? 'FINANCIAL_OUT' : 'FINANCIAL_IN',
        created_at: t.created_at,
        actor: t.customer_name || t.account_name || 'General',
        ip_address: null,
        metadata: {
          amount: t.amount,
          reference: t.reference_type,
          description: t.description
        }
      }))
    ];

    // Sort descending chronologically
    unified.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return unified.slice(0, limit);
  }

  /**
   * Fetch Paginated Feed across ALL shops for Super Admin
   */
  async getAdminFeed({ page = 1, perPage = 15, sortOrder = 'DESC' }) {
    const limit = parseInt(perPage, 10) || 15;
    const offset = (Math.max(1, parseInt(page, 10)) - 1) * limit;

    const query = `
      SELECT a.id, a.action_type as action, a.entity_type as module, a.created_at, a.ip_address, a.metadata as payload, 
             u.name as user_name, u.email as user_email
         FROM activity_logs a
         LEFT JOIN users u ON a.user_id = u.id
        ORDER BY a.created_at ${sortOrder === 'ASC' ? 'ASC' : 'DESC'}
        LIMIT :limit OFFSET :offset
    `;
    const logs = await db.sequelize.query(query, {
      replacements: { limit, offset }, type: db.sequelize.QueryTypes.SELECT
    });

    const [[{ total }]] = await db.sequelize.query('SELECT COUNT(*) as total FROM activity_logs');

    return {
      data: logs.map(a => ({
        id: a.id,
        action: a.action,
        module: a.module,
        created_at: a.created_at,
        description: typeof a.payload === 'string' 
             ? (JSON.parse(a.payload)?.description || 'System log') 
             : (a.payload?.description || 'System Action Captured'),
        ip_address: a.ip_address,
        payload: typeof a.payload === 'string' ? JSON.parse(a.payload) : a.payload,
        user: { name: a.user_name || 'System', email: a.user_email }
      })),
      total: parseInt(total, 10),
      last_page: Math.ceil(parseInt(total, 10) / limit),
      current_page: parseInt(page, 10)
    };
  }
}

module.exports = new ActivityService();
