require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('./models/Category');

const defaultCategories = [
  // Expense categories
  { name: 'Food & Dining', icon: '🍔', color: '#f97316', type: 'expense' },
  { name: 'Transport', icon: '🚗', color: '#3b82f6', type: 'expense' },
  { name: 'Shopping', icon: '🛍️', color: '#ec4899', type: 'expense' },
  { name: 'Bills & Utilities', icon: '💡', color: '#eab308', type: 'expense' },
  { name: 'Entertainment', icon: '🎬', color: '#8b5cf6', type: 'expense' },
  { name: 'Healthcare', icon: '🏥', color: '#10b981', type: 'expense' },
  { name: 'Education', icon: '📚', color: '#6366f1', type: 'expense' },
  { name: 'Rent', icon: '🏠', color: '#f43f5e', type: 'expense' },
  { name: 'Groceries', icon: '🛒', color: '#14b8a6', type: 'expense' },
  { name: 'Travel', icon: '✈️', color: '#0ea5e9', type: 'expense' },
  { name: 'Personal Care', icon: '💄', color: '#d946ef', type: 'expense' },
  { name: 'Insurance', icon: '🛡️', color: '#64748b', type: 'expense' },
  { name: 'Subscriptions', icon: '📱', color: '#a855f7', type: 'expense' },
  { name: 'Other Expense', icon: '📦', color: '#78716c', type: 'expense' },

  // Income categories
  { name: 'Salary', icon: '💰', color: '#22c55e', type: 'income' },
  { name: 'Freelance', icon: '💻', color: '#06b6d4', type: 'income' },
  { name: 'Business', icon: '🏢', color: '#f59e0b', type: 'income' },
  { name: 'Investment', icon: '📈', color: '#8b5cf6', type: 'income' },
  { name: 'Rental Income', icon: '🏘️', color: '#ef4444', type: 'income' },
  { name: 'Gift', icon: '🎁', color: '#ec4899', type: 'income' },
  { name: 'Other Income', icon: '💵', color: '#84cc16', type: 'income' }
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Remove existing default categories
    await Category.deleteMany({ userId: null });
    console.log('🗑️  Cleared existing default categories');

    // Insert defaults
    await Category.insertMany(defaultCategories);
    console.log(`✅ Seeded ${defaultCategories.length} default categories`);

    await mongoose.disconnect();
    console.log('Done! You can now start the server.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error.message);
    process.exit(1);
  }
}

seed();
