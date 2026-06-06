(function () {
  function $(selector, root = document) { return root.querySelector(selector); }
  function $$(selector, root = document) { return Array.from(root.querySelectorAll(selector)); }
  function money(num) { return window.AccountCharts.money(num); }

  function iconForCategory(category, type) {
    if (type === 'income') return '↗';
    const map = { '餐饮': '🍽', '食材': '🥬', '抽烟': '▫', '购物': '🛍', '日用品': '🧴', '交通': '🚗', '加油': '⛽', '京东采购': 'JD', '淘宝采购': '淘', '抖音采购': '抖', '直接转账': '转' };
    return map[category] || '•';
  }

  function formatMeta(item) {
    return [item.paymentMethod, item.category, item.accountType].filter(Boolean).join(' · ');
  }

  function recordItem(item) {
    return `<article class="record-item" data-id="${item.id}">
      <div class="record-icon">${iconForCategory(item.category, item.type)}</div>
      <div class="record-main"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(formatMeta(item))}</span></div>
      <div class="amount ${item.type}">${item.type === 'expense' ? '-' : '+'}${money(item.amount)}</div>
    </article>`;
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>'"]/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[s]));
  }

  function toast(text) {
    const el = $('#toast');
    el.textContent = text;
    el.classList.add('active');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => el.classList.remove('active'), 2100);
  }

  function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === 'light') root.setAttribute('data-theme', 'light');
    else if (theme === 'dark') root.setAttribute('data-theme', 'dark');
    else root.removeAttribute('data-theme');
  }

  const UI = {
    $, $$, money, toast, escapeHtml, recordItem,
    setActiveView(view) {
      $$('.view').forEach(el => el.classList.toggle('active', el.dataset.view === view));
      $$('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.nav === view));
      $('#fabAdd').classList.toggle('hidden', view === 'detail');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    applyTheme,
    renderRecent(list) {
      const target = $('#recentList');
      const recent = list.slice().sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`)).slice(0, 5);
      target.innerHTML = recent.length ? recent.map(recordItem).join('') : '<div class="empty">暂无记录，点击右下角记一笔。</div>';
    },
    renderGrouped(list) {
      const target = $('#groupedList');
      if (!list.length) {
        target.innerHTML = '<div class="empty">没有找到匹配的账单。</div>';
        return;
      }
      const groups = list.reduce((acc, item) => {
        (acc[item.date] ||= []).push(item);
        return acc;
      }, {});
      target.innerHTML = Object.keys(groups).sort((a, b) => b.localeCompare(a)).map(date => `<section class="date-group"><h3 class="date-title">${date}</h3><div class="record-list">${groups[date].sort((a, b) => b.time.localeCompare(a.time)).map(recordItem).join('')}</div></section>`).join('');
    },
    renderDetail(item) {
      const target = $('#detailContent');
      if (!item) {
        target.innerHTML = '<div class="empty">未找到该账单。</div>';
        return;
      }
      const rows = [
        ['类型', item.type === 'expense' ? '支出' : '收入'],
        ['分类', item.category],
        ['账目类型', item.accountType],
        ['支付方式', item.paymentMethod],
        ['交易时间', `${item.date} ${item.time}`],
        ['备注', item.note || '—'],
        ['项目', item.project || '—'],
        ['供应商', item.supplier || '—'],
        ['发票状态', item.invoiceStatus || '—'],
        ['报销状态', item.reimbursementStatus || '—'],
        ['合同状态', item.contractStatus || '—'],
        ['合同号', item.contractNo || '—']
      ];
      target.innerHTML = `<div><span class="badge muted">${item.type === 'expense' ? '支出账单' : '收入账单'}</span><h2>${escapeHtml(item.title)}</h2><div class="detail-amount amount ${item.type}">${item.type === 'expense' ? '-' : '+'}${money(item.amount)}</div></div><div class="detail-grid">${rows.map(([k, v]) => `<div class="detail-row"><span>${k}</span><strong>${escapeHtml(v)}</strong></div>`).join('')}</div><div class="detail-actions"><button class="pill-btn primary" id="btnEditDetail">编辑账单</button><button class="pill-btn danger" id="btnDeleteDetail">删除账单</button></div>`;
    },
    populateOptions(settings) {
      const storage = window.AccountStorage;
      const paymentSelects = ['#paymentInput', '#defaultPaymentSelect'];
      paymentSelects.forEach(sel => {
        const el = $(sel);
        if (el) el.innerHTML = storage.PAYMENT_METHODS.map(v => `<option value="${v}">${v}</option>`).join('');
      });
      $('#defaultPaymentSelect').value = settings.defaultPaymentMethod;
      $('#displayModeSelect').value = settings.displayMode;
      $('#defaultViewSelect').value = settings.defaultView;
      $('#themeSelect').value = settings.theme;
      $('#showIncomeToggle').checked = !!settings.showIncome;
      $('#autoBackupToggle').checked = !!settings.autoBackup;
      $('#categoryManager').innerHTML = [...storage.PERSONAL_CATEGORIES, ...storage.WORK_CATEGORIES].map(v => `<span class="tag">${v}</span>`).join('');
      $('#paymentManager').innerHTML = storage.PAYMENT_METHODS.map(v => `<span class="tag">${v}</span>`).join('');
    },
    setCategories(accountType, current) {
      const storage = window.AccountStorage;
      const el = $('#categoryInput');
      const list = accountType === '收入' ? ['收入'] : (accountType && accountType.includes('工作') ? storage.WORK_CATEGORIES : storage.PERSONAL_CATEGORIES);
      el.innerHTML = list.map(v => `<option value="${v}">${v}</option>`).join('');
      if (current && list.includes(current)) el.value = current;
    },
    setAccountTypes(type, current) {
      const el = $('#accountTypeInput');
      const list = type === 'income' ? ['收入'] : ['个人支出', '工作支出'];
      el.innerHTML = list.map(v => `<option value="${v}">${v}</option>`).join('');
      el.value = current && list.includes(current) ? current : list[0];
      UI.setCategories(el.value);
    },
    openSheet(item = null) {
      const storage = window.AccountStorage;
      const isEdit = !!item;
      $('#sheetTitle').textContent = isEdit ? '编辑账单' : '记一笔';
      $('#entryId').value = item?.id || '';
      const type = item?.type || 'expense';
      $$('.form-seg .seg').forEach(btn => btn.classList.toggle('active', btn.dataset.type === type));
      UI.setAccountTypes(type, item?.accountType);
      UI.setCategories($('#accountTypeInput').value, item?.category);
      $('#titleInput').value = item?.title || '';
      $('#amountInput').value = item?.amount || '';
      $('#paymentInput').value = item?.paymentMethod || storage.loadSettings().defaultPaymentMethod;
      $('#dateInput').value = item?.date || storage.nowDate();
      $('#timeInput').value = item?.time || storage.nowTime();
      $('#projectInput').value = item?.project || '';
      $('#supplierInput').value = item?.supplier || '';
      $('#invoiceInput').value = item?.invoiceStatus || '无需开票';
      $('#reimbursementInput').value = item?.reimbursementStatus || '无需报销';
      $('#contractStatusInput').value = item?.contractStatus || '';
      $('#contractNoInput').value = item?.contractNo || '';
      $('#noteInput').value = item?.note || '';
      $('#sheetBackdrop').classList.add('active');
      $('#entrySheet').classList.add('active');
      $('#entrySheet').setAttribute('aria-hidden', 'false');
      setTimeout(() => $('#amountInput').focus(), 80);
    },
    closeSheet() {
      $('#sheetBackdrop').classList.remove('active');
      $('#entrySheet').classList.remove('active');
      $('#entrySheet').setAttribute('aria-hidden', 'true');
      $('#entryForm').reset();
    },
    fillAIPrompt() {
      $('#aiPrompt').value = `请根据我提供的自然语言消费记录，生成可导入 Shawn 记账本 Web App 的 JSON。\n\n要求：\n1. 只输出 JSON，不要输出解释。\n2. JSON 顶层格式为 {"transactions":[...]}。\n3. 每条记录字段：id,type,accountType,category,title,amount,paymentMethod,date,time,project,supplier,invoiceStatus,reimbursementStatus,contractStatus,contractNo,note,createdAt,updatedAt。\n4. type 只能是 expense 或 income；accountType 优先使用 个人支出 / 工作支出 / 收入。\n5. 个人支出分类：加油、餐饮、购物、日用品、抽烟、人情往来、食材、交通、其他。\n6. 工作支出分类：直接转账、淘宝采购、京东采购、个人采购、抖音采购、其他工作支出。\n7. 支付方式：银行卡付款、微信支付、微信转账、支付宝花呗、京东白条、抖音支付/抖音采购、现金、其他。\n8. 淘宝采购默认支付宝花呗，京东采购默认京东白条，抖音采购默认抖音支付/抖音采购，支付宝默认理解为支付宝花呗。\n9. 工作支出尽量保留项目、供应商、发票状态、合同状态、合同号、报销状态。\n10. 今天/昨天/前天必须转换成实际日期。`;
    }
  };

  window.AccountUI = UI;
})();
