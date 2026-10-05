const db = require('../models');
const { sendSms } = require('../utils/sms');

const POLICY_CATEGORY = 'reminder_policy';
const RULES_CATEGORY = 'reminder_rules';

// Platform defaults (admin can override via Setting shop_id=null).
// Shop owners customize their own copy (fully per-shop).
const DEFAULT_POLICY = {
  enabled: true,
  cooldown_hours: 24,
  monthly_limit_per_customer: 5,
  daily_shop_cap: 200,
  quiet_start_hour: 20,
  quiet_end_hour: 8,
  only_if_balance: true,
};

// Plan-level ceilings (admin sets per billing plan in web dashboard).
// Stored in Plan.features.reminder_limits — no migration needed.
// Owner policy can only go *stricter* than these, never looser.
const DEFAULT_PLAN_LIMITS = {
  monthly_shop_quota: 500,
  monthly_per_customer_max: 10,
  min_cooldown_hours: 0,
  daily_shop_cap_max: 1000,
  bulk_allowed: true,
  rules_allowed: true,
};

const RULE_TRIGGERS = ['balance_exceeds', 'loan_limit_exceeded', 'overdue_days', 'month_end'];

function parseJsonSafe(raw, fallback) {
  if (raw == null) return fallback;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return fallback;
  }
}

function renderTemplate(template, vars) {
  return String(template)
    .replace(/{customer_name}/g, vars.customer_name ?? '')
    .replace(/{shop_name}/g, vars.shop_name ?? '')
    .replace(/{balance}/g, vars.balance ?? '')
    .replace(/{amount}/g, vars.amount ?? vars.balance ?? '');
}

class ReminderService {
  // ---------- Policy & rules store (per-shop customizable) ----------
  async getPlanLimits(shopId) {
    const shop = await db.Shop.findByPk(shopId);
    let planLimits = {};
    if (shop?.plan_id) {
      const plan = await db.Plan.findByPk(shop.plan_id);
      planLimits = parseJsonSafe(plan?.features, {}).reminder_limits || {};
    }
    return { ...DEFAULT_PLAN_LIMITS, ...planLimits };
  }

  async getPolicy(shopId) {
    const [globalRow, shopRow] = await Promise.all([
      db.Setting.findOne({ where: { shop_id: null, category: POLICY_CATEGORY } }),
      db.Setting.findOne({ where: { shop_id: shopId, category: POLICY_CATEGORY } }),
    ]);
    const shopPolicy = {
      ...DEFAULT_POLICY,
      ...parseJsonSafe(globalRow?.settings_data, {}),
      ...parseJsonSafe(shopRow?.settings_data, {}),
    };
    const planLimits = await this.getPlanLimits(shopId);
    // Effective = owner policy clamped to plan ceilings.
    const effective = {
      ...shopPolicy,
      cooldown_hours: Math.max(shopPolicy.cooldown_hours, planLimits.min_cooldown_hours),
      monthly_limit_per_customer: Math.min(shopPolicy.monthly_limit_per_customer, planLimits.monthly_per_customer_max),
      daily_shop_cap: Math.min(shopPolicy.daily_shop_cap, planLimits.daily_shop_cap_max),
    };
    return { policy: effective, shop_policy: shopPolicy, plan_limits: planLimits };
  }

  async savePolicy(shopId, patch) {
    const allowed = ['enabled', 'cooldown_hours', 'monthly_limit_per_customer', 'daily_shop_cap', 'quiet_start_hour', 'quiet_end_hour', 'only_if_balance'];
    const clean = {};
    for (const k of allowed) {
      if (patch[k] !== undefined) clean[k] = patch[k];
    }    if (clean.cooldown_hours !== undefined && (clean.cooldown_hours < 0 || clean.cooldown_hours > 24 * 30)) {
      throw { statusCode: 400, message: 'cooldown_hours must be 0–720' };
    }
    if (clean.monthly_limit_per_customer !== undefined && (clean.monthly_limit_per_customer < 1 || clean.monthly_limit_per_customer > 100)) {
      throw { statusCode: 400, message: 'monthly_limit_per_customer must be 1–100' };
    }
    if (clean.daily_shop_cap !== undefined && (clean.daily_shop_cap < 1 || clean.daily_shop_cap > 5000)) {
      throw { statusCode: 400, message: 'daily_shop_cap must be 1–5000' };
    }
    // Plan ceilings: owner can only go stricter than their billing plan.
    const planLimits = await this.getPlanLimits(shopId);
    if (clean.cooldown_hours !== undefined && clean.cooldown_hours < planLimits.min_cooldown_hours) {
      throw { statusCode: 403, message: `Your plan requires cooldown of at least ${planLimits.min_cooldown_hours}h. Upgrade to send more often.` };
    }
    if (clean.monthly_limit_per_customer !== undefined && clean.monthly_limit_per_customer > planLimits.monthly_per_customer_max) {
      throw { statusCode: 403, message: `Your plan allows max ${planLimits.monthly_per_customer_max} reminders/customer/month. Upgrade for more.` };
    }
    if (clean.daily_shop_cap !== undefined && clean.daily_shop_cap > planLimits.daily_shop_cap_max) {
      throw { statusCode: 403, message: `Your plan allows max ${planLimits.daily_shop_cap_max}/day. Upgrade for more.` };
    }
    const [row] = await db.Setting.findOrCreate({
      where: { shop_id: shopId, category: POLICY_CATEGORY },
      defaults: { settings_data: { ...DEFAULT_POLICY, ...clean } },
    });
    const merged = { ...parseJsonSafe(row.settings_data, {}), ...clean };
    await row.update({ settings_data: merged });
    return merged;
  }

