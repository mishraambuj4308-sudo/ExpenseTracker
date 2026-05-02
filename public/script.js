// === Main App Controller ===
let currentPage = 'dashboard';
let currentUser = null;

// Toast notification
function showToast(msg, type = 'info') {
  const c = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3000);
}

// Navigation
function navigateTo(page) {
  currentPage = page;
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === page));
  if (Pages[page]) Pages[page]();
  // Close mobile sidebar
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebarOverlay')?.classList.remove('open');
}

// Auth handling
async function initApp() {
  const token = localStorage.getItem('token');
  if (token) {
    API.token = token;
    try {
      const { user } = await API.getMe();
      currentUser = user;
      showApp();
    } catch(e) { API.clearToken(); showAuth(); }
  } else { showAuth(); }
}

function showAuth() {
  document.getElementById('authPage').classList.remove('hidden');
  document.getElementById('appPage').classList.add('hidden');
}

function showApp() {
  document.getElementById('authPage').classList.add('hidden');
  document.getElementById('appPage').classList.remove('hidden');
  if (currentUser) {
    document.getElementById('userName').textContent = currentUser.name;
    document.getElementById('userEmail').textContent = currentUser.email;
    document.getElementById('userAvatar').textContent = currentUser.name.charAt(0).toUpperCase();
  }
  navigateTo('dashboard');
}

// Auth form
let isLogin = true;
document.getElementById('authToggle').addEventListener('click', () => {
  isLogin = !isLogin;
  document.getElementById('authTitle').innerHTML = isLogin ? 'Welcome to <span>ExpenseFlow</span>' : 'Create <span>Account</span>';
  document.getElementById('authSubtitle').textContent = isLogin ? 'Sign in to manage your finances' : 'Start tracking your expenses today';
  document.getElementById('nameGroup').classList.toggle('hidden', isLogin);
  document.getElementById('authSubmitBtn').textContent = isLogin ? 'Sign In' : 'Sign Up';
  document.getElementById('authToggleText').textContent = isLogin ? "Don't have an account?" : 'Already have an account?';
  document.getElementById('authToggle').textContent = isLogin ? 'Sign Up' : 'Sign In';
});

document.getElementById('authForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('authSubmitBtn');
  btn.disabled = true; btn.textContent = 'Please wait...';
  try {
    const payload = { email: document.getElementById('authEmail').value, password: document.getElementById('authPassword').value };
    if (!isLogin) payload.name = document.getElementById('authName').value;
    const data = isLogin ? await API.login(payload) : await API.register(payload);
    API.setToken(data.token);
    currentUser = data.user;
    showToast(data.message, 'success');
    showApp();
  } catch(e) { showToast(e.message, 'error'); }
  btn.disabled = false; btn.textContent = isLogin ? 'Sign In' : 'Sign Up';
});

// Sidebar nav clicks
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => navigateTo(item.dataset.page));
});

// Mobile menu
document.getElementById('menuToggle')?.addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('open');
});
document.getElementById('sidebarOverlay')?.addEventListener('click', () => {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
});

// Logout
document.getElementById('logoutBtn').addEventListener('click', () => {
  API.clearToken(); currentUser = null; showAuth();
  showToast('Logged out successfully', 'info');
});

