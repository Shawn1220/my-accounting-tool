(function () {
  const STORAGE_KEY = 'shawn_account_book_v11_data';
  const SETTINGS_KEY = 'shawn_account_book_v11_settings';

  const personalCategories = ['加油','餐饮','购物','日用品','抽烟','人情往来','食材','交通','其他'];
  const workCategories = ['直接转账','淘宝采购','京东采购','个人采购','抖音采购','其他工作支出'];
  const defaultPayments = ['银行卡付款','微信支付','微信转账','支付宝花呗','京东白条','抖音支付 / 抖音采购','现金','其他'];

  const defaultTemplates = [
    { title:'买烟', amount:64, category:'抽烟', accountType:'个人支出', paymentMethod:'微信支付', note:'四包烟' },
    { title:'早餐', amount:18, category:'餐饮', accountType:'个人支出', paymentMethod:'微信支付' },
    { title:'午饭', amount:35, category:'餐饮', accountType:'个人支出', paymentMethod:'支付宝花呗' },
    { title:'菜市场', amount:20.9, category:'食材', accountType:'个人支出', paymentMethod:'现金', supplier:'菜市场' },
    { title:'交通', amount:12, category:'交通', accountType:'个人支出', paymentMethod:'微信支付' },
    { title:'京东购物', amount:100, category:'购物', accountType:'个人支出', paymentMethod:'京东白条', supplier:'京东' }
  ];

  const defaultSettings = {
    theme: 'system',
    accent: 'mint',
    monthlyBudget: 3000,
    defaultPayment: '微信支付',
    defaultPage: 'home',
    displayMode: 'comfortable',
    showIncome: true,
    privacyMode: false,
    categories: [...personalCategories],
    paymentMethods: [...defaultPayments],
    quickTemplates: [...defaultTemplates]
  };

  const demoTransactions = [
    { id:'txn_demo_001', type:'expense', accountType:'个人支出', category:'餐饮', title:'早餐', amount:18, paymentMethod:'微信支付', date:'2026-06-06', time:'08:12', project:'', supplier:'', invoiceStatus:'无需开票', reimbursementStatus:'无需报销', contractStatus:'', contractNo:'', note:'', createdAt:'2026-06-06T08:12:00', updatedAt:'2026-06-06T08:12:00' },
    { id:'txn_demo_002', type:'expense', accountType:'个人支出', category:'抽烟', title:'买烟', amount:64, paymentMethod:'微信支付', date:'2026-06-06', time:'10:15', project:'', supplier:'', invoiceStatus:'无需开票', reimbursementStatus:'无需报销', contractStatus:'', contractNo:'', note:'四包烟', createdAt:'2026-06-06T10:15:00', updatedAt:'2026-06-06T10:15:00' },
    { id:'txn_demo_003', type:'expense', accountType:'个人支出', category:'食材', title:'菜市场', amount:20.9, paymentMethod:'现金', date:'2026-06-06', time:'18:23', project:'', supplier:'菜市场', invoiceStatus:'无需开票', reimbursementStatus:'无需报销', contractStatus:'', contractNo:'', note:'买菜', createdAt:'2026-06-06T18:23:00', updatedAt:'2026-06-06T18:23:00' },
    { id:'txn_demo_004', type:'expense', accountType:'个人支出', category:'交通', title:'地铁', amount:8, paymentMethod:'微信支付', date:'2026-06-05', time:'09:05', project:'', supplier:'', invoiceStatus:'无需开票', reimbursementStatus:'无需报销', contractStatus:'', contractNo:'', note:'', createdAt:'2026-06-05T09:05:00', updatedAt:'2026-06-05T09:05:00' },
    { id:'txn_demo_005', type:'expense', accountType:'个人支出', category:'餐饮', title:'午饭', amount:35, paymentMethod:'支付宝花呗', date:'2026-06-05', time:'12:10', project:'', supplier:'', invoiceStatus:'无需开票', reimbursementStatus:'无需报销', contractStatus:'', contractNo:'', note:'', createdAt:'2026-06-05T12:10:00', updatedAt:'2026-06-05T12:10:00' },
    { id:'txn_demo_006', type:'expense', accountType:'个人支出', category:'购物', title:'京东购物', amount:100, paymentMethod:'京东白条', date:'2026-06-04', time:'20:40', project:'', supplier:'京东', invoiceStatus:'无需开票', reimbursementStatus:'无需报销', contractStatus:'', contractNo:'', note:'个人购物示例', createdAt:'2026-06-04T20:40:00', updatedAt:'2026-06-04T20:40:00' }
  ];

  function safeParse(value, fallback) {
    try { return value ? JSON.parse(value) : fallback; } catch (e) { return fallback; }
  }
  function uid() { return 'txn_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7); }
  function today() { return new Date().toISOString().slice(0, 10); }
  function nowTime() { return new Date().toTimeString().slice(0, 5); }
  function isoFrom(date, time) { return `${date || today()}T${time || nowTime()}:00`; }
  function normalizePayment(v) {
    if (!v) return '';
    const text = String(v).trim();
    if (text === '支付宝') return '支付宝花呗';
    if (text.includes('抖音')) return '抖音支付 / 抖音采购';
    return text;
  }
  function defaultPaymentByCategory(category, fallback) {
    if (category === '淘宝采购') return '支付宝花呗';
    if (category === '京东采购') return '京东白条';
    if (category === '抖音采购') return '抖音支付 / 抖音采购';
    return fallback || defaultSettings.defaultPayment;
  }
  function normalizeTransaction(input, usedIds) {
    const t = input || {};
    const date = t.date || today();
    const time = t.time || nowTime();
    const category = t.category || (t.accountType === '工作支出' ? '其他工作支出' : '其他');
    const accountType = t.accountType || (workCategories.includes(category) ? '工作支出' : '个人支出');
    let id = t.id || uid();
    if (usedIds && usedIds.has(id)) id = uid();
    if (usedIds) usedIds.add(id);
    const createdAt = t.createdAt || isoFrom(date, time);
    return {
      id,
      type: t.type === 'income' ? 'income' : 'expense',
      accountType,
      category,
      title: t.title || category || '未命名账单',
      amount: Number(t.amount) || 0,
      paymentMethod: normalizePayment(t.paymentMethod) || defaultPaymentByCategory(category),
      date,
      time,
      project: t.project || '',
      supplier: t.supplier || '',
      invoiceStatus: t.invoiceStatus || (accountType === '工作支出' ? '待开票' : '无需开票'),
      reimbursementStatus: t.reimbursementStatus || (accountType === '工作支出' ? '待报销' : '无需报销'),
      contractStatus: t.contractStatus || '',
      contractNo: t.contractNo || '',
      note: t.note || '',
      deletedAt: t.deletedAt || '',
      createdAt,
      updatedAt: t.updatedAt || new Date().toISOString()
    };
  }
  function loadData() {
    const saved = safeParse(localStorage.getItem(STORAGE_KEY), null);
    if (Array.isArray(saved)) return saved.map(x => normalizeTransaction(x));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(demoTransactions));
    return demoTransactions.map(x => normalizeTransaction(x));
  }
  function saveData(data) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
  function loadSettings() {
    const saved = safeParse(localStorage.getItem(SETTINGS_KEY), {});
    return { ...defaultSettings, ...saved, categories: saved.categories || defaultSettings.categories, paymentMethods: saved.paymentMethods || defaultSettings.paymentMethods, quickTemplates: saved.quickTemplates || defaultSettings.quickTemplates };
  }
  function saveSettings(settings) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }
  function importData(json, mode) {
    let incoming = typeof json === 'string' ? JSON.parse(json) : json;
    if (incoming && Array.isArray(incoming.transactions)) incoming = incoming.transactions;
    if (!Array.isArray(incoming)) throw new Error('JSON 格式错误：需要账单数组，或包含 transactions 数组的对象。');
    const used = new Set(mode === 'append' ? loadData().map(x => x.id) : []);
    const normalized = incoming.map(x => normalizeTransaction(x, used));
    const next = mode === 'append' ? [...loadData(), ...normalized] : normalized;
    saveData(next);
    return { count: normalized.length, data: next };
  }
  function exportData() {
    return JSON.stringify({ app: 'Shawn Account Book', exportedAt: new Date().toISOString(), transactions: loadData(), settings: loadSettings() }, null, 2);
  }
  function resetDemo() { saveData(demoTransactions.map(x => normalizeTransaction(x))); return loadData(); }
  function clearData() { saveData([]); return []; }

  window.AccountStorage = {
    personalCategories,
    workCategories,
    defaultPayments,
    defaultSettings,
    defaultTemplates,
    demoTransactions,
    loadData,
    saveData,
    loadSettings,
    saveSettings,
    importData,
    exportData,
    resetDemo,
    clearData,
    normalizeTransaction,
    defaultPaymentByCategory,
    normalizePayment,
    uid,
    today,
    nowTime
  };
})();
