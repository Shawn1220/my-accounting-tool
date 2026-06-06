(function () {
  const S = window.AccountStorage;
  const UI = window.AccountUI;
  const C = window.AccountCharts;
  const $ = UI.$, $$ = UI.$$;

  let transactions = S.loadData();
  let settings = S.loadSettings();
  let state = { view: settings.defaultPage || 'home', type: 'expense', accountType: '个人支出', category: '餐饮', paymentMethod: settings.defaultPayment || '微信支付', detailFilter: 'all', detailSearch: '', selectedId: null };
  const quickAmounts = [10, 20, 50, 100, 500, 1000];

  function init() {
    UI.setTheme(settings.theme);
    renderQuickAmounts();
    bindEvents();
    populateSettings();
    refreshAll();
    navigate(['home','details','stats','settings'].includes(state.view) ? state.view : 'home');
    setupPwa();
  }

  function bindEvents() {
    $$('[data-nav]').forEach(btn => btn.addEventListener('click', () => navigate(btn.dataset.nav)));
    $('#fabAdd').addEventListener('click', () => openAddEntry());
    $('#cancelEntryBtn').addEventListener('click', closeSheet);
    $('#sheetOverlay').addEventListener('click', closeSheet);
    $('#entryForm').addEventListener('submit', saveEntry);
    $('#backBtn').addEventListener('click', handleBackToTools);
    $('#moreBtn').addEventListener('click', () => navigate('settings'));
    $('#globalSearchBtn').addEventListener('click', () => { navigate('details'); setTimeout(() => $('#detailSearch')?.focus(), 120); });
    $('#privacyBtn').addEventListener('click', togglePrivacy);

    $$('.type-switch button').forEach(btn => btn.addEventListener('click', () => setEntryType(btn.dataset.type)));
    $('#detailSearch').addEventListener('input', e => { state.detailSearch = e.target.value.trim(); renderDetails(); });
    $$('#detailFilters .chip').forEach(btn => btn.addEventListener('click', () => { state.detailFilter = btn.dataset.filter; $$('#detailFilters .chip').forEach(x=>x.classList.remove('active')); btn.classList.add('active'); renderDetails(); }));
    $$('[data-home-panel]').forEach(btn => btn.addEventListener('click', () => switchHomePanel(btn.dataset.homePanel)));

    document.body.addEventListener('click', handleDelegatedClick);
    $('#defaultPaymentSelect').addEventListener('change', e => updateSetting('defaultPayment', e.target.value));
    $('#defaultPageSelect').addEventListener('change', e => updateSetting('defaultPage', e.target.value));
    $('#displayModeSelect').addEventListener('change', e => updateSetting('displayMode', e.target.value));
    $('#showIncomeToggle').addEventListener('change', e => updateSetting('showIncome', e.target.checked));
    $('#addCategoryBtn').addEventListener('click', addCategory);
    $('#addPaymentBtn').addEventListener('click', addPaymentMethod);
    $('#exportBtn').addEventListener('click', exportJson);
    $('#importBtn').addEventListener('click', () => $('#importFileInput').click());
    $('#importFileInput').addEventListener('change', importJsonFile);
    $('#restoreDemoBtn').addEventListener('click', restoreDemo);
    $('#clearDataBtn').addEventListener('click', clearData);
    $('#copyPromptBtn').addEventListener('click', copyPrompt);
  }

  function handleDelegatedClick(e) {
    const nav = e.target.closest('[data-nav]');
    if (nav) return;
    const recordShell = e.target.closest('.record-shell');
    if (recordShell) {
      const id = recordShell.dataset.id;
      const actionBtn = e.target.closest('[data-action]');
      if (!actionBtn) return;
      const action = actionBtn.dataset.action;
      if (action === 'open') openDetail(id);
      if (action === 'edit') openEditEntry(id);
      if (action === 'delete') deleteTransaction(id);
      return;
    }
    const chipCategory = e.target.closest('[data-category]');
    if (chipCategory) { setCategory(chipCategory.dataset.category); return; }
    const chipPayment = e.target.closest('[data-payment]');
    if (chipPayment) { state.paymentMethod = chipPayment.dataset.payment; renderEntryOptions(); return; }
    const chipAccount = e.target.closest('[data-account]');
    if (chipAccount) { setAccountType(chipAccount.dataset.account); return; }
    const themeBtn = e.target.closest('[data-theme]');
    if (themeBtn) { updateSetting('theme', themeBtn.dataset.theme); return; }
    const detailAction = e.target.closest('[data-detail-action]');
    if (detailAction && state.selectedId) {
      if (detailAction.dataset.detailAction === 'edit') openEditEntry(state.selectedId);
      if (detailAction.dataset.detailAction === 'delete') deleteTransaction(state.selectedId, true);
    }
  }

  function handleBackToTools() {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'SHAWN_TOOLS_BACK', source: 'account-book' }, '*');
      UI.toast('已向 Shawn Tools 发送返回请求');
      return;
    }
    if (window.ShawnTools && typeof window.ShawnTools.back === 'function') {
      window.ShawnTools.back();
      return;
    }
    UI.toast('当前为独立记账本模式');
  }

  function navigate(view) {
    state.view = view;
    UI.setActiveNav(view);
    if (view === 'stats') renderStats();
    if (view === 'details') renderDetails();
    if (view === 'settings') populateSettings();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function switchHomePanel(panel) {
    $$('[data-home-panel]').forEach(btn => btn.classList.toggle('active', btn.dataset.homePanel === panel));
    $('#homeRecordsPanel').classList.toggle('active', panel === 'records');
    $('#homeStatsPanel').classList.toggle('active', panel === 'stats');
    if (panel === 'stats') C.renderDonut($('#homeCategoryChart'), monthTransactions(), 'category');
  }

  function renderQuickAmounts() {
    const html = quickAmounts.map(n => `<button type="button" data-quick-amount="${n}">¥${n}</button>`).join('');
    $('#quickAmountHome').innerHTML = html;
    $('#quickAmountSheet').innerHTML = html;
    $$('[data-quick-amount]').forEach(btn => btn.addEventListener('click', () => {
      const amount = Number(btn.dataset.quickAmount);
      if ($('#entrySheet').classList.contains('open')) $('#amountInput').value = amount;
      else openAddEntry({ amount, title: '', category: '京东采购', accountType: '工作支出', paymentMethod: '京东白条' });
    }));
  }

  function refreshAll() {
    transactions = sortTransactions(transactions);
    S.saveData(transactions);
    renderHome();
    renderDetails();
    renderStats();
    if (state.selectedId) renderTransactionDetail(state.selectedId);
  }

  function sortTransactions(list) {
    return [...list].sort((a,b) => (`${b.date} ${b.time}`).localeCompare(`${a.date} ${a.time}`));
  }

  function monthTransactions() {
    const month = new Date().toISOString().slice(0, 7);
    return transactions.filter(t => (t.date || '').startsWith(month));
  }

  function summary(list) {
    const expense = list.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount||0),0);
    const income = list.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount||0),0);
    return { expense, income, balance: income - expense };
  }

  function renderHome() {
    const month = monthTransactions();
    const today = S.today();
    const s = summary(month);
    const todayExpense = transactions.filter(t=>t.type==='expense' && t.date === today).reduce((sum,t)=>sum+Number(t.amount||0),0);
    $('#homeMonthExpense').textContent = C.money(s.expense);
    $('#homeMonthIncome').textContent = C.money(s.income);
    $('#homeMonthBalance').textContent = C.money(s.balance);
    $('#homeTodayExpense').textContent = C.money(todayExpense);
    ['#homeMonthExpense','#homeMonthIncome','#homeMonthBalance','#homeTodayExpense'].forEach(sel => $(sel)?.classList.add('money-value'));
    document.body.classList.toggle('masked', !!settings.privacyMode);
    $('#privacyBtn').textContent = settings.privacyMode ? '隐藏中' : '显示';
    UI.renderRecords($('#recentList'), transactions.slice(0, 6), '暂无最近记录，点击右下角 + 记一笔');
    C.renderDonut($('#homeCategoryChart'), month, 'category');
  }

  function filterTransactions() {
    let list = [...transactions];
    if (state.detailFilter === 'expense') list = list.filter(t=>t.type==='expense');
    if (state.detailFilter === 'income') list = list.filter(t=>t.type==='income');
    if (state.detailFilter === 'personal') list = list.filter(t=>t.accountType==='个人支出');
    if (state.detailFilter === 'work') list = list.filter(t=>t.accountType==='工作支出');
    if (state.detailSearch) {
      const q = state.detailSearch.toLowerCase();
      list = list.filter(t => [t.title,t.category,t.paymentMethod,t.project,t.supplier,t.note,t.contractNo].join(' ').toLowerCase().includes(q));
    }
    return list;
  }

  function renderDetails() { UI.renderGroupedRecords($('#detailList'), filterTransactions()); }

  function renderStats() {
    const month = monthTransactions();
    const s = summary(month);
    $('#statsExpense').textContent = C.money(s.expense);
    $('#statsIncome').textContent = C.money(s.income);
    $('#statsBalance').textContent = C.money(s.balance);
    C.renderDonut($('#categoryChart'), month, 'category');
    C.renderBars($('#paymentBars'), month, 'paymentMethod');
    C.renderTrend($('#trendChart'), transactions);
    C.renderWorkStatus($('#workStatusBars'), month);
  }

  function openDetail(id) {
    state.selectedId = id;
    renderTransactionDetail(id);
    navigate('transaction');
  }

  function renderTransactionDetail(id) {
    const t = transactions.find(x=>x.id===id);
    const el = $('#transactionDetail');
    if (!el) return;
    if (!t) { el.innerHTML = '<div class="empty-state">账单不存在</div>'; return; }
    el.innerHTML = UI.formatDetail(t);
  }

  function openAddEntry(prefill) {
    const nowDate = S.today();
    const nowTime = S.nowTime();
    $('#sheetTitle').textContent = '记一笔';
    $('#entryId').value = '';
    state.type = prefill?.type || 'expense';
    state.accountType = prefill?.accountType || '个人支出';
    state.category = prefill?.category || (state.accountType === '工作支出' ? '京东采购' : '餐饮');
    state.paymentMethod = prefill?.paymentMethod || S.defaultPaymentByCategory(state.category, settings.defaultPayment);
    $('#amountInput').value = prefill?.amount || '';
    $('#titleInput').value = prefill?.title || '';
    $('#dateInput').value = prefill?.date || nowDate;
    $('#timeInput').value = prefill?.time || nowTime;
    $('#projectInput').value = prefill?.project || '';
    $('#supplierInput').value = prefill?.supplier || '';
    $('#invoiceStatusInput').value = prefill?.invoiceStatus || (state.accountType === '工作支出' ? '待开票' : '无需开票');
    $('#reimbursementStatusInput').value = prefill?.reimbursementStatus || (state.accountType === '工作支出' ? '待报销' : '无需报销');
    $('#contractStatusInput').value = prefill?.contractStatus || '';
    $('#contractNoInput').value = prefill?.contractNo || '';
    $('#noteInput').value = prefill?.note || '';
    $('#workDetails').open = state.accountType === '工作支出';
    renderEntryOptions();
    openSheet();
  }

  function openEditEntry(id) {
    const t = transactions.find(x=>x.id===id);
    if (!t) return UI.toast('账单不存在');
    openAddEntry(t);
    $('#sheetTitle').textContent = '编辑账单';
    $('#entryId').value = t.id;
  }

  function openSheet() {
    $('#sheetOverlay').classList.add('open');
    $('#entrySheet').classList.add('open');
    $('#sheetOverlay').setAttribute('aria-hidden', 'false');
    $('#entrySheet').setAttribute('aria-hidden', 'false');
    setTimeout(() => $('#amountInput')?.focus(), 180);
  }
  function closeSheet() {
    $('#sheetOverlay').classList.remove('open');
    $('#entrySheet').classList.remove('open');
    $('#sheetOverlay').setAttribute('aria-hidden', 'true');
    $('#entrySheet').setAttribute('aria-hidden', 'true');
    UI.closeOtherSwipes();
  }

  function setEntryType(type) { state.type = type; $$('.type-switch button').forEach(btn=>btn.classList.toggle('active', btn.dataset.type === type)); }
  function setAccountType(accountType) {
    state.accountType = accountType;
    const isWork = accountType === '工作支出';
    if (isWork && !S.workCategories.includes(state.category)) state.category = '京东采购';
    if (!isWork && !S.personalCategories.includes(state.category)) state.category = '餐饮';
    state.paymentMethod = S.defaultPaymentByCategory(state.category, state.paymentMethod || settings.defaultPayment);
    $('#workDetails').open = isWork;
    if (isWork) {
      if ($('#invoiceStatusInput').value === '无需开票') $('#invoiceStatusInput').value = '待开票';
      if ($('#reimbursementStatusInput').value === '无需报销') $('#reimbursementStatusInput').value = '待报销';
    }
    renderEntryOptions();
  }
  function setCategory(category) {
    state.category = category;
    if (S.workCategories.includes(category)) state.accountType = '工作支出';
    if (S.personalCategories.includes(category)) state.accountType = '个人支出';
    state.paymentMethod = S.defaultPaymentByCategory(category, state.paymentMethod || settings.defaultPayment);
    if (!$('#titleInput').value.trim()) $('#titleInput').value = category;
    $('#workDetails').open = state.accountType === '工作支出';
    renderEntryOptions();
  }

  function renderEntryOptions() {
    setEntryType(state.type);
    UI.optionButtons($('#accountTypeOptions'), ['个人支出','工作支出'], state.accountType, 'account');
    const cats = state.accountType === '工作支出' ? S.workCategories.concat(settings.categories.filter(c => !S.workCategories.includes(c) && !S.personalCategories.includes(c))) : S.personalCategories.concat(settings.categories.filter(c => !S.workCategories.includes(c) && !S.personalCategories.includes(c)));
    UI.optionButtons($('#categoryOptions'), unique(cats), state.category, 'category');
    UI.optionButtons($('#paymentOptions'), settings.paymentMethods, state.paymentMethod, 'payment');
  }

  function saveEntry(e) {
    e.preventDefault();
    const id = $('#entryId').value;
    const date = $('#dateInput').value;
    const time = $('#timeInput').value;
    const payload = S.normalizeTransaction({
      id: id || S.uid(),
      type: state.type,
      accountType: state.accountType,
      category: state.category,
      title: $('#titleInput').value.trim() || state.category,
      amount: Number($('#amountInput').value),
      paymentMethod: state.paymentMethod,
      date,
      time,
      project: $('#projectInput').value.trim(),
      supplier: $('#supplierInput').value.trim(),
      invoiceStatus: $('#invoiceStatusInput').value,
      reimbursementStatus: $('#reimbursementStatusInput').value,
      contractStatus: $('#contractStatusInput').value,
      contractNo: $('#contractNoInput').value.trim(),
      note: $('#noteInput').value.trim(),
      createdAt: id ? transactions.find(x=>x.id===id)?.createdAt : `${date}T${time}:00`,
      updatedAt: new Date().toISOString()
    });
    if (!payload.amount || payload.amount <= 0) return UI.toast('请输入正确金额');
    if (id) transactions = transactions.map(x => x.id === id ? payload : x);
    else transactions.unshift(payload);
    closeSheet();
    refreshAll();
    UI.toast(id ? '账单已更新' : '账单已保存');
  }

  function deleteTransaction(id, backAfter) {
    const t = transactions.find(x=>x.id===id);
    if (!t) return;
    if (!confirm(`确认删除「${t.title}」吗？删除后不能恢复。`)) return;
    transactions = transactions.filter(x=>x.id!==id);
    if (backAfter || state.view === 'transaction') { state.selectedId = null; navigate('details'); }
    refreshAll();
    UI.toast('账单已删除');
  }

  function populateSettings() {
    const paymentSelect = $('#defaultPaymentSelect');
    paymentSelect.innerHTML = settings.paymentMethods.map(p=>`<option value="${UI.escapeHtml(p)}">${UI.escapeHtml(p)}</option>`).join('');
    paymentSelect.value = settings.defaultPayment;
    $('#defaultPageSelect').value = settings.defaultPage;
    $('#displayModeSelect').value = settings.displayMode;
    $('#showIncomeToggle').checked = !!settings.showIncome;
    $$('#themeOptions .chip').forEach(btn => btn.classList.toggle('active', btn.dataset.theme === settings.theme));
    $('#categoryTags').innerHTML = settings.categories.map(c=>`<button class="chip" type="button">${UI.escapeHtml(c)}</button>`).join('');
    $('#paymentTags').innerHTML = settings.paymentMethods.map(p=>`<button class="chip" type="button">${UI.escapeHtml(p)}</button>`).join('');
    $('#aiPromptText').value = UI.aiPrompt();
    $('#syncStatus').textContent = window.parent && window.parent !== window ? 'Shawn Tools 内嵌模式' : '独立模式';
  }

  function updateSetting(key, value) {
    settings[key] = value;
    S.saveSettings(settings);
    if (key === 'theme') UI.setTheme(value);
    populateSettings();
    renderHome();
    UI.toast('设置已保存');
  }
  function addCategory() {
    const v = $('#newCategoryInput').value.trim();
    if (!v) return;
    settings.categories = unique([...settings.categories, v]);
    S.saveSettings(settings); $('#newCategoryInput').value = ''; populateSettings(); renderEntryOptions();
  }
  function addPaymentMethod() {
    const v = S.normalizePayment($('#newPaymentInput').value.trim());
    if (!v) return;
    settings.paymentMethods = unique([...settings.paymentMethods, v]);
    S.saveSettings(settings); $('#newPaymentInput').value = ''; populateSettings(); renderEntryOptions();
  }
  function exportJson() { UI.download(`Shawn_AccountBook_${S.today()}.json`, S.exportData()); UI.toast('JSON 已导出'); }
  function importJsonFile(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const rows = Array.isArray(parsed) ? parsed : parsed.transactions;
        if (!Array.isArray(rows)) throw new Error('没有找到 transactions 数组');
        const preview = rows.slice(0, 5).map(x => `${x.date || ''} ${x.title || x.category || '未命名'} ¥${x.amount || 0}`).join('\n');
        if (!confirm(`将导入 ${rows.length} 条记录，预览：\n${preview}\n\n选择“确定”追加导入。`)) return;
        const result = S.importData(parsed, 'append');
        transactions = result.data;
        refreshAll(); UI.toast(`已导入 ${result.count} 条记录`);
      } catch (err) { UI.toast('导入失败：' + err.message); }
      e.target.value = '';
    };
    reader.readAsText(file, 'utf-8');
  }
  function restoreDemo() { if (!confirm('确认恢复示例数据？当前数据会被替换。')) return; transactions = S.resetDemo(); refreshAll(); UI.toast('已恢复示例数据'); }
  function clearData() { if (!confirm('确认清空全部账单？此操作不能恢复。')) return; transactions = S.clearData(); refreshAll(); UI.toast('已清空数据'); }
  function copyPrompt() { navigator.clipboard?.writeText($('#aiPromptText').value).then(()=>UI.toast('AI 提示词已复制')).catch(()=>UI.toast('复制失败，请手动复制')); }
  function togglePrivacy() { settings.privacyMode = !settings.privacyMode; S.saveSettings(settings); renderHome(); }
  function unique(arr) { return [...new Set(arr.filter(Boolean))]; }

  function getSummary() { return summary(transactions); }
  function setData(data) { transactions = Array.isArray(data) ? data.map(x=>S.normalizeTransaction(x)) : []; refreshAll(); return transactions; }
  function importJSON(json) { const result = S.importData(json, 'append'); transactions = result.data; refreshAll(); return result; }
  function resetDemoData() { transactions = S.resetDemo(); refreshAll(); return transactions; }

  window.ShawnToolsAccounting = {
    getData: () => transactions,
    setData,
    exportJSON: () => S.exportData(),
    importJSON,
    getSummary,
    setTheme: theme => updateSetting('theme', theme),
    openAddEntry,
    resetDemoData
  };

  function setupPwa() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(()=>{}));
    }
  }

  init();
})();
