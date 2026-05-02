const express = require('express');
const Category = require('../models/Category');
const auth = require('../middleware/auth');

const router = express.Router();

router.use(auth);

// GET /api/categories — List all categories (defaults + user custom)
router.get('/', async (req, res) => {
  try {
    const { type } = req.query;
    const query = {
      $or: [
        { userId: null },
        { userId: req.userId }
      ]
    };

    if (type) {
      query.$and = [{ $or: [{ type }, { type: 'both' }] }];
    }

    const categories = await Category.find(query).sort({ name: 1 });
    res.json({ categories });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching categories.' });
  }
});

// POST /api/categories — Create custom category
router.post('/', async (req, res) => {
  try {
    const { name, icon, color, type } = req.body;

    const category = new Category({
      userId: req.userId,
      name, icon, color, type
    });

    await category.save();
    res.status(201).json({ message: 'Category created!', category });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ error: messages.join(', ') });
    }
    res.status(500).json({ error: 'Error creating category.' });
  }
});

// DELETE /api/categories/:id — Delete custom category
router.delete('/:id', async (req, res) => {
  try {
    const category = await Category.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId // Can only delete own categories
    });

    if (!category) {
      return res.status(404).json({ error: 'Category not found or cannot be deleted.' });
    }

    res.json({ message: 'Category deleted!' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting category.' });
  }
});

module.exports = router;