  async getRules(shopId) {
    const row = await db.Setting.findOne({ where: { shop_id: shopId, category: RULES_CATEGORY } });
    const data = parseJsonSafe(row?.settings_data, { rules: [] });
    return Array.isArray(data.rules) ? data.rules : [];
  }

  async saveRule(shopId, rule) {
    if (!rule.name || !RULE_TRIGGERS.includes(rule.trigger)) {
      throw { statusCode: 400, message: `trigger must be one of: ${RULE_TRIGGERS.join(', ')}` };
    }
    const planLimits = await this.getPlanLimits(shopId);
    if (!planLimits.rules_allowed) {
      throw { statusCode: 403, message: 'Automation rules are not included in your plan. Upgrade to enable.' };
    }
    const rules = await this.getRules(shopId);
    const entry = {
      id: rule.id || `rule_${Date.now()}`,
      name: String(rule.name).slice(0, 80),
      enabled: rule.enabled !== false,
      trigger: rule.trigger,
      threshold: Number(rule.threshold ?? 0),
      template: String(rule.template || '').slice(0, 500),
      last_run_at: rule.last_run_at || null,
    };
    const idx = rules.findIndex((r) => r.id === entry.id);
    if (idx >= 0) rules[idx] = entry;
    else rules.push(entry);
    const [row] = await db.Setting.findOrCreate({
      where: { shop_id: shopId, category: RULES_CATEGORY },
      defaults: { settings_data: { rules } },
    });
    await row.update({ settings_data: { rules } });
    return entry;
  }

  async deleteRule(shopId, ruleId) {
    const rules = await this.getRules(shopId);
    const kept = rules.filter((r) => r.id !== ruleId);
    const [row] = await db.Setting.findOrCreate({
      where: { shop_id: shopId, category: RULES_CATEGORY },
      defaults: { settings_data: { rules: kept } },
    });
    await row.update({ settings_data: { rules: kept } });
    return { deleted: kept.length !== rules.length };
  }

  // ---------- Limit checks ----------
  // Accepts either the effective policy object or the full getPolicy() result.
  async checkLimits(shopId, customerId, policyOrBundle) {
    let pol = policyOrBundle;
    let planLimits = null;
    if (pol && pol.policy) {
      planLimits = pol.plan_limits;
      pol = pol.policy;
    }
    if (!pol) {
      const bundle = await this.getPolicy(shopId);
      pol = bundle.policy;
      planLimits = bundle.plan_limits;
    }
    if (!planLimits) planLimits = await this.getPlanLimits(shopId);
    if (!pol.enabled) throw { statusCode: 403, message: 'Reminders are disabled for this shop' };

    // Quiet hours (Asia/Colombo).
    const nowColombo = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Colombo' }));
    const hour = nowColombo.getHours();
    const inQuiet = pol.quiet_start_hour < pol.quiet_end_hour
      ? (hour >= pol.quiet_start_hour && hour < pol.quiet_end_hour)
      : (hour >= pol.quiet_start_hour || hour < pol.quiet_end_hour);
    if (inQuiet) {
      throw { statusCode: 429, message: `Quiet hours (${pol.quiet_start_hour}:00–${pol.quiet_end_hour}:00). Try later.` };
    }

    if (pol.cooldown_hours > 0) {
      const [last] = await db.sequelize.query(
        `SELECT sent_at FROM reminders WHERE shop_id = :shopId AND customer_id = :customerId AND status = 'sent' ORDER BY sent_at DESC LIMIT 1`,
        { replacements: { shopId, customerId }, type: db.sequelize.QueryTypes.SELECT }
      );
      if (last?.sent_at) {
        const hoursSince = (Date.now() - new Date(last.sent_at).getTime()) / 3600000;
        if (hoursSince < pol.cooldown_hours) {
          const wait = Math.ceil(pol.cooldown_hours - hoursSince);
          throw { statusCode: 429, message: `Cooldown: last reminder ${Math.floor(hoursSince)}h ago. Wait ~${wait}h.`, retry_after_hours: wait };
        }
      }
    }

    const [{ sent_this_month }] = await db.sequelize.query(
      `SELECT COUNT(*) AS sent_this_month FROM reminders
        WHERE shop_id = :shopId AND customer_id = :customerId AND status = 'sent'
          AND sent_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')`,
      { replacements: { shopId, customerId }, type: db.sequelize.QueryTypes.SELECT }
    );
    if (Number(sent_this_month) >= pol.monthly_limit_per_customer) {
      throw { statusCode: 429, message: `Monthly limit reached (${pol.monthly_limit_per_customer}/customer).` };
    }

    const [{ sent_today }] = await db.sequelize.query(
      `SELECT COUNT(*) AS sent_today FROM reminders WHERE shop_id = :shopId AND status = 'sent' AND DATE(sent_at) = CURDATE()`,
      { replacements: { shopId }, type: db.sequelize.QueryTypes.SELECT }
    );
    if (Number(sent_today) >= pol.daily_shop_cap) {
      throw { statusCode: 429, message: `Daily shop cap reached (${pol.daily_shop_cap}). Try tomorrow.` };
    }

    // Plan-level monthly shop quota (billing plan ceiling).
    const [{ sent_this_month_shop }] = await db.sequelize.query(
      `SELECT COUNT(*) AS sent_this_month_shop FROM reminders
        WHERE shop_id = :shopId AND status = 'sent'
          AND sent_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')`,
      { replacements: { shopId }, type: db.sequelize.QueryTypes.SELECT }
    );
    if (Number(sent_this_month_shop) >= planLimits.monthly_shop_quota) {
      throw { statusCode: 429, message: `Plan monthly quota reached (${planLimits.monthly_shop_quota} SMS). Upgrade your plan.` };
    }
  }

