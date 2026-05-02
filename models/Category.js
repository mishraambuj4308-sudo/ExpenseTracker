const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  name: {
    type: String,
    required: [true, 'Category name is required'],
    trim: true
  },
  icon: {
    type: String,
    default: '📁'
  },
  color: {
    type: String,
    default: '#6366f1'
  },
  type: {
    type: String,
    enum: ['income', 'expense', 'both'],
    default: 'expense'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

categorySchema.index({ userId: 1, name: 1 });

module.exports = mongoose.model('Category', categorySchema);
