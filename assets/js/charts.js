(function () {
  const COLORS = ['#5b5ce2', '#30b86f', '#f59f28', '#ef4d56', '#25a7c8', '#9b7bff', '#6b7c93', '#d87a9b'];

  function money(num) {
    return `¥${Number(num || 0).toFixed(2)}`;
  }

  function groupSum(list, field) {
    return list.reduce((acc, item) => {
      const key = item[field] || '其他';
      acc[key] = (acc[key] || 0) + Number(item.amount || 0);
      return acc;
    }, {});
  }

  function renderDonut(container, legend, dataMap) {
    if (!container || !legend) return;
    const entries = Object.entries(dataMap).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((sum, [, value]) => sum + value, 0);
    if (!total) {
      container.innerHTML = '<div class="empty">暂无数据</div>';
      legend.innerHTML = '';
      return;
    }
    const radius = 46;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;
    const circles = entries.map(([label, value], index) => {
      const dash = value / total * circumference;
      const circle = `<circle r="${radius}" cx="64" cy="64" fill="transparent" stroke="${COLORS[index % COLORS.length]}" stroke-width="18" stroke-linecap="round" stroke-dasharray="${dash} ${circumference - dash}" stroke-dashoffset="${-offset}" transform="rotate(-90 64 64)"/>`;
      offset += dash;
      return circle;
    }).join('');
    container.innerHTML = `<svg viewBox="0 0 128 128" aria-label="环形图"><circle r="46" cx="64" cy="64" fill="transparent" stroke="rgba(128,128,128,0.16)" stroke-width="18"/>${circles}<text x="64" y="59" text-anchor="middle" font-size="14" fill="currentColor">合计</text><text x="64" y="78" text-anchor="middle" font-size="14" font-weight="700" fill="currentColor">${money(total).replace('¥','')}</text></svg>`;
    legend.innerHTML = entries.map(([label, value], index) => `<div class="legend-item"><span class="legend-left"><i class="dot" style="background:${COLORS[index % COLORS.length]}"></i><span>${label}</span></span><strong>${money(value)}</strong></div>`).join('');
  }

  function renderBars(container, dataMap) {
    if (!container) return;
    const entries = Object.entries(dataMap).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const max = Math.max(1, ...entries.map(([, v]) => v));
    if (!entries.length) {
      container.innerHTML = '<div class="empty">暂无数据</div>';
      return;
    }
    container.innerHTML = entries.map(([label, value], index) => {
      const pct = Math.max(4, value / max * 100);
      return `<div class="bar-row"><div class="bar-top"><span>${label}</span><strong>${money(value)}</strong></div><div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${COLORS[index % COLORS.length]}"></div></div></div>`;
    }).join('');
  }

  function renderTrend(container, transactions) {
    if (!container) return;
    const today = new Date();
    const days = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      days.push({ key, label: `${d.getMonth() + 1}/${d.getDate()}`, value: 0 });
    }
    const byDate = new Map(days.map(d => [d.key, d]));
    transactions.filter(t => t.type === 'expense').forEach(t => {
      if (byDate.has(t.date)) byDate.get(t.date).value += Number(t.amount || 0);
    });
    const max = Math.max(1, ...days.map(d => d.value));
    const w = 340, h = 160, pad = 24;
    const points = days.map((d, i) => {
      const x = pad + i * ((w - pad * 2) / 6);
      const y = h - pad - (d.value / max) * (h - pad * 2);
      return { ...d, x, y };
    });
    const path = points.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ');
    container.innerHTML = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="最近7天支出趋势"><path d="M ${pad} ${h - pad} H ${w - pad}" stroke="rgba(128,128,128,0.22)"/><path d="${path}" fill="none" stroke="var(--primary)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>${points.map(p => `<circle cx="${p.x}" cy="${p.y}" r="5" fill="var(--primary)"/><text x="${p.x}" y="${h - 5}" text-anchor="middle" font-size="11" fill="currentColor" opacity="0.65">${p.label}</text>`).join('')}</svg>`;
  }

  window.AccountCharts = { COLORS, money, groupSum, renderDonut, renderBars, renderTrend };
})();