// === Transaction functions ===
let txnPage = 1;
async function loadTransactions(page = 1) {
  txnPage = page;
  const search = document.getElementById('txnSearch')?.value || '';
  const type = document.getElementById('txnTypeFilter')?.value || '';
  const cat = document.getElementById('txnCatFilter')?.value || '';
  const start = document.getElementById('txnStartDate')?.value || '';
  const end = document.getElementById('txnEndDate')?.value || '';
  const params = new URLSearchParams({ page, limit: 15 });
  if (search) params.set('search', search);
  if (type) params.set('type', type);
  if (cat) params.set('category', cat);
  if (start) params.set('startDate', start);
  if (end) params.set('endDate', end);

  try {
    const { transactions, pagination } = await API.getTransactions(params.toString());
    const el = document.getElementById('txnTable');
    el.innerHTML = transactions.length ? `<div class="table-wrapper"><table class="transactions-table"><thead><tr><th>Category</th><th>Description</th><th>Date</th><th>Payment</th><th>Amount</th><th>Actions</th></tr></thead><tbody>${transactions.map(t => `<tr class="fade-in"><td><div class="txn-category"><span>${t.category}</span></div></td><td>${t.description||'-'}</td><td>${new Date(t.date).toLocaleDateString('en-IN')}</td><td><span class="badge badge-${t.type}">${(t.paymentMethod||'cash').replace(/_/g,' ')}</span></td><td class="txn-amount ${t.type}">${t.type==='income'?'+':'-'}₹${t.amount.toLocaleString('en-IN')}</td><td class="txn-actions"><button onclick="showTransactionModal('${t._id}',${JSON.stringify(t).replace(/"/g,'&quot;')})">✏️</button><button class="delete" onclick="deleteTransaction('${t._id}')">🗑️</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-state"><div class="empty-icon">📭</div><h3>No transactions found</h3></div>';

    // Pagination
    const pg = document.getElementById('txnPagination');
    if (pagination.pages > 1) {
      let html = '<div class="pagination">';
      html += `<button ${page<=1?'disabled':''} onclick="loadTransactions(${page-1})">←</button>`;
      for (let i = 1; i <= pagination.pages; i++) {
        html += `<button class="${i===page?'active':''}" onclick="loadTransactions(${i})">${i}</button>`;
      }
      html += `<button ${page>=pagination.pages?'disabled':''} onclick="loadTransactions(${page+1})">→</button>`;
      html += `<span>${pagination.total} total</span></div>`;
      pg.innerHTML = html;
    } else { pg.innerHTML = ''; }
  } catch(e) { showToast(e.message, 'error'); }
}

function applyTxnFilters() { loadTransactions(1); }

async function showTransactionModal(id, existing) {
  let cats = [];
  try { cats = (await API.getCategories()).categories; } catch(e) {}
  const isEdit = !!id && !!existing;
  const t = existing || {};

  document.getElementById('modalContainer').innerHTML = `<div class="modal-overlay" onclick="if(event.target===this)closeModal()"><div class="modal"><h2>${isEdit?'Edit':'Add'} Transaction</h2><form id="txnForm"><div class="form-row"><div class="form-group"><label>Type</label><select id="txnType" required><option value="expense" ${t.type==='expense'?'selected':''}>Expense</option><option value="income" ${t.type==='income'?'selected':''}>Income</option></select></div><div class="form-group"><label>Amount (₹)</label><input type="number" id="txnAmount" step="0.01" min="0.01" value="${t.amount||''}" required></div></div><div class="form-row"><div class="form-group"><label>Category</label><select id="txnCategory" required>${cats.map(c=>`<option value="${c.name}" ${t.category===c.name?'selected':''}>${c.icon} ${c.name}</option>`).join('')}</select></div><div class="form-group"><label>Date</label><input type="date" id="txnDate" value="${t.date?t.date.substring(0,10):new Date().toISOString().substring(0,10)}" required></div></div><div class="form-group"><label>Description</label><input type="text" id="txnDesc" value="${t.description||''}" placeholder="Optional description"></div><div class="form-row"><div class="form-group"><label>Payment Method</label><select id="txnPayment"><option value="cash" ${t.paymentMethod==='cash'?'selected':''}>Cash</option><option value="upi" ${t.paymentMethod==='upi'?'selected':''}>UPI</option><option value="credit_card" ${t.paymentMethod==='credit_card'?'selected':''}>Credit Card</option><option value="debit_card" ${t.paymentMethod==='debit_card'?'selected':''}>Debit Card</option><option value="net_banking" ${t.paymentMethod==='net_banking'?'selected':''}>Net Banking</option><option value="wallet" ${t.paymentMethod==='wallet'?'selected':''}>Wallet</option></select></div><div class="form-group"><label>Recurring</label><select id="txnRecurring"><option value="">No</option><option value="daily" ${t.recurringFrequency==='daily'?'selected':''}>Daily</option><option value="weekly" ${t.recurringFrequency==='weekly'?'selected':''}>Weekly</option><option value="monthly" ${t.recurringFrequency==='monthly'?'selected':''}>Monthly</option><option value="yearly" ${t.recurringFrequency==='yearly'?'selected':''}>Yearly</option></select></div></div><div class="modal-actions"><button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button><button type="submit" class="btn btn-primary">${isEdit?'Update':'Add'}</button></div></form></div></div>`;

  document.getElementById('txnForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      type: document.getElementById('txnType').value,
      amount: parseFloat(document.getElementById('txnAmount').value),
      category: document.getElementById('txnCategory').value,
      date: document.getElementById('txnDate').value,
      description: document.getElementById('txnDesc').value,
      paymentMethod: document.getElementById('txnPayment').value,
      recurringFrequency: document.getElementById('txnRecurring').value || null,
      isRecurring: !!document.getElementById('txnRecurring').value
    };
    try {
      if (isEdit) await API.updateTransaction(id, data);
      else await API.addTransaction(data);
      showToast(isEdit ? 'Transaction updated!' : 'Transaction added!', 'success');
      closeModal();
      if (currentPage === 'transactions') loadTransactions(txnPage);
      else if (currentPage === 'dashboard') Pages.dashboard();
    } catch(e) { showToast(e.message, 'error'); }
  });
}

