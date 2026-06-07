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
  function download(filename, text, mime) {
    const blob = new Blob([text], { type: mime || 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 800);
  }
  function iconFor(category) {
    const map = { '餐饮':'餐','食材':'菜','抽烟':'烟','购物':'购','日用品':'用','交通':'行','加油':'油','人情往来':'礼','京东采购':'京','淘宝采购':'淘','抖音采购':'抖','直接转账':'转','个人采购':'采','其他工作支出':'工','其他':'其' };
    return map[category] || String(category || '其').slice(0,1);
  }
  function recordHtml(t) {
    return `<div class="record-shell" data-id="${t.id}">
      <div class="record-actions"><button class="edit" data-action="edit" type="button">编辑</button><button class="copy" data-action="copy" type="button">复制</button><button class="delete" data-action="delete" type="button">删除</button></div>
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
      let startX = 0, currentX = 0, dragging = false, moved = false;
      const start = x => { startX = x; currentX = x; dragging = true; moved = false; };
      const move = x => {
        if (!dragging) return;
        currentX = x;
        const dx = currentX - startX;
        if (dx < -12) {
          moved = true;
          item.style.transform = `translateX(${Math.max(dx, -216)}px)`;
        }
      };
      const end = () => {
        if (!dragging) return;
        dragging = false;
        const dx = currentX - startX;
        item.style.transform = '';
        closeOtherSwipes(item);
        item.classList.toggle('swiped', dx < -55);
      };
      item.addEventListener('touchstart', e => start(e.touches[0].clientX), { passive: true });
      item.addEventListener('touchmove', e => move(e.touches[0].clientX), { passive: true });
      item.addEventListener('touchend', end);
      item.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' || e.pointerType === 'pen') start(e.clientX); });
      item.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' || e.pointerType === 'pen') move(e.clientX); });
      item.addEventListener('pointerup', e => { if (e.pointerType === 'mouse' || e.pointerType === 'pen') end(); });
      item.addEventListener('pointercancel', end);
      item.addEventListener('click', e => {
        if (item.classList.contains('swiped')) { item.classList.remove('swiped'); e.stopPropagation(); return; }
        if (moved) { e.stopPropagation(); moved = false; }
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
      ['类型', t.type === 'income' ? '收入' : '支出'],
      ['分类', t.category],
      ['支付方式', t.paymentMethod],
      ['交易时间', `${t.date} ${t.time}`],
      ['标签 / 场景', t.project || '-'],
      ['商家', t.supplier || '-'],
      ['备注', t.note || '-']
    ];
    return `<div class="detail-title"><h2>${escapeHtml(t.title)}</h2><div class="big-amount ${t.type}">${signedMoney(t)}</div></div><div class="detail-grid">${lines.map(l=>`<div class="detail-line"><span>${l[0]}</span><b>${escapeHtml(l[1])}</b></div>`).join('')}</div><div class="detail-actions"><button class="edit" data-detail-action="edit" type="button">编辑账单</button><button class="delete" data-detail-action="delete" type="button">删除账单</button></div>`;
  }
  function aiPrompt() {
    return `请根据我的自然语言私人消费描述，生成可导入 Shawn 私人记账本的 JSON。

规则：
1. 只输出 JSON，不要输出解释。
2. JSON 可以是数组，也可以是 {"transactions": []}。
3. 常用字段包括 id、type、accountType、category、title、amount、paymentMethod、date、time、project、supplier、note。
4. type 只能是 expense 或 income。
5. accountType 默认使用“个人支出”。
6. 个人分类：加油、餐饮、购物、日用品、抽烟、人情往来、食材、交通、其他。
7. 支付方式：银行卡付款、微信支付、微信转账、支付宝花呗、京东白条、抖音支付 / 抖音采购、现金、其他。
8. 如果描述里出现“支付宝”，默认理解为“支付宝花呗”；如果出现“京东白条”，支付方式使用“京东白条”，分类通常使用“购物”。
9. 今天、昨天、前天要转换为实际日期。
10. project 可作为标签 / 场景，supplier 可作为商家；没有信息时留空。`;
  }
  window.AccountUI = { $, $$, money, signedMoney, toast, download, renderRecords, renderGroupedRecords, setTheme, setActiveNav, optionButtons, formatDetail, aiPrompt, escapeHtml, closeOtherSwipes };
})();
