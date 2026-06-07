(function () {
  function cssVar(name, fallback) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  }
  function palette() {
    const primary = cssVar('--primary', '#5bc8bd');
    return [primary, '#31b46b', '#f59e0b', '#ef4444', '#58b7f8', '#a855f7', '#14b8a6', '#f97316'];
  }
  function money(v) { return '¥' + (Number(v) || 0).toFixed(2); }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>\"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[ch])); }
  function sumBy(items, key) {
    return items.reduce((acc, item) => {
      const k = item[key] || '其他';
      acc[k] = (acc[k] || 0) + Number(item.amount || 0);
      return acc;
    }, {});
  }
  function renderDonut(el, items, key) {
    if (!el) return;
    const colors = palette();
    const data = sumBy(items.filter(x => x.type === 'expense'), key);
    const rows = Object.entries(data).sort((a,b)=>b[1]-a[1]).slice(0,6);
    const total = rows.reduce((sum, row)=>sum+row[1],0);
    if (!total) {
      el.innerHTML = `<svg class="donut-svg" viewBox="0 0 120 120" aria-label="暂无数据"><circle cx="60" cy="60" r="42" fill="none" stroke="rgba(130,140,160,.2)" stroke-width="14"/><text x="60" y="64" text-anchor="middle" fill="currentColor" opacity=".65" font-size="11">暂无数据</text></svg><div class="legend"><div class="empty-state">暂无支出数据</div></div>`;
      return;
    }
    const r = 42;
    const c = 2 * Math.PI * r;
    let circles = '';
    if (rows.length === 1) {
      circles = `<circle cx="60" cy="60" r="${r}" fill="none" stroke="${colors[0]}" stroke-width="14" stroke-linecap="round"/>`;
    } else {
      let offset = 0;
      circles = rows.map((row, i) => {
        const len = Math.max(0, row[1] / total * c - 0.55);
        const html = `<circle cx="60" cy="60" r="${r}" fill="none" stroke="${colors[i % colors.length]}" stroke-width="14" stroke-linecap="round" stroke-dasharray="${len.toFixed(3)} ${(c-len).toFixed(3)}" stroke-dashoffset="${(-offset).toFixed(3)}" transform="rotate(-90 60 60)"/>`;
        offset += row[1] / total * c;
        return html;
      }).join('');
    }
    const legend = rows.map((row, i) => {
      const pct = total ? Math.round(row[1] / total * 100) : 0;
      return `<div class="legend-row"><i class="dot" style="background:${colors[i % colors.length]}"></i><span>${row[0]} <em>${pct}%</em></span><b>${money(row[1])}</b></div>`;
    }).join('');
    el.innerHTML = `<svg class="donut-svg" viewBox="0 0 120 120"><circle cx="60" cy="60" r="${r}" fill="none" stroke="rgba(130,140,160,.18)" stroke-width="14"/>${circles}<text class="donut-center-label" x="60" y="54" text-anchor="middle" fill="currentColor">总支出</text><text class="donut-center-value" x="60" y="72" text-anchor="middle" fill="currentColor">${Math.round(total)}</text></svg><div class="legend">${legend}</div>`;
  }
  function renderBars(el, items, key) {
    if (!el) return;
    const colors = palette();
    const data = sumBy(items.filter(x => x.type === 'expense'), key);
    const rows = Object.entries(data).sort((a,b)=>b[1]-a[1]).slice(0,8);
    const max = Math.max(...rows.map(r=>r[1]), 0);
    if (!max) { el.innerHTML = '<div class="empty-state">暂无数据</div>'; return; }
    el.innerHTML = rows.map((row, i) => `<div class="bar-row"><span>${row[0]}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.max(5, row[1]/max*100)}%;background:${colors[i % colors.length]}"></div></div><b>${money(row[1])}</b></div>`).join('');
  }
  function renderTrend(el, items) {
    if (!el) return;
    const primary = cssVar('--primary', '#5bc8bd');
    const maxDate = items.map(x => x.date).filter(Boolean).sort().pop();
    const today = maxDate ? new Date(maxDate + 'T12:00:00') : new Date();
    const days = [];
    for (let i = 6; i >= 0; i--) { const d = new Date(today); d.setDate(today.getDate() - i); days.push(d.toISOString().slice(0,10)); }
    const values = days.map(day => items.filter(x => x.type === 'expense' && x.date === day).reduce((s,x)=>s+Number(x.amount||0),0));
    const max = Math.max(...values, 1);
    const points = values.map((v,i)=>[12 + i * 46, 126 - (v / max) * 90]);
    const poly = points.map(p=>p.join(',')).join(' ');
    const circles = points.map((p,i)=>`<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="${primary}"><title>${days[i]} ${money(values[i])}</title></circle>`).join('');
    const labels = points.map((p,i)=>`<text x="${p[0]}" y="150" text-anchor="middle" font-size="10" fill="currentColor" opacity=".65">${days[i].slice(5).replace('-','/')}</text>`).join('');
    el.innerHTML = `<svg viewBox="0 0 300 160" preserveAspectRatio="none"><line x1="12" y1="126" x2="288" y2="126" stroke="currentColor" opacity=".13"/><polyline points="${poly}" fill="none" stroke="${primary}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>${circles}${labels}</svg>`;
  }
  function renderWorkStatus(el, items) {
    if (!el) return;
    const colors = palette();
    const work = items.filter(x => x.accountType === '工作支出' && x.type === 'expense');
    const keys = ['待报销','已报销','待开票','已开票'];
    const data = {
      '待报销': work.filter(x => x.reimbursementStatus === '待报销').reduce((s,x)=>s+x.amount,0),
      '已报销': work.filter(x => x.reimbursementStatus === '已报销').reduce((s,x)=>s+x.amount,0),
      '待开票': work.filter(x => x.invoiceStatus === '待开票').reduce((s,x)=>s+x.amount,0),
      '已开票': work.filter(x => x.invoiceStatus === '已开票').reduce((s,x)=>s+x.amount,0)
    };
    const max = Math.max(...Object.values(data), 0);
    if (!max) { el.innerHTML = '<div class="empty-state">暂无工作支出状态数据</div>'; return; }
    el.innerHTML = keys.map((k,i)=>`<div class="bar-row"><span>${k}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.max(5,data[k]/max*100)}%;background:${colors[i % colors.length]}"></div></div><b>${money(data[k])}</b></div>`).join('');
  }

  function renderProjectBars(el, items) {
    if (!el) return;
    const work = items.filter(x => x.type === 'expense' && x.accountType === '工作支出');
    const data = work.reduce((acc, item) => {
      const key = item.project || item.supplier || '未填写项目';
      acc[key] = (acc[key] || 0) + Number(item.amount || 0);
      return acc;
    }, {});
    const rows = Object.entries(data).sort((a,b)=>b[1]-a[1]).slice(0,8);
    const max = Math.max(...rows.map(r=>r[1]), 0);
    if (!max) { el.innerHTML = '<div class="empty-state">暂无项目支出数据</div>'; return; }
    const colors = palette();
    el.innerHTML = rows.map((row,i)=>`<button class="bar-row project-jump" type="button" data-project-jump="${esc(row[0])}"><span>${esc(row[0])}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.max(5,row[1]/max*100)}%;background:${colors[i % colors.length]}"></div></div><b>${money(row[1])}</b></button>`).join('');
  }

  function renderPersonalInsight(el, items) {
    if (!el) return;
    const expenseItems = items.filter(x => x.type === 'expense');
    const total = expenseItems.reduce((s, x) => s + Number(x.amount || 0), 0);
    const dayCount = new Set(expenseItems.map(x => x.date)).size || 1;
    const categoryData = sumBy(expenseItems, 'category');
    const paymentData = sumBy(expenseItems, 'paymentMethod');
    const topCategory = Object.entries(categoryData).sort((a,b)=>b[1]-a[1])[0];
    const topPayment = Object.entries(paymentData).sort((a,b)=>b[1]-a[1])[0];
    const count = expenseItems.length;
    el.innerHTML = `
      <div class="insight-card"><span>日均支出</span><b>${money(total / dayCount)}</b></div>
      <div class="insight-card"><span>支出笔数</span><b>${count} 笔</b></div>
      <div class="insight-card"><span>最高分类</span><b>${esc(topCategory ? topCategory[0] : '暂无')}</b></div>
      <div class="insight-card"><span>常用支付</span><b>${esc(topPayment ? topPayment[0] : '暂无')}</b></div>`;
  }

  window.AccountCharts = { renderDonut, renderBars, renderTrend, renderWorkStatus, renderProjectBars, renderPersonalInsight, money };
})();
