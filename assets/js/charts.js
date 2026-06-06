(function () {
  const palette = ['#6767f0', '#31b46b', '#f59e0b', '#ef4444', '#39a9f9', '#a855f7', '#14b8a6', '#f97316'];
  function money(v) { return '¥' + (Number(v) || 0).toFixed(2); }
  function sumBy(items, key) {
    return items.reduce((acc, item) => {
      const k = item[key] || '其他';
      acc[k] = (acc[k] || 0) + Number(item.amount || 0);
      return acc;
    }, {});
  }
  function renderDonut(el, items, key) {
    if (!el) return;
    const data = sumBy(items.filter(x => x.type === 'expense'), key);
    const rows = Object.entries(data).sort((a,b)=>b[1]-a[1]).slice(0,6);
    const total = rows.reduce((s, r)=>s+r[1],0);
    if (!total) { el.innerHTML = '<div class="empty-state">暂无支出数据</div>'; return; }
    let offset = 25;
    const circles = rows.map((row, i) => {
      const pct = row[1] / total * 100;
      const html = `<circle r="15.9" cx="18" cy="18" fill="transparent" stroke="${palette[i % palette.length]}" stroke-width="6" stroke-dasharray="${pct} ${100-pct}" stroke-dashoffset="-${offset}" />`;
      offset += pct;
      return html;
    }).join('');
    const legend = rows.map((row, i) => `<div class="legend-row"><i class="dot" style="background:${palette[i % palette.length]}"></i><span>${row[0]}</span><b>${money(row[1])}</b></div>`).join('');
    el.innerHTML = `<svg class="donut-svg" viewBox="0 0 36 36"><circle r="15.9" cx="18" cy="18" fill="transparent" stroke="rgba(130,140,160,.18)" stroke-width="6" />${circles}<text x="18" y="17" text-anchor="middle" font-size="3.5" fill="currentColor">支出</text><text x="18" y="22" text-anchor="middle" font-size="3.4" font-weight="700" fill="currentColor">${Math.round(total)}</text></svg><div class="legend">${legend}</div>`;
  }
  function renderBars(el, items, key) {
    if (!el) return;
    const data = sumBy(items.filter(x => x.type === 'expense'), key);
    const rows = Object.entries(data).sort((a,b)=>b[1]-a[1]).slice(0,8);
    const max = Math.max(...rows.map(r=>r[1]), 0);
    if (!max) { el.innerHTML = '<div class="empty-state">暂无数据</div>'; return; }
    el.innerHTML = rows.map((row, i) => `<div class="bar-row"><span>${row[0]}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.max(5, row[1]/max*100)}%;background:${palette[i % palette.length]}"></div></div><b>${money(row[1])}</b></div>`).join('');
  }
  function renderTrend(el, items) {
    if (!el) return;
    const today = new Date();
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      days.push(d.toISOString().slice(0,10));
    }
    const values = days.map(day => items.filter(x => x.type === 'expense' && x.date === day).reduce((s,x)=>s+Number(x.amount||0),0));
    const max = Math.max(...values, 1);
    const points = values.map((v,i)=>[12 + i * 46, 128 - (v / max) * 94]);
    const poly = points.map(p=>p.join(',')).join(' ');
    const circles = points.map((p,i)=>`<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="${palette[i % palette.length]}"><title>${days[i]} ${money(values[i])}</title></circle>`).join('');
    const labels = points.map((p,i)=>`<text x="${p[0]}" y="150" text-anchor="middle" font-size="10" fill="currentColor" opacity=".65">${days[i].slice(5).replace('-','/')}</text>`).join('');
    el.innerHTML = `<svg viewBox="0 0 300 160" preserveAspectRatio="none"><line x1="12" y1="128" x2="288" y2="128" stroke="currentColor" opacity=".13"/><polyline points="${poly}" fill="none" stroke="#6767f0" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>${circles}${labels}</svg>`;
  }
  function renderWorkStatus(el, items) {
    if (!el) return;
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
    el.innerHTML = keys.map((k,i)=>`<div class="bar-row"><span>${k}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.max(5,data[k]/max*100)}%;background:${palette[i % palette.length]}"></div></div><b>${money(data[k])}</b></div>`).join('');
  }
  window.AccountCharts = { renderDonut, renderBars, renderTrend, renderWorkStatus, money };
})();
