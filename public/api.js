// === API Service Layer ===
const API = {
  base: '/api',
  token: localStorage.getItem('token'),
  
  headers() {
    const h = { 'Content-Type': 'application/json' };
    if (this.token) h['Authorization'] = `Bearer ${this.token}`;
    return h;
  },

  async request(method, path, body) {
    const opts = { method, headers: this.headers() };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(this.base + path, opts);
    if (res.headers.get('content-type')?.includes('text/csv')) return res;
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  },

  setToken(t) { this.token = t; localStorage.setItem('token', t); },
  clearToken() { this.token = null; localStorage.removeItem('token'); },

  // Auth
  register(d) { return this.request('POST', '/auth/register', d); },
  login(d) { return this.request('POST', '/auth/login', d); },
  getMe() { return this.request('GET', '/auth/me'); },

  // Transactions
  getTransactions(params = '') { return this.request('GET', '/transactions' + (params ? '?' + params : '')); },
  getStats(m, y) { return this.request('GET', `/transactions/stats?month=${m}&year=${y}`); },
  addTransaction(d) { return this.request('POST', '/transactions', d); },
  updateTransaction(id, d) { return this.request('PUT', `/transactions/${id}`, d); },
  deleteTransaction(id) { return this.request('DELETE', `/transactions/${id}`); },

  // Budgets
  getBudgets(m, y) { return this.request('GET', `/budgets?month=${m}&year=${y}`); },
  saveBudget(d) { return this.request('POST', '/budgets', d); },
  deleteBudget(id) { return this.request('DELETE', `/budgets/${id}`); },

  // Categories
  getCategories(type) { return this.request('GET', '/categories' + (type ? '?type=' + type : '')); },
  addCategory(d) { return this.request('POST', '/categories', d); },
  deleteCategory(id) { return this.request('DELETE', `/categories/${id}`); },

  // Export
  async exportCSV(params = '') {
    const res = await this.request('GET', '/transactions/export' + (params ? '?' + params : ''));
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'transactions.csv'; a.click();
    URL.revokeObjectURL(url);
  }
};
