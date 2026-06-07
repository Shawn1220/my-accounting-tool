(function () {
  const S = window.AccountStorage;
  const UI = window.AccountUI;
  const C = window.AccountCharts;
  const $ = UI.$, $$ = UI.$$;

  let transactions = S.loadData();
  let settings = S.loadSettings();
  const currentMonth = new Date().toISOString().slice(0, 7);
  let state = {
    view: settings.defaultPage || 'home',
    selectedMonth: currentMonth,
    type: 'expense',
    accountType: '个人支出',
    category: '餐饮',
    paymentMethod: settings.defaultPayment || '微信支付',
    detailFilter: 'all',
    detailSearch: '',
    selectedId: null,
    lastDeleted: null,
    undoTimer: null,
    quickPreviewRows: [],
    pendingImport: null,
    editingTemplateIndex: null
  };
  const quickAmounts = [10, 20, 50, 100, 500, 1000];
  function getTemplates() { return Array.isArray(settings.quickTemplates) && settings.quickTemplates.length ? settings.quickTemplates : [...S.defaultTemplates]; }
  function activeTransactions() { return transactions.filter(t => !t.deletedAt); }
  function deletedTransactions() { return transactions.filter(t => !!t.deletedAt).sort((a,b)=>String(b.deletedAt).localeCompare(String(a.deletedAt))); }

  function init() {
    UI.setTheme(settings.theme, settings.accent);
    applyDisplayPreferences();
    renderQuickAmounts();
    bindEvents();
    populateSettings();
    refreshAll();
    navigate(['home','details','stats','my'].includes(state.view) ? state.view : 'home');
    setupPwa();
  }

  function bindEvents() {
    $$('[data-nav]').forEach(btn => btn.addEventListener('click', () => navigate(btn.dataset.nav)));
    $('#fabAdd').addEventListener('click', () => openAddEntry());
    $('#cancelEntryBtn').addEventListener('click', closeSheet);
    $('#sheetOverlay').addEventListener('click', closeSheet);
    $('#entryForm').addEventListener('submit', saveEntry);
    $('#backBtn').addEventListener('click', handleBackToTools);
    $('#moreBtn').addEventListener('click', e => { e.stopPropagation(); toggleMoreMenu(); });
    $$('#moreMenu [data-menu-action]').forEach(btn => btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); handleMenuAction(btn.dataset.menuAction); }));
    $('#globalSearchBtn').addEventListener('click', () => { navigate('details'); setTimeout(() => $('#detailSearch')?.focus(), 120); });
    $('#privacyBtn').addEventListener('click', togglePrivacy);

    $$('.type-switch button').forEach(btn => btn.addEventListener('click', () => setEntryType(btn.dataset.type)));
    $('#detailSearch').addEventListener('input', e => { state.detailSearch = e.target.value.trim(); renderDetails(); });
    $$('#detailFilters .chip').forEach(btn => btn.addEventListener('click', () => { state.detailFilter = btn.dataset.filter; $$('#detailFilters .chip').forEach(x=>x.classList.remove('active')); btn.classList.add('active'); renderDetails(); }));
    $$('[data-home-panel]').forEach(btn => btn.addEventListener('click', () => switchHomePanel(btn.dataset.homePanel)));

    document.body.addEventListener('click', handleDelegatedClick);
    document.addEventListener('click', e => { if (!e.target.closest('#moreMenu') && !e.target.closest('#moreBtn')) closeMoreMenu(); });
    $('#defaultPaymentSelect').addEventListener('change', e => updateSetting('defaultPayment', e.target.value));
    $('#defaultPageSelect').addEventListener('change', e => updateSetting('defaultPage', e.target.value));
    $('#displayModeSelect').addEventListener('change', e => updateSetting('displayMode', e.target.value));
    $('#monthlyBudgetInput').addEventListener('change', e => updateSetting('monthlyBudget', Math.max(0, Number(e.target.value) || 0)));
    $('#showIncomeToggle').addEventListener('change', e => updateSetting('showIncome', e.target.checked));
    $('#addCategoryBtn').addEventListener('click', addCategory);
    $('#addPaymentBtn').addEventListener('click', addPaymentMethod);
    $('#exportBtn').addEventListener('click', exportJson);
    $('#importBtn').addEventListener('click', () => $('#importFileInput').click());
    $('#importFileInput').addEventListener('change', importJsonFile);
    $('#cancelImportPreviewBtn')?.addEventListener('click', closeImportPreview);
    $('#cancelImportPreviewBottomBtn')?.addEventListener('click', closeImportPreview);
    $('#modalOverlay')?.addEventListener('click', closeImportPreview);
    $('#confirmImportPreviewBtn')?.addEventListener('click', confirmImportPreview);
    $('#restoreDemoBtn').addEventListener('click', restoreDemo);
    $('#clearDataBtn').addEventListener('click', clearData);
    $('#clearCacheBtn').addEventListener('click', clearCacheAndReload);
    $('#copyPromptBtn').addEventListener('click', copyPrompt);
    $('#exportCsvBtn')?.addEventListener('click', () => exportCsv('all'));
    $('#exportMonthCsvBtn')?.addEventListener('click', () => exportCsv('month'));
    $('#restoreCategoriesBtn')?.addEventListener('click', restoreDefaultCategories);
    $('#restorePaymentsBtn')?.addEventListener('click', restoreDefaultPayments);
    $('#parseQuickTextBtn')?.addEventListener('click', parseQuickText);
    $('#clearQuickTextBtn')?.addEventListener('click', () => { $('#quickTextInput').value = ''; $('#quickTextPreview').innerHTML = ''; state.quickPreviewRows = []; });
    $('#confirmQuickTextBtn')?.addEventListener('click', confirmQuickText);
    $('#restoreImportBackupBtn')?.addEventListener('click', restoreImportBackup);
    $('#createLocalBackupBtn')?.addEventListener('click', createLocalBackup);
    $('#restoreLocalBackupBtn')?.addEventListener('click', restoreLocalBackup);
    $('#addTemplateBtn')?.addEventListener('click', addTemplate);
    $('#cancelTemplateEditBtn')?.addEventListener('click', cancelTemplateEdit);
    $('#restoreTemplatesBtn')?.addEventListener('click', restoreDefaultTemplates);
    $('#clearRecycleBtn')?.addEventListener('click', clearRecycleBin);
    $$('[data-month-action]').forEach(btn => btn.addEventListener('click', () => changeMonth(btn.dataset.monthAction)));
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
      if (action === 'copy') copyTransaction(id);
      return;
    }
    const chipCategory = e.target.closest('[data-category]');
    if (chipCategory) { setCategory(chipCategory.dataset.category); return; }
    const chipPayment = e.target.closest('[data-payment]');
    if (chipPayment) { state.paymentMethod = chipPayment.dataset.payment; renderEntryOptions(); return; }
    const chipAccount = e.target.closest('[data-account]');
    if (chipAccount) { setAccountType(chipAccount.dataset.account); return; }
    const themeBtn = e.target.closest('#themeOptions [data-theme]');
    if (themeBtn) { updateSetting('theme', themeBtn.dataset.theme); return; }
    const menuAction = e.target.closest('#moreMenu [data-menu-action]');
    if (menuAction) { handleMenuAction(menuAction.dataset.menuAction); return; }
    const accentBtn = e.target.closest('#accentOptions [data-accent]');
    if (accentBtn) { updateSetting('accent', accentBtn.dataset.accent); return; }
    const removeCategoryBtn = e.target.closest('[data-remove-category]');
    if (removeCategoryBtn) { removeCategory(removeCategoryBtn.dataset.removeCategory); return; }
    const removePaymentBtn = e.target.closest('[data-remove-payment]');
    if (removePaymentBtn) { removePaymentMethod(removePaymentBtn.dataset.removePayment); return; }
    const templateEdit = e.target.closest('[data-edit-template]');
    if (templateEdit) { editTemplate(Number(templateEdit.dataset.editTemplate)); return; }
    const templateMove = e.target.closest('[data-move-template]');
    if (templateMove) { moveTemplate(Number(templateMove.dataset.moveTemplate), templateMove.dataset.direction); return; }
    const templateRemove = e.target.closest('[data-remove-template]');
    if (templateRemove) { removeTemplate(Number(templateRemove.dataset.removeTemplate)); return; }
    const recycleRestore = e.target.closest('[data-recycle-restore]');
    if (recycleRestore) { restoreDeleted(recycleRestore.dataset.recycleRestore); return; }
    const recyclePurge = e.target.closest('[data-recycle-purge]');
    if (recyclePurge) { purgeDeleted(recyclePurge.dataset.recyclePurge); return; }
    const projectJump = e.target.closest('[data-project-jump]');
    if (projectJump) { jumpToProject(projectJump.dataset.projectJump); return; }
    const detailAction = e.target.closest('[data-detail-action]');
    if (detailAction && state.selectedId) {
      if (detailAction.dataset.detailAction === 'edit') openEditEntry(state.selectedId);
      if (detailAction.dataset.detailAction === 'delete') deleteTransaction(state.selectedId, true);
    }
  }

  function toggleMoreMenu() {
    const menu = $('#moreMenu');
    if (!menu) return;
    const open = menu.classList.toggle('open');
    menu.setAttribute('aria-hidden', open ? 'false' : 'true');
  }
  function closeMoreMenu() {
    const menu = $('#moreMenu');
    if (!menu) return;
    menu.classList.remove('open');
    menu.setAttribute('aria-hidden', 'true');
  }
  function handleMenuAction(action) {
    closeMoreMenu();
    if (action === 'add') openAddEntry();
    if (action === 'search') { navigate('details'); setTimeout(() => $('#detailSearch')?.focus(), 120); }
    if (action === 'export') exportJson();
    if (action === 'import') $('#importFileInput').click();
    if (action === 'theme') navigate('my');
    if (action === 'my') navigate('my');
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
    if (view === 'settings') view = 'my';
    closeMoreMenu();
    state.view = view;
    UI.setActiveNav(view);
    if (view === 'stats') renderStats();
    if (view === 'details') renderDetails();
    if (view === 'my') populateSettings();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function switchHomePanel(panel) {
    $$('[data-home-panel]').forEach(btn => btn.classList.toggle('active', btn.dataset.homePanel === panel));
    $('#homeRecordsPanel').classList.toggle('active', panel === 'records');
    $('#homeStatsPanel').classList.toggle('active', panel === 'stats');
    if (panel === 'stats') C.renderDonut($('#homeCategoryChart'), monthTransactions(), 'category');
  }

  function renderQuickAmounts() {
    const templates = getTemplates();
    const templateHtml = templates.map((tpl, i) => `<button class="template-chip" type="button" data-template-index="${i}"><span>${UI.escapeHtml(tpl.title)}</span><b>${C.money(tpl.amount)}</b><em>${UI.escapeHtml(tpl.paymentMethod || '')}</em></button>`).join('');
    const amountHtml = quickAmounts.map(n => `<button type="button" data-quick-amount="${n}">¥${n}</button>`).join('');
    if ($('#quickAmountHome')) $('#quickAmountHome').innerHTML = templateHtml;
    if ($('#quickAmountSheet')) $('#quickAmountSheet').innerHTML = amountHtml;
    $$('[data-template-index]').forEach(btn => btn.addEventListener('click', () => openAddEntry({ ...templates[Number(btn.dataset.templateIndex)] })));
    $$('[data-quick-amount]').forEach(btn => btn.addEventListener('click', () => {
      const amount = Number(btn.dataset.quickAmount);
      if ($('#entrySheet').classList.contains('open')) $('#amountInput').value = amount;
      else openAddEntry({ amount, title: '', category: '餐饮', accountType: '个人支出', paymentMethod: settings.defaultPayment || '微信支付' });
    }));
  }

  function refreshAll() {
    transactions = sortTransactions(transactions);
    S.saveData(transactions);
    renderHome();
    renderDetails();
    renderStats();
    if (state.selectedId) renderTransactionDetail(state.selectedId);
    if (state.view === 'my') { renderWorkCenter(); renderRecycleBin(); renderTemplateManager(); }
  }

  function sortTransactions(list) {
    return [...list].sort((a,b) => (`${b.date} ${b.time}`).localeCompare(`${a.date} ${a.time}`));
  }

  function monthTransactions(month = state.selectedMonth) {
    return activeTransactions().filter(t => (t.date || '').startsWith(month));
  }

  function formatMonthLabel(month) {
    const [y, m] = String(month).split('-');
    return `${y}年${Number(m)}月`;
  }

  function changeMonth(action) {
    if (action === 'current') state.selectedMonth = currentMonth;
    else {
      const [y, m] = state.selectedMonth.split('-').map(Number);
      const d = new Date(y, m - 1 + (action === 'prev' ? -1 : 1), 1);
      state.selectedMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
    refreshAll();
  }

  function summary(list) {
    const expense = list.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount||0),0);
    const income = list.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount||0),0);
    return { expense, income, balance: income - expense };
  }

  function renderHome() {
    const month = monthTransactions();
    $('#monthLabel').textContent = formatMonthLabel(state.selectedMonth);
    const allActive = activeTransactions();
    const visibleRecent = settings.showIncome ? allActive : allActive.filter(t => t.type !== 'income');
    const today = S.today();
    const s = summary(month);
    const todayExpense = allActive.filter(t=>t.type==='expense' && t.date === today).reduce((sum,t)=>sum+Number(t.amount||0),0);
    $('#homeMonthExpense').textContent = C.money(s.expense);
    $('#homeMonthIncome').textContent = settings.showIncome ? C.money(s.income) : '已隐藏';
    $('#homeMonthBalance').textContent = settings.showIncome ? C.money(s.balance) : '已隐藏';
    $('#homeTodayExpense').textContent = C.money(todayExpense);
    const budget = Number(settings.monthlyBudget || 0);
    $('#homeBudgetText').textContent = `${C.money(s.expense)} / ${budget ? C.money(budget) : '未设置'}`;
    $('#homeBudgetBar').style.width = Math.min(100, budget ? (s.expense / budget * 100) : 0).toFixed(1) + '%';
    ['#homeMonthExpense','#homeMonthIncome','#homeMonthBalance','#homeTodayExpense'].forEach(sel => $(sel)?.classList.add('money-value'));
    document.body.classList.toggle('masked', !!settings.privacyMode);
    document.body.classList.toggle('hide-income', !settings.showIncome);
    $('#privacyBtn').textContent = settings.privacyMode ? '显示金额' : '隐藏金额';
    UI.renderRecords($('#recentList'), visibleRecent.slice(0, 6), '暂无最近记录，点击右下角 + 记一笔');
    C.renderDonut($('#homeCategoryChart'), month, 'category');
  }

  function filterTransactions() {
    let list = monthTransactions();
    if (!settings.showIncome && state.detailFilter !== 'income') list = list.filter(t => t.type !== 'income');
    if (state.detailFilter === 'expense') list = list.filter(t=>t.type==='expense');
    if (state.detailFilter === 'income') list = settings.showIncome ? list.filter(t=>t.type==='income') : [];
    if (state.detailFilter === 'personal') list = list.filter(t=>t.accountType==='个人支出');
    if (state.detailFilter === 'work') list = list.filter(t=>t.accountType==='工作支出');
    if (state.detailSearch) {
      const tokens = state.detailSearch.toLowerCase().split(/\s+/).filter(Boolean);
      list = list.filter(t => {
        const hay = [t.title,t.category,t.paymentMethod,t.project,t.supplier,t.note,t.contractNo,t.invoiceStatus,t.reimbursementStatus,t.contractStatus].join(' ').toLowerCase();
        return tokens.every(q => hay.includes(q));
      });
    }
    return list;
  }

  function renderDetails() { UI.renderGroupedRecords($('#detailList'), filterTransactions()); }

  function renderStats() {
    const month = monthTransactions();
    $('#statsMonthHint').textContent = `${formatMonthLabel(state.selectedMonth)}趋势、分类和支付方式`;
    const s = summary(month);
    $('#statsExpense').textContent = C.money(s.expense);
    $('#statsIncome').textContent = settings.showIncome ? C.money(s.income) : '已隐藏';
    $('#statsBalance').textContent = settings.showIncome ? C.money(s.balance) : '已隐藏';
    C.renderDonut($('#categoryChart'), month, 'category');
    C.renderBars($('#paymentBars'), month, 'paymentMethod');
    C.renderTrend($('#trendChart'), month.filter(t => settings.showIncome || t.type !== 'income'));
    C.renderPersonalInsight($('#personalInsight'), month);
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
    document.body.classList.add('sheet-open');
    setTimeout(() => $('#amountInput')?.focus(), 180);
  }
  function closeSheet() {
    $('#sheetOverlay').classList.remove('open');
    $('#entrySheet').classList.remove('open');
    $('#sheetOverlay').setAttribute('aria-hidden', 'true');
    $('#entrySheet').setAttribute('aria-hidden', 'true');
    document.body.classList.remove('sheet-open');
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
    UI.optionButtons($('#accountTypeOptions'), ['个人支出'], '个人支出', 'account'); state.accountType = state.accountType === '工作支出' ? '工作支出' : '个人支出';
    const custom = settings.categories.filter(c => !S.workCategories.includes(c) && !S.personalCategories.includes(c));
    const personalBase = S.personalCategories.filter(c => settings.categories.includes(c));
    const workBase = S.workCategories.filter(c => settings.categories.includes(c));
    const cats = state.accountType === '工作支出' ? workBase.concat(custom) : personalBase.concat(custom);
    const safeCats = unique(cats.length ? cats : ['其他']);
    if (!safeCats.includes(state.category)) state.category = safeCats[0];
    if (!settings.paymentMethods.includes(state.paymentMethod)) state.paymentMethod = settings.defaultPayment || settings.paymentMethods[0] || '其他';
    UI.optionButtons($('#categoryOptions'), safeCats, state.category, 'category');
    UI.optionButtons($('#paymentOptions'), settings.paymentMethods.length ? settings.paymentMethods : ['其他'], state.paymentMethod, 'payment');
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
    const index = transactions.findIndex(x => x.id === id);
    const t = transactions[index];
    if (!t) return;
    const deleted = { ...t, deletedAt: new Date().toISOString() };
    state.lastDeleted = { item: t, index };
    transactions[index] = deleted;
    if (backAfter || state.view === 'transaction') { state.selectedId = null; navigate('details'); }
    refreshAll();
    clearTimeout(state.undoTimer);
    UI.toast('账单已移入最近删除', '撤销', undoDelete);
    state.undoTimer = setTimeout(() => { state.lastDeleted = null; }, 5000);
  }



  function copyTransaction(id) {
    const source = transactions.find(x => x.id === id);
    if (!source) return UI.toast('账单不存在');
    const nowDate = S.today();
    const nowTime = S.nowTime();
    openAddEntry({ ...source, id: '', date: nowDate, time: nowTime, createdAt: '', updatedAt: '', note: source.note || '' });
    $('#sheetTitle').textContent = '复制账单';
    $('#entryId').value = '';
    UI.toast('已复制账单，请确认后保存');
  }

  function undoDelete() {
    if (!state.lastDeleted) return;
    const { item, index } = state.lastDeleted;
    const existingIndex = transactions.findIndex(x => x.id === item.id);
    const restored = { ...item, deletedAt: '' };
    if (existingIndex >= 0) transactions[existingIndex] = restored;
    else transactions.splice(Math.max(0, index), 0, restored);
    state.lastDeleted = null;
    refreshAll();
    UI.toast('已撤销删除');
  }



  function populateSettings() {
    const paymentSelect = $('#defaultPaymentSelect');
    paymentSelect.innerHTML = settings.paymentMethods.map(p=>`<option value="${UI.escapeHtml(p)}">${UI.escapeHtml(p)}</option>`).join('');
    paymentSelect.value = settings.defaultPayment;
    $('#defaultPageSelect').value = settings.defaultPage === 'settings' ? 'my' : settings.defaultPage;
    $('#displayModeSelect').value = settings.displayMode || 'comfortable';
    $('#monthlyBudgetInput').value = Number(settings.monthlyBudget || 0) || '';
    $('#showIncomeToggle').checked = !!settings.showIncome;
    $$('#themeOptions .chip').forEach(btn => btn.classList.toggle('active', btn.dataset.theme === settings.theme));
    $$('#accentOptions [data-accent]').forEach(btn => btn.classList.toggle('active', btn.dataset.accent === (settings.accent || 'mint')));
    $('#categoryTags').innerHTML = settings.categories.map(c=>`<span class="removable-chip">${UI.escapeHtml(c)}<button class="remove-mini" data-remove-category="${UI.escapeHtml(c)}" type="button" aria-label="删除 ${UI.escapeHtml(c)}">×</button></span>`).join('');
    $('#paymentTags').innerHTML = settings.paymentMethods.map(p=>`<span class="removable-chip">${UI.escapeHtml(p)}<button class="remove-mini" data-remove-payment="${UI.escapeHtml(p)}" type="button" aria-label="删除 ${UI.escapeHtml(p)}">×</button></span>`).join('');
    $('#aiPromptText').value = UI.aiPrompt();
    $('#syncStatus').textContent = window.parent && window.parent !== window ? 'Shawn Tools 内嵌模式' : '独立模式';
    const ms = summary(monthTransactions());
    $('#myTotalCount').textContent = activeTransactions().length + ' 笔';
    $('#myMonthExpense').textContent = C.money(ms.expense);
    renderDataHealth();
    renderTemplateManager();
    renderRecycleBin();
    applyDisplayPreferences();
  }

  function updateSetting(key, value) {
    if (key === 'theme' && !['system','light','dark'].includes(value)) return;
    if (key === 'accent' && !['mint','sky','indigo','orange','pink','graphite'].includes(value)) return;
    if (key === 'displayMode' && !['compact','comfortable'].includes(value)) value = 'comfortable';
    if (key === 'monthlyBudget') value = Math.max(0, Number(value) || 0);
    settings[key] = value;
    S.saveSettings(settings);
    if (key === 'theme' || key === 'accent') UI.setTheme(settings.theme, settings.accent);
    applyDisplayPreferences();
    populateSettings();
    refreshAll();
    UI.toast('设置已保存');
  }

  function applyDisplayPreferences() {
    document.documentElement.setAttribute('data-density', settings.displayMode || 'comfortable');
    document.body.classList.toggle('hide-income', !settings.showIncome);
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
  function removeCategory(value) {
    if (!value) return;
    if (settings.categories.length <= 1) return UI.toast('至少保留一个分类');
    settings.categories = settings.categories.filter(c => c !== value);
    if (state.category === value) state.category = settings.categories[0] || '其他';
    S.saveSettings(settings); populateSettings(); renderEntryOptions(); refreshAll(); UI.toast('分类已删除');
  }
  function removePaymentMethod(value) {
    if (!value) return;
    if (settings.paymentMethods.length <= 1) return UI.toast('至少保留一个支付方式');
    settings.paymentMethods = settings.paymentMethods.filter(p => p !== value);
    if (settings.defaultPayment === value) settings.defaultPayment = settings.paymentMethods[0] || '其他';
    if (state.paymentMethod === value) state.paymentMethod = settings.defaultPayment;
    S.saveSettings(settings); populateSettings(); renderEntryOptions(); refreshAll(); UI.toast('支付方式已删除');
  }
  function renderWorkCenter() {
    // Legacy compatibility hook; visible app is focused on private accounting.
    return;
  }
  function csvEscape(value) {
    const text = String(value == null ? '' : value);
    return /[",\n\r]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  }
  function exportCsv(scope) {
    let list = activeTransactions();
    if (scope === 'month') {
      const month = state.selectedMonth;
      list = list.filter(t => (t.date || '').startsWith(month));
    }
    if (scope === 'work') list = list.filter(t => t.accountType === '工作支出');
    const headers = ['日期','时间','标题','金额','类型','账户类型','分类','支付方式','项目','供应商','发票状态','报销状态','合同状态','合同号','备注'];
    const rows = list.map(t => [t.date,t.time,t.title,t.amount,t.type === 'income' ? '收入' : '支出',t.accountType,t.category,t.paymentMethod,t.project,t.supplier,t.invoiceStatus,t.reimbursementStatus,t.contractStatus,t.contractNo,t.note]);
    const csv = '\ufeff' + [headers, ...rows].map(row => row.map(csvEscape).join(',')).join('\n');
    const name = scope === 'month' ? '本月' : scope === 'work' ? '工作支出' : '全部';
    UI.download(`Shawn_AccountBook_${name}_${S.today()}.csv`, csv, 'text/csv;charset=utf-8');
    UI.toast(`${name} CSV 已导出`);
  }
  function restoreDefaultCategories() {
    settings.categories = unique([...S.personalCategories]);
    S.saveSettings(settings); populateSettings(); renderEntryOptions(); UI.toast('默认分类已恢复');
  }
  function restoreDefaultPayments() {
    settings.paymentMethods = [...S.defaultPayments];
    if (!settings.paymentMethods.includes(settings.defaultPayment)) settings.defaultPayment = settings.paymentMethods[0];
    S.saveSettings(settings); populateSettings(); renderEntryOptions(); UI.toast('默认支付方式已恢复');
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
        const existingIds = new Set(transactions.map(t => t.id));
        const normalized = rows.map(x => S.normalizeTransaction(x));
        const duplicateCount = normalized.filter(x => existingIds.has(x.id)).length;
        const missingFieldCount = rows.filter(x => !x.title || !x.amount || !x.date).length;
        state.pendingImport = { parsed, rows: normalized, duplicateCount, missingFieldCount };
        renderImportPreview();
      } catch (err) {
        UI.toast('导入失败：' + err.message);
      }
      e.target.value = '';
    };
    reader.readAsText(file, 'utf-8');
  }

  function renderImportPreview() {
    const box = $('#importPreviewModal');
    const overlay = $('#modalOverlay');
    const pending = state.pendingImport;
    if (!box || !overlay || !pending) return;
    const rows = pending.rows || [];
    $('#importPreviewSummary').innerHTML = `
      <div><b>${rows.length}</b><span>待导入</span></div>
      <div><b>${pending.duplicateCount || 0}</b><span>重复 ID</span></div>
      <div><b>${pending.missingFieldCount || 0}</b><span>字段待补全</span></div>
    `;
    $('#importPreviewList').innerHTML = rows.slice(0, 8).map((x, i) => `
      <div class="import-preview-row"><span>${i + 1}. ${UI.escapeHtml(x.date)} · ${UI.escapeHtml(x.title)} · ${UI.escapeHtml(x.category)}</span><b>${C.money(x.amount)}</b></div>
    `).join('') || '<div class="empty-state">没有可导入记录</div>';
    overlay.classList.add('open');
    box.classList.add('open');
    document.body.classList.add('sheet-open');
  }

  function closeImportPreview() {
    $('#modalOverlay')?.classList.remove('open');
    $('#importPreviewModal')?.classList.remove('open');
    document.body.classList.remove('sheet-open');
    state.pendingImport = null;
  }

  function confirmImportPreview() {
    const pending = state.pendingImport;
    if (!pending || !pending.rows || !pending.rows.length) return UI.toast('没有可导入记录');
    try {
      localStorage.setItem('shawn_account_book_last_import_backup', JSON.stringify({ backedUpAt: new Date().toISOString(), transactions }));
      const result = S.importData({ transactions: pending.rows }, 'append');
      transactions = result.data;
      closeImportPreview();
      refreshAll();
      UI.toast(`已导入 ${result.count} 条记录`);
    } catch (err) {
      UI.toast('导入失败：' + err.message);
    }
  }


  function splitQuickText(text) {
    return text.replace(/[，；;。\n]/g, ',').split(',').map(x => x.trim()).filter(Boolean);
  }
  function inferDate(text) {
    const base = new Date();
    if (/前天/.test(text)) base.setDate(base.getDate() - 2);
    else if (/昨天/.test(text)) base.setDate(base.getDate() - 1);
    return base.toISOString().slice(0, 10);
  }
  function inferQuickRecord(raw) {
    const amountMatch = raw.match(/(\d+(?:\.\d+)?)/);
    if (!amountMatch) return null;
    const amount = Number(amountMatch[1]);
    let text = raw.replace(amountMatch[0], '').trim();
    let paymentMethod = settings.defaultPayment || '微信支付';
    if (/京东白条|白条/.test(raw)) paymentMethod = '京东白条';
    else if (/支付宝|花呗/.test(raw)) paymentMethod = '支付宝花呗';
    else if (/微信转账/.test(raw)) paymentMethod = '微信转账';
    else if (/微信/.test(raw)) paymentMethod = '微信支付';
    else if (/现金/.test(raw)) paymentMethod = '现金';
    else if (/抖音/.test(raw)) paymentMethod = '抖音支付 / 抖音采购';
    else if (/银行卡|银行/.test(raw)) paymentMethod = '银行卡付款';
    let category = '其他', title = '记账', accountType = '个人支出', supplier = '', invoiceStatus = '无需开票', reimbursementStatus = '无需报销', contractStatus = '';
    if (/京东|白条/.test(raw)) { category = '购物'; title = '京东购物'; accountType = '个人支出'; paymentMethod = '京东白条'; supplier = '京东'; }
    else if (/淘宝/.test(raw)) { category = '购物'; title = '淘宝购物'; accountType = '个人支出'; paymentMethod = '支付宝花呗'; supplier = '淘宝'; }
    else if (/抖音/.test(raw)) { category = '购物'; title = '抖音购物'; accountType = '个人支出'; supplier = '抖音'; }
    else if (/转账/.test(raw)) { category = '其他'; title = '转账'; accountType = '个人支出'; }
    else if (/烟|香烟|买烟/.test(raw)) { category = '抽烟'; title = '买烟'; }
    else if (/菜市场|买菜|蔬菜|菜/.test(raw)) { category = '食材'; title = '菜市场'; supplier = '菜市场'; }
    else if (/早餐|早饭/.test(raw)) { category = '餐饮'; title = '早餐'; }
    else if (/午饭|午餐|中饭|吃饭|晚饭|晚餐|饭/.test(raw)) { category = '餐饮'; title = /午饭|午餐|中饭/.test(raw) ? '午饭' : /晚饭|晚餐/.test(raw) ? '晚饭' : '吃饭'; }
    else if (/油|加油/.test(raw)) { category = '加油'; title = '加油'; }
    else if (/打车|地铁|公交|交通|停车/.test(raw)) { category = '交通'; title = /停车/.test(raw) ? '停车费' : '交通'; }
    else if (/购物|买东西/.test(raw)) { category = '购物'; title = '购物'; }
    const project = '';
    return S.normalizeTransaction({ id:S.uid(), type:'expense', accountType, category, title, amount, paymentMethod, date:inferDate(raw), time:S.nowTime(), project, supplier, invoiceStatus, reimbursementStatus, contractStatus, contractNo:'', note: raw, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() });
  }
  function parseQuickText() {
    const input = $('#quickTextInput');
    const text = input.value.trim();
    if (!text) return UI.toast('请输入一句话账单');
    const rows = splitQuickText(text).map(inferQuickRecord).filter(Boolean);
    if (!rows.length) return UI.toast('未识别到金额');
    state.quickPreviewRows = rows;
    $('#quickTextPreview').innerHTML = `<div class="preview-title">识别到 ${rows.length} 条，请确认后保存：</div>` + rows.map((r, i) => `<div class="preview-row"><span>${i+1}. ${UI.escapeHtml(r.title)} · ${UI.escapeHtml(r.paymentMethod)} · ${UI.escapeHtml(r.category)}</span><b>${C.money(r.amount)}</b></div>`).join('');
    UI.toast('已生成预览，请确认保存');
  }

  function confirmQuickText() {
    const rows = state.quickPreviewRows || [];
    if (!rows.length) return UI.toast('请先解析预览');
    transactions = sortTransactions([...rows, ...transactions]);
    refreshAll();
    $('#quickTextInput').value = '';
    $('#quickTextPreview').innerHTML = '';
    state.quickPreviewRows = [];
    UI.toast(`已保存 ${rows.length} 条一句话账单`);
  }



  function backupLabel(iso) {
    if (!iso) return '暂无';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '未知';
    return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }
  function renderDataHealth() {
    const raw = localStorage.getItem('shawn_account_book_manual_backup');
    let backedAt = '';
    try { backedAt = raw ? JSON.parse(raw).backedUpAt : ''; } catch(e) { backedAt = ''; }
    $('#healthTotalCount') && ($('#healthTotalCount').textContent = activeTransactions().length + ' 笔');
    $('#healthBackupTime') && ($('#healthBackupTime').textContent = backupLabel(backedAt));
    $('#healthRecycleCount') && ($('#healthRecycleCount').textContent = deletedTransactions().length + ' 条');
  }
  function createLocalBackup() {
    localStorage.setItem('shawn_account_book_manual_backup', JSON.stringify({ backedUpAt: new Date().toISOString(), transactions, settings }));
    renderDataHealth();
    UI.toast('本地备份已创建');
  }
  function restoreLocalBackup() {
    try {
      const raw = localStorage.getItem('shawn_account_book_manual_backup');
      if (!raw) return UI.toast('暂无本地备份');
      const backup = JSON.parse(raw);
      if (!Array.isArray(backup.transactions)) return UI.toast('本地备份格式无效');
      if (!confirm(`确认恢复本地备份？\n备份时间：${backup.backedUpAt || '未知'}\n当前数据会被替换。`)) return;
      transactions = backup.transactions.map(x => S.normalizeTransaction(x));
      if (backup.settings) { settings = { ...settings, ...backup.settings }; S.saveSettings(settings); }
      refreshAll(); populateSettings(); UI.toast('本地备份已恢复');
    } catch (err) { UI.toast('恢复失败：' + err.message); }
  }

  function restoreImportBackup() {
    try {
      const raw = localStorage.getItem('shawn_account_book_last_import_backup');
      if (!raw) return UI.toast('暂无导入前备份');
      const backup = JSON.parse(raw);
      if (!Array.isArray(backup.transactions)) return UI.toast('备份格式无效');
      if (!confirm(`确认恢复导入前备份？\n备份时间：${backup.backedUpAt || '未知'}\n当前数据会被替换。`)) return;
      transactions = backup.transactions.map(x => S.normalizeTransaction(x));
      refreshAll();
      UI.toast('已恢复导入前备份');
    } catch (err) {
      UI.toast('恢复失败：' + err.message);
    }
  }


  function renderTemplateManager() {
    const list = $('#templateList');
    if (!list) return;
    const templates = getTemplates();
    list.innerHTML = templates.map((tpl, i) => `<div class="template-manage-row"><div><b>${UI.escapeHtml(tpl.title)}</b><span>${C.money(tpl.amount)} · ${UI.escapeHtml(tpl.category)} · ${UI.escapeHtml(tpl.paymentMethod || '')}</span></div><div class="template-row-actions"><button data-edit-template="${i}" type="button">编辑</button><button data-move-template="${i}" data-direction="up" type="button">上移</button><button data-move-template="${i}" data-direction="down" type="button">下移</button><button data-remove-template="${i}" type="button">删除</button></div></div>`).join('') || '<div class="empty-state">暂无模板</div>';
    $('#cancelTemplateEditBtn')?.classList.toggle('show', state.editingTemplateIndex !== null);
    $('#addTemplateBtn').textContent = state.editingTemplateIndex === null ? '保存模板' : '更新模板';
  }
  function addTemplate() {
    const title = $('#templateTitleInput').value.trim();
    const amount = Number($('#templateAmountInput').value);
    const accountType = '个人支出';
    const category = $('#templateCategoryInput').value.trim() || '其他';
    const paymentMethod = S.normalizePayment($('#templatePaymentInput').value.trim()) || settings.defaultPayment || '微信支付';
    if (!title || !amount || amount <= 0) return UI.toast('请填写模板标题和正确金额');
    const tpl = S.normalizeTransaction({ type:'expense', accountType, category, title, amount, paymentMethod, date:S.today(), time:S.nowTime() });
    const clean = { title: tpl.title, amount: tpl.amount, category: tpl.category, accountType: tpl.accountType, paymentMethod: tpl.paymentMethod, supplier: tpl.supplier, invoiceStatus: tpl.invoiceStatus, reimbursementStatus: tpl.reimbursementStatus, contractStatus: tpl.contractStatus, note: tpl.note };
    const templates = getTemplates();
    if (state.editingTemplateIndex !== null && templates[state.editingTemplateIndex]) {
      templates[state.editingTemplateIndex] = clean;
      UI.toast('模板已更新');
    } else {
      templates.push(clean);
      UI.toast('模板已添加');
    }
    settings.quickTemplates = templates;
    S.saveSettings(settings);
    cancelTemplateEdit(false);
    renderQuickAmounts(); populateSettings();
  }
  function editTemplate(index) {
    const tpl = getTemplates()[index];
    if (!tpl) return;
    state.editingTemplateIndex = index;
    $('#templateTitleInput').value = tpl.title || '';
    $('#templateAmountInput').value = tpl.amount || '';
    $('#templateCategoryInput').value = tpl.category || '';
    $('#templatePaymentInput').value = tpl.paymentMethod || '';
    renderTemplateManager();
    UI.toast('正在编辑模板');
  }
  function cancelTemplateEdit(showToast = true) {
    state.editingTemplateIndex = null;
    ['#templateTitleInput','#templateAmountInput','#templateCategoryInput','#templatePaymentInput'].forEach(sel => { const el = $(sel); if (el) el.value = ''; });
    renderTemplateManager();
    if (showToast) UI.toast('已取消模板编辑');
  }
  function moveTemplate(index, direction) {
    const templates = getTemplates();
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= templates.length) return;
    [templates[index], templates[target]] = [templates[target], templates[index]];
    settings.quickTemplates = templates;
    S.saveSettings(settings);
    renderQuickAmounts(); populateSettings(); UI.toast('模板顺序已更新');
  }
  function removeTemplate(index) {
    const templates = getTemplates();
    if (!Number.isInteger(index) || index < 0 || index >= templates.length) return;
    templates.splice(index, 1);
    settings.quickTemplates = templates;
    if (state.editingTemplateIndex === index) state.editingTemplateIndex = null;
    S.saveSettings(settings);
    renderQuickAmounts(); populateSettings(); UI.toast('模板已删除');
  }
  function restoreDefaultTemplates() {
    settings.quickTemplates = [...S.defaultTemplates];
    state.editingTemplateIndex = null;
    S.saveSettings(settings);
    renderQuickAmounts(); populateSettings(); UI.toast('默认模板已恢复');
  }
  function renderRecycleBin() {
    const el = $('#recycleList');
    if (!el) return;
    const rows = deletedTransactions();
    if (!rows.length) { el.innerHTML = '<div class="empty-state">最近删除为空</div>'; return; }
    el.innerHTML = rows.slice(0, 20).map(t => `<div class="recycle-row"><div><b>${UI.escapeHtml(t.title)}</b><span>${UI.escapeHtml(t.date)} · ${UI.escapeHtml(t.category)} · ${C.money(t.amount)}</span></div><div><button data-recycle-restore="${UI.escapeHtml(t.id)}" type="button">恢复</button><button class="danger" data-recycle-purge="${UI.escapeHtml(t.id)}" type="button">永久删除</button></div></div>`).join('');
  }
  function restoreDeleted(id) {
    const idx = transactions.findIndex(t => t.id === id);
    if (idx < 0) return;
    transactions[idx] = { ...transactions[idx], deletedAt: '' };
    refreshAll(); UI.toast('账单已恢复');
  }
  function purgeDeleted(id) {
    if (!confirm('确认永久删除这条账单？')) return;
    transactions = transactions.filter(t => t.id !== id);
    refreshAll(); UI.toast('已永久删除');
  }
  function clearRecycleBin() {
    const count = deletedTransactions().length;
    if (!count) return UI.toast('回收站为空');
    if (!confirm(`确认永久清空 ${count} 条最近删除记录？`)) return;
    transactions = transactions.filter(t => !t.deletedAt);
    refreshAll(); UI.toast('回收站已清空');
  }
  function jumpToWorkFilter(type) {
    state.detailFilter = 'work';
    state.detailSearch = type === 'reimburse-pending' ? '待报销' : type === 'reimburse-done' ? '已报销' : type === 'invoice-pending' ? '待开票' : type === 'contract-pending' ? '无合同' : '';
    $('#detailSearch').value = state.detailSearch;
    $$('#detailFilters .chip').forEach(x=>x.classList.toggle('active', x.dataset.filter === 'work'));
    navigate('details');
    renderDetails();
  }
  function jumpToProject(project) {
    state.detailFilter = 'work';
    state.detailSearch = project || '';
    $('#detailSearch').value = state.detailSearch;
    $$('#detailFilters .chip').forEach(x=>x.classList.toggle('active', x.dataset.filter === 'work'));
    navigate('details');
    renderDetails();
  }

  function restoreDemo() { if (!confirm('确认恢复示例数据？当前数据会被替换。')) return; transactions = S.resetDemo(); refreshAll(); UI.toast('已恢复示例数据'); }
  function clearData() { if (!confirm('确认清空全部账单？此操作不能恢复。')) return; transactions = S.clearData(); refreshAll(); UI.toast('已清空数据'); }
  async function clearCacheAndReload() {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(reg => reg.update().catch(()=>{})));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.filter(k => k.includes('shawn-account-book')).map(k => caches.delete(k)));
      }
      UI.toast('缓存已清理，正在刷新');
      setTimeout(() => location.reload(), 600);
    } catch (err) {
      UI.toast('缓存清理失败，可尝试关闭后重开');
    }
  }
  function copyPrompt() { navigator.clipboard?.writeText($('#aiPromptText').value).then(()=>UI.toast('AI 提示词已复制')).catch(()=>UI.toast('复制失败，请手动复制')); }
  function togglePrivacy() { settings.privacyMode = !settings.privacyMode; S.saveSettings(settings); renderHome(); }
  function unique(arr) { return [...new Set(arr.filter(Boolean))]; }

  function getSummary() { return summary(activeTransactions()); }
  function setData(data) { transactions = Array.isArray(data) ? data.map(x=>S.normalizeTransaction(x)) : []; refreshAll(); return transactions; }
  function importJSON(json) { const result = S.importData(json, 'append'); transactions = result.data; refreshAll(); return result; }
  function resetDemoData() { transactions = S.resetDemo(); refreshAll(); return transactions; }

  window.ShawnToolsAccounting = {
    getData: () => activeTransactions(),
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