async function deleteTransaction(id) {
  if (!confirm('Delete this transaction?')) return;
  try {
    await API.deleteTransaction(id);
    showToast('Transaction deleted!', 'success');
    loadTransactions(txnPage);
  } catch(e) { showToast(e.message, 'error'); }
}

async function exportTransactions() {
  try { await API.exportCSV(); showToast('CSV exported!', 'success'); } catch(e) { showToast(e.message, 'error'); }
}

// === Budget functions ===
async function showBudgetModal() {
  let cats = [];
  try { cats = (await API.getCategories('expense')).categories; } catch(e) {}
  document.getElementById('modalContainer').innerHTML = `<div class="modal-overlay" onclick="if(event.target===this)closeModal()"><div class="modal"><h2>Set Budget</h2><form id="budgetForm"><div class="form-group"><label>Category</label><select id="budgetCat" required>${cats.map(c=>`<option value="${c.name}">${c.icon} ${c.name}</option>`).join('')}</select></div><div class="form-group"><label>Monthly Limit (₹)</label><input type="number" id="budgetLimit" min="1" step="1" required></div><div class="modal-actions"><button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button><button type="submit" class="btn btn-primary">Save Budget</button></div></form></div></div>`;

  document.getElementById('budgetForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await API.saveBudget({ category: document.getElementById('budgetCat').value, limit: parseFloat(document.getElementById('budgetLimit').value) });
      showToast('Budget saved!', 'success');
      closeModal(); Pages.budgets();
    } catch(e) { showToast(e.message, 'error'); }
  });
}

async function deleteBudget(id) {
  if (!confirm('Delete this budget?')) return;
  try { await API.deleteBudget(id); showToast('Budget deleted!', 'success'); Pages.budgets(); } catch(e) { showToast(e.message, 'error'); }
}

