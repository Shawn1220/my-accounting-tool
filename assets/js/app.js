(function () {
  const S = window.AccountStorage;
  const UI = window.AccountUI;
  const Charts = window.AccountCharts;

  let transactions = [];
  let settings = {};
  let currentView = 'home';
  let selectedId = null;
  let currentFilter = 'all';

  function currentMonthKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  function todayKey() { return S.nowDate(); }

  function getMonthly() {
    const month = currentMonthKey();
    return transactions.filter(t => t.date && t.date.startsWith(month));
  }

  function getSummary() {
    const monthly = getMonthly();
    const expense = monthly.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount || 0), 0);
    const income = monthly.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount || 0), 0);
    const todayExpense = transactions.filter(t => t.date === todayKey() && t.type === 'expense').reduce((s, t) => s + Number(t.amount || 0), 0);
    return { monthExpense: expense, monthIncome: income, monthBalance: income - expense, todayExpense, count: transactions.length };
  }

  function renderSummary() {
    const s = getSummary();
    UI.$('#homeMonthExpense').textContent = UI.money(s.monthExpense);
    UI.$('#homeMonthIncome').textContent = UI.money(s.monthIncome);
    UI.$('#homeMonthBalance').textContent = UI.money(s.monthBalance);
    UI.$('#homeTodayExpense').textContent = UI.money(s.todayExpense);
    UI.$('#statExpense').textContent = UI.money(s.monthExpense);
    UI.$('#statIncome').textContent = UI.money(s.monthIncome);
    UI.$('#statBalance').textContent = UI.money(s.monthBalance);
  }

  function filteredList() {
    const q = UI.$('#listSearch')?.value.trim().toLowerCase() || '';
    return transactions.filter(t => {
      if (!settings.showIncome && t.type === 'income') return false;
      if (currentFilter === 'expense' && t.type !== 'expense') return false;
      if (currentFilter === 'income' && t.type !== 'income') return false;
      if (currentFilter === 'personal' && t.accountType !== '个人支出') return false;
      if (currentFilter === 'work' && t.accountType !== '工作支出') return false;
      if (!q) return true;
      return [t.title, t.category, t.paymentMethod, t.note, t.project, t.supplier, t.contractNo].some(v => String(v || '').toLowerCase().includes(q));
    }).sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`));
  }

  function renderCharts() {
    const monthlyExpenses = getMonthly().filter(t => t.type === 'expense');
    const category = Charts.groupSum(monthlyExpenses, 'category');
    const payment = Charts.groupSum(monthlyExpenses, 'paymentMethod');
    Charts.renderDonut(UI.$('#homeDonut'), UI.$('#homeCategoryLegend'), category);
    Charts.renderDonut(UI.$('#categoryDonut'), UI.$('#categoryLegend'), category);
    Charts.renderBars(UI.$('#paymentBars'), payment);
    Charts.renderTrend(UI.$('#trendChart'), transactions);
  }

  function renderAll() {
    transactions = S.loadTransactions();
    renderSummary();
    UI.renderRecent(transactions);
    UI.renderGrouped(filteredList());
    renderCharts();
    if (selectedId) UI.renderDetail(transactions.find(t => t.id === selectedId));
  }

  function navigate(view) {
    currentView = view;
    UI.setActiveView(view);
    if (view === 'list') UI.renderGrouped(filteredList());
    if (view === 'stats') renderCharts();
  }

  function buildFormRecord() {
    const type = UI.$('.form-seg .seg.active').dataset.type;
    const id = UI.$('#entryId').value;
    return S.normalizeRecord({
      id: id || undefined,
      type,
      accountType: UI.$('#accountTypeInput').value,
      category: UI.$('#categoryInput').value,
      title: UI.$('#titleInput').value.trim(),
      amount: Number(UI.$('#amountInput').value),
      paymentMethod: UI.$('#paymentInput').value,
      date: UI.$('#dateInput').value,
      time: UI.$('#timeInput').value,
      project: UI.$('#projectInput').value.trim(),
      supplier: UI.$('#supplierInput').value.trim(),
      invoiceStatus: UI.$('#invoiceInput').value,
      reimbursementStatus: UI.$('#reimbursementInput').value,
      contractStatus: UI.$('#contractStatusInput').value,
      contractNo: UI.$('#contractNoInput').value.trim(),
      note: UI.$('#noteInput').value.trim(),
      createdAt: id ? transactions.find(t => t.id === id)?.createdAt : undefined,
      updatedAt: new Date().toISOString()
    });
  }

  function saveRecord(record) {
    const index = transactions.findIndex(t => t.id === record.id);
    if (index >= 0) transactions[index] = record;
    else transactions.unshift(record);
    S.saveTransactions(transactions);
    renderAll();
  }

  function deleteRecord(id) {
    transactions = transactions.filter(t => t.id !== id);
    S.saveTransactions(transactions);
    selectedId = null;
    renderAll();
    navigate('list');
  }

  async function loadDemoIfEmpty() {
    transactions = S.loadTransactions();
    if (transactions.length) return;
    try {
      const res = await fetch('./data/demo-data.json');
      const demo = await res.json();
      transactions = (demo.transactions || []).map(S.normalizeRecord);
      S.saveTransactions(transactions);
    } catch (e) {
      transactions = [];
    }
  }

  async function restoreDemo() {
    const res = await fetch('./data/demo-data.json');
    const demo = await res.json();
    transactions = (demo.transactions || []).map(S.normalizeRecord);
    S.saveTransactions(transactions);
    renderAll();
    UI.toast('已恢复示例数据');
  }

  function exportJSON() {
    const payload = { app: 'Shawn AccountBook', version: '1.0.0', exportedAt: new Date().toISOString(), transactions: S.loadTransactions(), settings: S.loadSettings() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `shawn-account-book-${S.nowDate()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    return payload;
  }

  function importJSON(json) {
    const imported = S.importTransactions(json);
    renderAll();
    UI.toast(`导入成功：${imported.length} 条`);
    return imported;
  }

  function setTheme(theme) {
    settings.theme = theme;
    S.saveSettings(settings);
    UI.applyTheme(theme);
  }

  function bindEvents() {
    UI.$$('.nav-item,[data-nav]').forEach(btn => btn.addEventListener('click', () => navigate(btn.dataset.nav)));
    UI.$('#fabAdd').addEventListener('click', () => UI.openSheet());
    UI.$('#btnCloseSheet').addEventListener('click', UI.closeSheet);
    UI.$('#btnCancelEntry').addEventListener('click', UI.closeSheet);
    UI.$('#sheetBackdrop').addEventListener('click', UI.closeSheet);
    UI.$('#btnBack').addEventListener('click', () => { window.location.href = './'; });
    UI.$('#btnMore').addEventListener('click', () => navigate('settings'));
    UI.$('#btnGlobalSearch').addEventListener('click', () => { navigate('list'); setTimeout(() => UI.$('#listSearch').focus(), 50); });

    UI.$$('.form-seg .seg').forEach(btn => btn.addEventListener('click', () => {
      UI.$$('.form-seg .seg').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      UI.setAccountTypes(btn.dataset.type);
    }));
    UI.$('#accountTypeInput').addEventListener('change', e => UI.setCategories(e.target.value));
    UI.$('#categoryInput').addEventListener('change', e => {
      const cat = e.target.value;
      if (cat === '淘宝采购') UI.$('#paymentInput').value = '支付宝花呗';
      if (cat === '京东采购') UI.$('#paymentInput').value = '京东白条';
      if (cat === '抖音采购') UI.$('#paymentInput').value = '抖音支付/抖音采购';
    });

    UI.$('#entryForm').addEventListener('submit', e => {
      e.preventDefault();
      const record = buildFormRecord();
      if (!record.title || !record.amount) { UI.toast('请填写标题和金额'); return; }
      saveRecord(record);
      UI.closeSheet();
      UI.toast('保存成功');
    });

    document.addEventListener('click', e => {
      const card = e.target.closest('.record-item');
      if (card) {
        selectedId = card.dataset.id;
        UI.renderDetail(transactions.find(t => t.id === selectedId));
        navigate('detail');
      }
      if (e.target.id === 'btnEditDetail') {
        const item = transactions.find(t => t.id === selectedId);
        if (item) UI.openSheet(item);
      }
      if (e.target.id === 'btnDeleteDetail') {
        if (selectedId && confirm('确认删除这条账单吗？删除后不可恢复。')) {
          deleteRecord(selectedId);
          UI.toast('已删除');
        }
      }
    });

    UI.$('#listSearch').addEventListener('input', () => UI.renderGrouped(filteredList()));
    UI.$$('#filterRow .chip').forEach(btn => btn.addEventListener('click', () => {
      currentFilter = btn.dataset.filter;
      UI.$$('#filterRow .chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      UI.renderGrouped(filteredList());
    }));

    UI.$$('.segmented [data-home-tab]').forEach(btn => btn.addEventListener('click', () => {
      UI.$$('.segmented [data-home-tab]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      UI.$('#homeRecordsPanel').classList.toggle('hidden', btn.dataset.homeTab !== 'records');
      UI.$('#homeStatsPanel').classList.toggle('hidden', btn.dataset.homeTab !== 'stats');
    }));

    UI.$('#themeSelect').addEventListener('change', e => setTheme(e.target.value));
    UI.$('#defaultPaymentSelect').addEventListener('change', e => { settings.defaultPaymentMethod = e.target.value; S.saveSettings(settings); });
    UI.$('#displayModeSelect').addEventListener('change', e => { settings.displayMode = e.target.value; S.saveSettings(settings); });
    UI.$('#defaultViewSelect').addEventListener('change', e => { settings.defaultView = e.target.value; S.saveSettings(settings); });
    UI.$('#showIncomeToggle').addEventListener('change', e => { settings.showIncome = e.target.checked; S.saveSettings(settings); renderAll(); });
    UI.$('#autoBackupToggle').addEventListener('change', e => { settings.autoBackup = e.target.checked; S.saveSettings(settings); UI.toast(e.target.checked ? '自动备份已开启：当前为本地占位' : '自动备份已关闭'); });

    UI.$('#btnExport').addEventListener('click', exportJSON);
    UI.$('#btnImport').addEventListener('click', () => UI.$('#importFile').click());
    UI.$('#importFile').addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const list = Array.isArray(parsed) ? parsed : (parsed.transactions || parsed.data || []);
        UI.$('#importPreview').classList.remove('hidden');
        UI.$('#importPreview').textContent = `导入前预览：共 ${list.length} 条\n\n${JSON.stringify(list.slice(0, 3), null, 2)}`;
        if (confirm(`检测到 ${list.length} 条记录，确认导入吗？`)) importJSON(parsed);
      } catch (err) {
        UI.toast(`导入失败：${err.message}`);
      } finally {
        e.target.value = '';
      }
    });
    UI.$('#btnRestoreDemo').addEventListener('click', () => { if (confirm('确认用示例数据覆盖当前数据吗？')) restoreDemo(); });
    UI.$('#btnClearAll').addEventListener('click', () => { if (confirm('确认清空全部账单数据吗？此操作不可恢复。')) { S.clear(); renderAll(); UI.toast('已清空数据'); } });
    UI.$('#btnCopyPrompt').addEventListener('click', async () => { await navigator.clipboard.writeText(UI.$('#aiPrompt').value); UI.toast('AI 提示词已复制'); });
  }

  async function init() {
    settings = S.loadSettings();
    UI.applyTheme(settings.theme);
    UI.populateOptions(settings);
    UI.fillAIPrompt();
    bindEvents();
    await loadDemoIfEmpty();
    renderAll();
    navigate(settings.defaultView || 'home');
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(() => {}));
    }
  }

  window.ShawnToolsAccounting = {
    getData: () => S.loadTransactions(),
    setData: data => { transactions = (Array.isArray(data) ? data : []).map(S.normalizeRecord); S.saveTransactions(transactions); renderAll(); },
    exportJSON,
    importJSON,
    getSummary,
    setTheme,
    openAddEntry: () => UI.openSheet(),
    resetDemoData: restoreDemo
  };

  document.addEventListener('DOMContentLoaded', init);
})();