  async sendReminder(shopId, data) {
    const { policy } = await this.getPolicy(shopId);
    const shop = await db.Shop.findByPk(shopId);
    const shopPrefix = shop && shop.name ? shop.name : 'LedgerLK';

    const customer = await db.Customer.findOne({ where: { id: data.customerId, shop_id: shopId } });
    if (!customer) throw { statusCode: 404, message: 'Customer not found' };
    if (!customer.phone) throw { statusCode: 400, message: 'Customer has no phone number for SMS' };
    if (policy.only_if_balance && Number(customer.balance) <= 0) {
      throw { statusCode: 400, message: 'Customer has no outstanding balance — nothing to remind.' };
    }

    // Per-shop customizable cooldown/quota enforcement.
    await this.checkLimits(shopId, customer.id, policy);

    const text = data.message?.trim() ||
      `${shopPrefix}: Dear ${customer.name}, your outstanding balance is Rs. ${Number(customer.balance).toFixed(2)}. Please settle your payment. Thank you.`;

    let delivered = false;
    let stub = false;
    try {
      const result = await sendSms(shopId, { to: customer.phone, message: text });
      delivered = result.delivered;
      stub = result.stub;
    } catch (err) {
      console.warn('SMS failed:', err.message);
    }

    await db.Reminder.create({
      shop_id: shopId,
      customer_id: data.customerId,
      type: 'sms',
      message: text,
      scheduled_at: new Date(),
      sent_at: delivered ? new Date() : null,
      status: delivered ? 'sent' : 'failed'
    });

    return { delivered, stub, status: delivered ? 'sent' : 'failed' };
  }

