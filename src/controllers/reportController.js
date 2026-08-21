const reportService = require('../services/reportService');

class ReportController {
  async getSummary(req, res, next) {
    try {
      const data = await reportService.getSummary(req.user.shop_id, req.query.from, req.query.to);
      res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }

  async getRecentTransactions(req, res, next) {
    try {
      const activityService = require('../services/activityService');
      const data = await activityService.getFeed(req.user.shop_id, req.query.limit || 50);
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }

  async exportCsv(req, res, next) {
    try {
      const rows = await reportService.getExportData(req.user.shop_id, req.query.from, req.query.to);
      const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const header = 'code,name,phone,cycle,issued,paid,balance,locked\n';
      const body = rows.map((r) =>
        [r.customer_code, r.name, r.phone, r.type, r.issued, r.paid, r.balance, r.is_locked]
          .map(esc)
          .join(',')
      ).join('\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="ledger-lk-report.csv"');
      res.send(header + body);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ReportController();
