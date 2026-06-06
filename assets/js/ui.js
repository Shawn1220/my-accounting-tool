(function () {
  function $(selector, root) { return (root || document).querySelector(selector); }
  function $$(selector, root) { return Array.from((root || document).querySelectorAll(selector)); }
  function money(value) { return '¥' + (Number(value) || 0).toFixed(2); }
  function signedMoney(t) { return (t.type === 'income' ? '+' : '-') + money(t.amount); }
  function toast(message, actionLabel, action) {
    const el = $('#toast');
    if (!el) return;
    el.innerHTML = '';
    const span = document.createElement('span');
    span.textContent = message;
    el.appendChild(span);
    if (actionLabel && typeof action === 'function') {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = actionLabel;
      btn.onclick = () => { el.classList.remove('show'); action(); };
      el.appendChild(btn);
    }
    el.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove('show'), actionLabel ? 5000 : 1800);
  }
  function download(filename, text) {
    const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 800);
  }
  function iconFor(category) {
    const map = { '餐饮':'🍜','食材':'🥬','抽烟':'🚬','购物':'🛍️','日用品':'🧴','交通':'🚕','加油':'⛽','人情往来':'🎁','京东采购':'📦','淘宝采购':'🛒','抖音采购':'🎬','直接转账':'💸','个人采购':'🧾','其他工作支出':'📁','其他':'✨' };
    return map[category] || '✨';
  }
  function recordHtml(t) {
    return `<div class="record-shell" data-id="${t.id}">
      <div class="record-actions"><button class="edit" data-action="edit" type="button">编辑</button><button class="delete" data-action="delete" type="button">删除</button></div>
      <div class="record-item" data-action="open">
        <div class="category-icon">${iconFor(t.category)}</div>
        <div class="record-main"><h3>${escapeHtml(t.title)}</h3><p>${escapeHtml(t.paymentMethod)} · ${escapeHtml(t.category)} · ${escapeHtml(t.date)} ${escapeHtml(t.time)}</p></div>
        <div class="record-amount ${t.type}">${signedMoney(t)}</div>
      </div>
    </div>`;
  }
  function escapeHtml(v) {
    return String(v == null ? '' : v).replace(/[&<>'"]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[s]));
  }
  function renderRecords(container, records, emptyText) {
    if (!container) return;
    if (!records.length) { container.innerHTML = `<div class="empty-state">${emptyText || '暂无记录'}</div>`; return; }
    container.innerHTML = records.map(recordHtml).join('');
    enableSwipe(container);
  }
  function renderGroupedRecords(container, records) {
    if (!container) return;
    if (!records.length) { container.innerHTML = '<div class="empty-state">暂无明细记录</div>'; return; }
    const groups = records.reduce((acc, t) => { (acc[t.date] ||= []).push(t); return acc; }, {});
    container.innerHTML = Object.keys(groups).sort((a,b)=>b.localeCompare(a)).map(date => `<div class="date-group">${date}</div>${groups[date].map(recordHtml).join('')}`).join('');
    enableSwipe(container);
  }
  function enableSwipe(container) {
    $$('.record-item', container).forEach(item => {
      let startX = 0, currentX = 0, dragging = false;
      item.addEventListener('touchstart', e => { startX = e.touches[0].clientX; currentX = startX; dragging = true; }, { passive: true });
      item.addEventListener('touchmove', e => { if (!dragging) return; currentX = e.touches[0].clientX; const dx = currentX - startX; if (dx < -18) item.style.transform = `translateX(${Math.max(dx, -144)}px)`; }, { passive: true });
      item.addEventListener('touchend', () => { if (!dragging) return; dragging = false; const dx = currentX - startX; item.style.transform = ''; closeOtherSwipes(item); item.classList.toggle('swiped', dx < -55); });
      item.addEventListener('click', e => {
        if (item.classList.contains('swiped')) { item.classList.remove('swiped'); e.stopPropagation(); }
      });
    });
  }
  function closeOtherSwipes(except) { $$('.record-item.swiped').forEach(el => { if (el !== except) el.classList.remove('swiped'); }); }
  function setTheme(theme, accent) { document.documentElement.setAttribute('data-theme', theme || 'system'); document.documentElement.setAttribute('data-accent', accent || 'mint'); }
  function setActiveNav(view) {
    $$('.bottom-nav button').forEach(btn => btn.classList.toggle('active', btn.dataset.nav === view));
    $$('.view').forEach(v => v.classList.toggle('active', v.dataset.view === view));
    $('#fabAdd')?.classList.toggle('hidden', view === 'my' || view === 'transaction');
  }
  function optionButtons(container, values, active, attr) {
    if (!container) return;
    container.innerHTML = values.map(v => `<button class="chip ${v === active ? 'active' : ''}" data-${attr}="${escapeHtml(v)}" type="button">${escapeHtml(v)}</button>`).join('');
  }
  function formatDetail(t) {
    const lines = [
      ['类型', t.type === 'income' ? '收入' : '支出'], ['账目类型', t.accountType], ['分类', t.category], ['支付方式', t.paymentMethod], ['交易时间', `${t.date} ${t.time}`], ['项目', t.project || '-'], ['供应商', t.supplier || '-'], ['发票状态', t.invoiceStatus || '-'], ['报销状态', t.reimbursementStatus || '-'], ['合同状态', t.contractStatus || '-'], ['合同号', t.contractNo || '-'], ['备注', t.note || '-']
    ];
    return `<div class="detail-title"><h2>${escapeHtml(t.title)}</h2><div class="big-amount ${t.type}">${signedMoney(t)}</div></div><div class="detail-grid">${lines.map(l=>`<div class="detail-line"><span>${l[0]}</span><b>${escapeHtml(l[1])}</b></div>`).join('')}</div><div class="detail-actions"><button class="edit" data-detail-action="edit" type="button">编辑账单</button><button class="delete" data-detail-action="delete" type="button">删除账单</button></div>`;
  }
  function aiPrompt() {
    return `请根据我的自然语言消费描述，生成可导入 Shawn 记账本的 JSON。\n\n规则：\n1. 只输出 JSON，不要输出解释。\n2. JSON 可以是数组，也可以是 {"transactions": []}。\n3. 字段包括 id、type、accountType、category、title、amount、paymentMethod、date、time、project、supplier、invoiceStatus、reimbursementStatus、contractStatus、contractNo、note。\n4. type 只能是 expense 或 income。\n5. accountType 使用“个人支出”或“工作支出”。\n6. 个人分类：加油、餐饮、购物、日用品、抽烟、人情往来、食材、交通、其他。\n7. 工作分类：直接转账、淘宝采购、京东采购、个人采购、抖音采购、其他工作支出。\n8. 淘宝采购默认支付宝花呗；京东采购默认京东白条；抖音采购默认抖音支付 / 抖音采购；支付宝默认理解为支付宝花呗。\n9. 工作支出尽量保留项目、供应商、发票状态、合同状态、合同号、报销状态。\n10. 今天、昨天、前天要转换为实际日期。`;
  }
  window.AccountUI = { $, $$, money, signedMoney, toast, download, renderRecords, renderGroupedRecords, setTheme, setActiveNav, optionButtons, formatDetail, aiPrompt, escapeHtml, closeOtherSwipes };
})();
