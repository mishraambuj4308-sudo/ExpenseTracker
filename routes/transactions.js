const express = require('express');
const Transaction = require('../models/Transaction');
const auth = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(auth);

// GET /api/transactions — List with filtering, search, pagination
router.get('/', async (req, res) => {
  try {
    const {
      type, category, paymentMethod,
      startDate, endDate,
      search, sortBy = 'date', sortOrder = 'desc',
      page = 1, limit = 20
    } = req.query;

    const query = { userId: req.userId };

    if (type) query.type = type;
    if (category) query.category = category;
    if (paymentMethod) query.paymentMethod = paymentMethod;

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate + 'T23:59:59.999Z');
    }

    if (search) {
      query.$or = [
        { description: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [transactions, total] = await Promise.all([
      Transaction.find(query).sort(sort).skip(skip).limit(parseInt(limit)),
      Transaction.countDocuments(query)
    ]);

    res.json({
      transactions,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching transactions.' });
  }
});

// GET /api/transactions/stats — Dashboard statistics
router.get('/stats', async (req, res) => {
  try {
    const { month, year } = req.query;
    const now = new Date();
    const m = parseInt(month) || (now.getMonth() + 1);
    const y = parseInt(year) || now.getFullYear();

    const startOfMonth = new Date(y, m - 1, 1);
    const endOfMonth = new Date(y, m, 0, 23, 59, 59, 999);

    // Overall totals
    const [totalStats] = await Transaction.aggregate([
      { $match: { userId: req.userId } },
      {
        $group: {
          _id: null,
          totalIncome: { $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] } },
          totalExpense: { $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] } },
          count: { $sum: 1 }
        }
      }
    ]);

    // Monthly totals
    const [monthlyStats] = await Transaction.aggregate([
      {
        $match: {
          userId: req.userId,
          date: { $gte: startOfMonth, $lte: endOfMonth }
        }
      },
      {
        $group: {
          _id: null,
          monthlyIncome: { $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] } },
          monthlyExpense: { $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] } },
          count: { $sum: 1 }
        }
      }
    ]);

    // Category breakdown for the month
    const categoryBreakdown = await Transaction.aggregate([
      {
        $match: {
          userId: req.userId,
          type: 'expense',
          date: { $gte: startOfMonth, $lte: endOfMonth }
        }
      },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { total: -1 } }
    ]);

    // Daily spending for the month (for line chart)
    const dailySpending = await Transaction.aggregate([
      {
        $match: {
          userId: req.userId,
          type: 'expense',
          date: { $gte: startOfMonth, $lte: endOfMonth }
        }
      },
      {
        $group: {
          _id: { $dayOfMonth: '$date' },
          total: { $sum: '$amount' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Monthly trend (last 6 months)
    const sixMonthsAgo = new Date(y, m - 7, 1);
    const monthlyTrend = await Transaction.aggregate([
      {
        $match: {
          userId: req.userId,
          date: { $gte: sixMonthsAgo, $lte: endOfMonth }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' },
            type: '$type'
          },
          total: { $sum: '$amount' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Payment method breakdown
    const paymentBreakdown = await Transaction.aggregate([
      {
        $match: {
          userId: req.userId,
          type: 'expense',
          date: { $gte: startOfMonth, $lte: endOfMonth }
        }
      },
      {
        $group: {
          _id: '$paymentMethod',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { total: -1 } }
    ]);

    res.json({
      overall: totalStats || { totalIncome: 0, totalExpense: 0, count: 0 },
      monthly: monthlyStats || { monthlyIncome: 0, monthlyExpense: 0, count: 0 },
      categoryBreakdown,
      dailySpending,
      monthlyTrend,
      paymentBreakdown,
      period: { month: m, year: y }
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Error fetching statistics.' });
  }
});

// GET /api/transactions/export — CSV export
router.get('/export', async (req, res) => {
  try {
    const { startDate, endDate, type, category } = req.query;
    const query = { userId: req.userId };

    if (type) query.type = type;
    if (category) query.category = category;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate + 'T23:59:59.999Z');
    }

    const transactions = await Transaction.find(query).sort({ date: -1 });

    // Build CSV
    const headers = 'Date,Type,Category,Amount,Description,Payment Method,Tags\n';
    const rows = transactions.map(t => {
      const date = new Date(t.date).toLocaleDateString('en-IN');
      const desc = (t.description || '').replace(/,/g, ';');
      const tags = (t.tags || []).join('; ');
      const payment = (t.paymentMethod || '').replace(/_/g, ' ');
      return `${date},${t.type},${t.category},${t.amount},"${desc}",${payment},"${tags}"`;
    }).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=transactions.csv');
    res.send(headers + rows);
  } catch (error) {
    res.status(500).json({ error: 'Error exporting transactions.' });
  }
});

// POST /api/transactions — Create
router.post('/', async (req, res) => {
  try {
    const { type, amount, category, description, date, paymentMethod, isRecurring, recurringFrequency, tags } = req.body;

    const transaction = new Transaction({
      userId: req.userId,
      type, amount, category, description,
      date: date || new Date(),
      paymentMethod, isRecurring, recurringFrequency,
      tags: tags || []
    });

    await transaction.save();
    res.status(201).json({ message: 'Transaction added!', transaction });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ error: messages.join(', ') });
    }
    res.status(500).json({ error: 'Error creating transaction.' });
  }
});

// PUT /api/transactions/:id — Update
router.put('/:id', async (req, res) => {
  try {
    const transaction = await Transaction.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found.' });
    }

    res.json({ message: 'Transaction updated!', transaction });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ error: messages.join(', ') });
    }
    res.status(500).json({ error: 'Error updating transaction.' });
  }
});

// DELETE /api/transactions/:id — Delete
router.delete('/:id', async (req, res) => {
  try {
    const transaction = await Transaction.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found.' });
    }

    res.json({ message: 'Transaction deleted!' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting transaction.' });
  }
});

module.exports = router;