  async getReminders(shopId, query = {}) {
    const rawLimit = parseInt(query.limit ?? query.limitParam ?? 50, 10);
    const rawPage = parseInt(query.page ?? 1, 10);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 200) : 50;
    const page = Number.isFinite(rawPage) ? Math.max(rawPage, 1) : 1;
    const offset = (page - 1) * limit;
    // NOTE: LIMIT/OFFSET interpolated as validated integers (mysql2 cannot bind them).
    const reminders = await db.sequelize.query(
      `SELECT r.id, r.type, r.message, r.status, r.sent_at, c.name AS customer_name
         FROM reminders r LEFT JOIN customers c ON c.id = r.customer_id
        WHERE r.shop_id = :shopId ORDER BY r.sent_at DESC, r.id DESC
        LIMIT ${limit} OFFSET ${offset}`,
      { replacements: { shopId }, type: db.sequelize.QueryTypes.SELECT }
    );
    const [{ total }] = await db.sequelize.query(
      `SELECT COUNT(*) AS total FROM reminders WHERE shop_id = :shopId`,
      { replacements: { shopId }, type: db.sequelize.QueryTypes.SELECT }
    );
    return { reminders, total: Number(total), page, limit };
  }

  // ---------- Month-end bulk send (respects per-shop limits) ----------
  async sendBulk(shopId, { dry_run = false, max = 200 } = {}) {
    const bundle = await this.getPolicy(shopId);
    if (!bundle.plan_limits.bulk_allowed) {
      throw { statusCode: 403, message: 'Bulk send is not included in your plan. Upgrade to enable.' };
    }
    const policy = bundle;
    const debtors = await db.Customer.findAll({
      where: { shop_id: shopId, kind: 'customer', is_active: true },
    });
    const eligible = debtors.filter((c) => Number(c.balance) > 0 && c.phone);
    const summary = { eligible: eligible.length, sent: 0, skipped: 0, failed: 0, dry_run, details: [] };
    const cap = Math.min(max, 500);
    for (const customer of eligible.slice(0, cap)) {
      try {
        await this.checkLimits(shopId, customer.id, policy);
      } catch (err) {
        summary.skipped += 1;
        summary.details.push({ customer_id: customer.id, name: customer.name, skipped: err.message });
        continue;
      }
      if (dry_run) {
        summary.sent += 1;
        summary.details.push({ customer_id: customer.id, name: customer.name, dry_run: true });
        continue;
      }
      try {
        const r = await this.sendReminder(shopId, { customerId: customer.id });
        if (r.delivered) {
          summary.sent += 1;
        } else {
          summary.failed += 1;
        }
        summary.details.push({ customer_id: customer.id, name: customer.name, status: r.status });
      } catch (err) {
        // checkLimits race inside sendReminder or gateway error
        summary.skipped += 1;
        summary.details.push({ customer_id: customer.id, name: customer.name, skipped: err.message || 'send failed' });
      }
    }
    return summary;
  }

  // ---------- Automation rule evaluation (called by cron + manual run) ----------
  async evaluateRules(shopId, { dry_run = false } = {}) {
    const rules = (await this.getRules(shopId)).filter((r) => r.enabled);
    const shop = await db.Shop.findByPk(shopId);
    const shopName = shop?.name || 'LedgerLK';
    const summary = { evaluated: rules.length, sent: 0, skipped: 0, details: [] };
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    for (const rule of rules) {
      let targets = [];
      if (rule.trigger === 'balance_exceeds') {
        targets = await db.Customer.findAll({ where: { shop_id: shopId, is_active: true } });
        targets = targets.filter((c) => Number(c.balance) >= Number(rule.threshold || 0) && Number(c.balance) > 0 && c.phone);
      } else if (rule.trigger === 'loan_limit_exceeded') {
        targets = await db.Customer.findAll({ where: { shop_id: shopId, is_active: true } });
        targets = targets.filter((c) => Number(c.loan_limit) > 0 && Number(c.balance) >= Number(c.loan_limit) && c.phone);
      } else if (rule.trigger === 'overdue_days') {
        const days = Number(rule.threshold || 30);
        const cutoff = new Date(Date.now() - days * 86400000);
        const rows = await db.sequelize.query(
          `SELECT DISTINCT l.customer_id FROM loans l JOIN customers c ON c.id = l.customer_id
            WHERE l.shop_id = :shopId AND l.status = 'active' AND l.created_at <= :cutoff AND c.balance > 0`,
          { replacements: { shopId, cutoff }, type: db.sequelize.QueryTypes.SELECT }
        );
        const ids = rows.map((r) => r.customer_id);
        if (ids.length) {
          targets = await db.Customer.findAll({ where: { shop_id: shopId, id: ids } });
          targets = targets.filter((c) => c.phone);
        }
      } else if (rule.trigger === 'month_end') {
        if (now.getDate() !== lastDay && !dry_run) {
          summary.details.push({ rule: rule.name, skipped: 'not month-end' });
          continue;
        }
        targets = await db.Customer.findAll({ where: { shop_id: shopId, kind: 'customer', is_active: true } });
        targets = targets.filter((c) => Number(c.balance) > 0 && c.phone);
      }

      for (const customer of targets) {
        const text = rule.template
          ? renderTemplate(rule.template, { customer_name: customer.name, shop_name: shopName, balance: Number(customer.balance).toFixed(2) })
          : undefined;
        if (dry_run) {
          summary.sent += 1;
          summary.details.push({ rule: rule.name, customer: customer.name, dry_run: true });
          continue;
        }
        try {
          const r = await this.sendReminder(shopId, { customerId: customer.id, message: text });
          if (r.delivered) summary.sent += 1;
          else summary.skipped += 1;
          summary.details.push({ rule: rule.name, customer: customer.name, status: r.status });
        } catch (err) {
          summary.skipped += 1;
          summary.details.push({ rule: rule.name, customer: customer.name, skipped: err.message });
        }
      }
      rule.last_run_at = new Date().toISOString();
      await this.saveRule(shopId, rule);
    }
    return summary;
  }
}

module.exports = new ReminderService();