// === Category functions ===
function showCategoryModal() {
  document.getElementById('modalContainer').innerHTML = `<div class="modal-overlay" onclick="if(event.target===this)closeModal()"><div class="modal"><h2>Add Category</h2><form id="catForm"><div class="form-group"><label>Name</label><input type="text" id="catName" required></div><div class="form-row"><div class="form-group"><label>Icon (emoji)</label><input type="text" id="catIcon" value="📁" maxlength="4"></div><div class="form-group"><label>Color</label><input type="color" id="catColor" value="#6366f1" style="height:42px"></div></div><div class="form-group"><label>Type</label><select id="catType"><option value="expense">Expense</option><option value="income">Income</option><option value="both">Both</option></select></div><div class="modal-actions"><button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button><button type="submit" class="btn btn-primary">Add Category</button></div></form></div></div>`;

  document.getElementById('catForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await API.addCategory({ name: document.getElementById('catName').value, icon: document.getElementById('catIcon').value, color: document.getElementById('catColor').value, type: document.getElementById('catType').value });
      showToast('Category added!', 'success');
      closeModal(); Pages.categories();
    } catch(e) { showToast(e.message, 'error'); }
  });
}

async function deleteCategory(id) {
  if (!confirm('Delete this category?')) return;
  try { await API.deleteCategory(id); showToast('Category deleted!', 'success'); Pages.categories(); } catch(e) { showToast(e.message, 'error'); }
}

// === Reports ===
async function loadReport() {
  const start = document.getElementById('rptStart')?.value;
  const end = document.getElementById('rptEnd')?.value;
  if (!start || !end) return;

  try {
    const params = `startDate=${start}&endDate=${end}&type=expense&limit=1000`;
    const { transactions } = await API.getTransactions(params);

    // Category breakdown
    const catMap = {};
    const payMap = {};
    const dayMap = {};
    transactions.forEach(t => {
      catMap[t.category] = (catMap[t.category] || 0) + t.amount;
      const pm = (t.paymentMethod || 'cash').replace(/_/g, ' ');
      payMap[pm] = (payMap[pm] || 0) + t.amount;
      const day = new Date(t.date).toLocaleDateString('en-IN');
      dayMap[day] = (dayMap[day] || 0) + t.amount;
    });

    const pieEl = document.getElementById('rptPie');
    const lineEl = document.getElementById('rptLine');
    if (pieEl && Object.keys(catMap).length) {
      new Chart(pieEl, { type: 'doughnut', data: { labels: Object.keys(catMap), datasets: [{ data: Object.values(catMap), backgroundColor: ['#6366f1','#ec4899','#f97316','#22c55e','#eab308','#3b82f6','#8b5cf6','#ef4444','#14b8a6','#f43f5e'], borderWidth: 0 }] }, options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { color: '#9393b7', font: { family: 'Inter' } } } } } });
    }

    const days = Object.keys(dayMap);
    if (lineEl && days.length) {
      new Chart(lineEl, { type: 'line', data: { labels: days, datasets: [{ label: 'Daily Expense', data: Object.values(dayMap), borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.1)', fill: true, tension: 0.4, pointRadius: 3 }] }, options: { responsive: true, plugins: { legend: { labels: { color: '#9393b7' } } }, scales: { x: { ticks: { color: '#5a5a7a', maxRotation: 45 }, grid: { display: false } }, y: { ticks: { color: '#5a5a7a' }, grid: { color: 'rgba(255,255,255,0.03)' } } } } });
    }

    // Payment breakdown
    const pbEl = document.getElementById('paymentBreakdown');
    if (pbEl) {
      const total = Object.values(payMap).reduce((a, b) => a + b, 0);
      pbEl.innerHTML = Object.entries(payMap).map(([k, v]) => {
        const pct = Math.round(v / total * 100);
        return `<div style="display:flex;align-items:center;gap:1rem;padding:.8rem 0;border-bottom:1px solid var(--border-glass)"><span style="min-width:120px;font-weight:500">${k}</span><div class="progress-bar" style="flex:1"><div class="progress-fill" style="width:${pct}%"></div></div><span style="color:var(--text-secondary);min-width:100px;text-align:right">₹${v.toLocaleString('en-IN')} (${pct}%)</span></div>`;
      }).join('');
    }
  } catch(e) { showToast(e.message, 'error'); }
}

function closeModal() { document.getElementById('modalContainer').innerHTML = ''; }

// Init
initApp();
