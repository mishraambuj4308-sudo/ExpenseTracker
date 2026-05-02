const express = require('express');
const Budget = require('../models/Budget');
const Transaction = require('../models/Transaction');
const auth = require('../middleware/auth');

const router = express.Router();

router.use(auth);

// GET /api/budgets — List budgets for a month
router.get('/', async (req, res) => {
  try {
    const now = new Date();
    const month = parseInt(req.query.month) || (now.getMonth() + 1);
    const year = parseInt(req.query.year) || now.getFullYear();

    const budgets = await Budget.find({ userId: req.userId, month, year });

    // Get actual spending for each budget category
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

    const spending = await Transaction.aggregate([
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
          spent: { $sum: '$amount' }
        }
      }
    ]);

    const spendingMap = {};
    spending.forEach(s => { spendingMap[s._id] = s.spent; });

    const budgetsWithSpending = budgets.map(b => ({
      ...b.toObject(),
      spent: spendingMap[b.category] || 0,
      remaining: b.limit - (spendingMap[b.category] || 0),
      percentage: Math.round(((spendingMap[b.category] || 0) / b.limit) * 100)
    }));

    res.json({ budgets: budgetsWithSpending, period: { month, year } });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching budgets.' });
  }
});

// POST /api/budgets — Create or update budget
router.post('/', async (req, res) => {
  try {
    const { category, limit, month, year } = req.body;
    const now = new Date();
    const m = month || (now.getMonth() + 1);
    const y = year || now.getFullYear();

    // Upsert: create or update
    const budget = await Budget.findOneAndUpdate(
      { userId: req.userId, category, month: m, year: y },
      { userId: req.userId, category, limit, month: m, year: y },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(201).json({ message: 'Budget saved!', budget });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ error: messages.join(', ') });
    }
    res.status(500).json({ error: 'Error saving budget.' });
  }
});

// DELETE /api/budgets/:id — Delete
router.delete('/:id', async (req, res) => {
  try {
    const budget = await Budget.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId
    });

    if (!budget) {
      return res.status(404).json({ error: 'Budget not found.' });
    }

    res.json({ message: 'Budget deleted!' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting budget.' });
  }
});

module.exports = router;
