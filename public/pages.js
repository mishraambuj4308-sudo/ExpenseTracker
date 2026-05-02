// === Page Renderers ===
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const PAY_LABELS = { cash:'Cash', credit_card:'Credit Card', debit_card:'Debit Card', upi:'UPI', net_banking:'Net Banking', wallet:'Wallet', other:'Other' };

const Pages = {
  async dashboard() {
    const now = new Date();
    const m = now.getMonth() + 1, y = now.getFullYear();
    const main = document.getElementById('mainContent');
    main.innerHTML = `<div class="page-header"><h1>📊 <span>Dashboard</span></h1><p style="color:var(--text-secondary)">${MONTHS[m-1]} ${y}</p></div><div class="stats-grid" id="statsGrid"><div class="spinner"></div></div><div class="charts-grid"><div class="card"><div class="card-header"><span class="card-title">Spending by Category</span></div><div class="chart-container"><canvas id="pieChart"></canvas></div></div><div class="card"><div class="card-header"><span class="card-title">Monthly Trend</span></div><div class="chart-container"><canvas id="barChart"></canvas></div></div></div><div class="card"><div class="card-header"><span class="card-title">Recent Transactions</span></div><div id="recentTxns"><div class="spinner"></div></div></div>`;

    try {
      const [stats, txns] = await Promise.all([API.getStats(m, y), API.getTransactions('limit=5&sortBy=date&sortOrder=desc')]);
      const o = stats.overall || {}, mo = stats.monthly || {};
      const bal = (o.totalIncome||0) - (o.totalExpense||0);
      
      document.getElementById('statsGrid').innerHTML = `
        <div class="stat-card income fade-up"><div class="stat-label">Monthly Income</div><div class="stat-value">₹${(mo.monthlyIncome||0).toLocaleString('en-IN')}</div><div class="stat-sub">Total: ₹${(o.totalIncome||0).toLocaleString('en-IN')}</div></div>
        <div class="stat-card expense fade-up"><div class="stat-label">Monthly Expense</div><div class="stat-value">₹${(mo.monthlyExpense||0).toLocaleString('en-IN')}</div><div class="stat-sub">Total: ₹${(o.totalExpense||0).toLocaleString('en-IN')}</div></div>
        <div class="stat-card balance fade-up"><div class="stat-label">Balance</div><div class="stat-value">₹${bal.toLocaleString('en-IN')}</div></div>
        <div class="stat-card count fade-up"><div class="stat-label">Transactions</div><div class="stat-value">${mo.count||0}</div><div class="stat-sub">This month</div></div>`;

      // Pie chart
      const cats = stats.categoryBreakdown || [];
      if (cats.length && document.getElementById('pieChart')) {
        new Chart(document.getElementById('pieChart'), { type: 'doughnut', data: { labels: cats.map(c=>c._id), datasets: [{ data: cats.map(c=>c.total), backgroundColor: ['#6366f1','#ec4899','#f97316','#22c55e','#eab308','#3b82f6','#8b5cf6','#ef4444','#14b8a6','#f43f5e'], borderWidth: 0 }] }, options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { color: '#9393b7', padding: 12, font: { family: 'Inter' } } } } } });
      }

      // Bar chart - monthly trend
      const trend = stats.monthlyTrend || [];
      const trendMap = {};
      trend.forEach(t => {
        const key = `${MONTHS[t._id.month-1]}`;
        if (!trendMap[key]) trendMap[key] = { income: 0, expense: 0 };
        trendMap[key][t._id.type] = t.total;
      });
      const tKeys = Object.keys(trendMap);
      if (tKeys.length && document.getElementById('barChart')) {
        new Chart(document.getElementById('barChart'), { type: 'bar', data: { labels: tKeys, datasets: [{ label: 'Income', data: tKeys.map(k=>trendMap[k].income), backgroundColor: 'rgba(34,197,94,0.7)', borderRadius: 6 }, { label: 'Expense', data: tKeys.map(k=>trendMap[k].expense), backgroundColor: 'rgba(239,68,68,0.7)', borderRadius: 6 }] }, options: { responsive: true, plugins: { legend: { labels: { color: '#9393b7', font: { family: 'Inter' } } } }, scales: { x: { ticks: { color: '#5a5a7a' }, grid: { display: false } }, y: { ticks: { color: '#5a5a7a' }, grid: { color: 'rgba(255,255,255,0.03)' } } } } });
      }

      // Recent transactions
      const list = txns.transactions || [];
      document.getElementById('recentTxns').innerHTML = list.length ? `<table class="transactions-table"><thead><tr><th>Category</th><th>Description</th><th>Date</th><th>Amount</th></tr></thead><tbody>${list.map(t => `<tr><td><div class="txn-category"><span>${t.category}</span></div></td><td>${t.description||'-'}</td><td>${new Date(t.date).toLocaleDateString('en-IN')}</td><td class="txn-amount ${t.type}">${t.type==='income'?'+':'-'}₹${t.amount.toLocaleString('en-IN')}</td></tr>`).join('')}</tbody></table>` : '<div class="empty-state"><div class="empty-icon">📭</div><h3>No transactions yet</h3><p>Add your first transaction to get started!</p></div>';
    } catch(e) { showToast(e.message, 'error'); }
  },

  async transactions() {
    const main = document.getElementById('mainContent');
    main.innerHTML = `<div class="page-header"><h1>💳 <span>Transactions</span></h1><button class="btn btn-primary" onclick="showTransactionModal()">+ Add Transaction</button></div><div class="filters-bar"><input type="text" class="search-input" id="txnSearch" placeholder="🔍 Search transactions..."><select id="txnTypeFilter"><option value="">All Types</option><option value="income">Income</option><option value="expense">Expense</option></select><select id="txnCatFilter"><option value="">All Categories</option></select><input type="date" id="txnStartDate"><input type="date" id="txnEndDate"><button class="btn btn-secondary btn-sm" onclick="applyTxnFilters()">Apply</button><button class="btn btn-secondary btn-sm" onclick="exportTransactions()">📥 Export CSV</button></div><div class="card"><div id="txnTable"><div class="spinner"></div></div><div id="txnPagination"></div></div>`;

    // Load categories into filter
    try {
      const { categories } = await API.getCategories();
      const sel = document.getElementById('txnCatFilter');
      categories.forEach(c => { const o = document.createElement('option'); o.value = c.name; o.textContent = `${c.icon} ${c.name}`; sel.appendChild(o); });
    } catch(e) {}
    loadTransactions();
  },

  async budgets() {
    const now = new Date();
    const m = now.getMonth() + 1, y = now.getFullYear();
    const main = document.getElementById('mainContent');
    main.innerHTML = `<div class="page-header"><h1>🎯 <span>Budgets</span> — ${MONTHS[m-1]} ${y}</h1><button class="btn btn-primary" onclick="showBudgetModal()">+ Set Budget</button></div><div class="budgets-grid" id="budgetsGrid"><div class="spinner"></div></div>`;
    
    try {
      const { budgets } = await API.getBudgets(m, y);
      const grid = document.getElementById('budgetsGrid');
      grid.innerHTML = budgets.length ? budgets.map(b => {
        const pct = Math.min(b.percentage, 100);
        const cls = pct >= 90 ? 'danger' : pct >= 70 ? 'warning' : '';
        return `<div class="budget-card fade-up"><div class="budget-header"><div class="budget-category">${b.category}</div><button class="btn btn-danger btn-sm" onclick="deleteBudget('${b._id}')">🗑</button></div><div class="budget-amounts"><span class="spent">Spent: ₹${b.spent.toLocaleString('en-IN')}</span><span class="limit">Limit: ₹${b.limit.toLocaleString('en-IN')}</span></div><div class="progress-bar"><div class="progress-fill ${cls}" style="width:${pct}%"></div></div><div class="budget-status">${b.remaining >= 0 ? `₹${b.remaining.toLocaleString('en-IN')} remaining` : `Over budget by ₹${Math.abs(b.remaining).toLocaleString('en-IN')}`} (${b.percentage}%)</div></div>`;
      }).join('') : '<div class="empty-state"><div class="empty-icon">🎯</div><h3>No budgets set</h3><p>Set monthly budgets to track your spending!</p></div>';
    } catch(e) { showToast(e.message, 'error'); }
  },

  async reports() {
    const now = new Date();
    const main = document.getElementById('mainContent');
    const startD = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const endD = now.toISOString().split('T')[0];
    main.innerHTML = `<div class="page-header"><h1>📈 <span>Reports</span></h1></div><div class="filters-bar"><input type="date" id="rptStart" value="${startD}"><input type="date" id="rptEnd" value="${endD}"><button class="btn btn-primary btn-sm" onclick="loadReport()">Generate</button><button class="btn btn-secondary btn-sm" onclick="exportTransactions()">📥 Export</button></div><div class="charts-grid"><div class="card"><div class="card-header"><span class="card-title">Expense by Category</span></div><div class="chart-container"><canvas id="rptPie"></canvas></div></div><div class="card"><div class="card-header"><span class="card-title">Daily Spending</span></div><div class="chart-container"><canvas id="rptLine"></canvas></div></div></div><div class="card" style="margin-top:1.2rem"><div class="card-header"><span class="card-title">Payment Methods</span></div><div id="paymentBreakdown"></div></div>`;
    loadReport();
  },

  async categories() {
    const main = document.getElementById('mainContent');
    main.innerHTML = `<div class="page-header"><h1>📁 <span>Categories</span></h1><button class="btn btn-primary" onclick="showCategoryModal()">+ Add Category</button></div><div class="card"><div id="catList"><div class="spinner"></div></div></div>`;
    
    try {
      const { categories } = await API.getCategories();
      const el = document.getElementById('catList');
      const grouped = { expense: categories.filter(c=>c.type==='expense'||c.type==='both'), income: categories.filter(c=>c.type==='income'||c.type==='both') };
      el.innerHTML = `<h3 style="margin-bottom:1rem;color:var(--red)">💸 Expense Categories</h3><div class="budgets-grid">${grouped.expense.map(c=>`<div class="budget-card"><div class="budget-header"><div class="budget-category"><span style="font-size:1.5rem">${c.icon}</span> ${c.name}</div>${c.userId?`<button class="btn btn-danger btn-sm" onclick="deleteCategory('${c._id}')">🗑</button>`:''}</div><div style="display:flex;align-items:center;gap:.5rem"><div style="width:16px;height:16px;border-radius:50%;background:${c.color}"></div><span style="color:var(--text-muted);font-size:.8rem">${c.color}</span></div></div>`).join('')}</div><h3 style="margin:2rem 0 1rem;color:var(--green)">💰 Income Categories</h3><div class="budgets-grid">${grouped.income.map(c=>`<div class="budget-card"><div class="budget-header"><div class="budget-category"><span style="font-size:1.5rem">${c.icon}</span> ${c.name}</div>${c.userId?`<button class="btn btn-danger btn-sm" onclick="deleteCategory('${c._id}')">🗑</button>`:''}</div><div style="display:flex;align-items:center;gap:.5rem"><div style="width:16px;height:16px;border-radius:50%;background:${c.color}"></div><span style="color:var(--text-muted);font-size:.8rem">${c.color}</span></div></div>`).join('')}</div>`;
    } catch(e) { showToast(e.message, 'error'); }
  }
};
