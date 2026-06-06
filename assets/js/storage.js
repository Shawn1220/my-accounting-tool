(function () {
  const KEYS = {
    txns: 'shawn_account_book_transactions_v1',
    settings: 'shawn_account_book_settings_v1'
  };

  const DEFAULT_SETTINGS = {
    theme: 'system',
    defaultPaymentMethod: '微信支付',
    displayMode: 'compact',
    defaultView: 'home',
    showIncome: true,
    autoBackup: false
  };

  const PERSONAL_CATEGORIES = ['加油', '餐饮', '购物', '日用品', '抽烟', '人情往来', '食材', '交通', '其他'];
  const WORK_CATEGORIES = ['直接转账', '淘宝采购', '京东采购', '个人采购', '抖音采购', '其他工作支出'];
  const PAYMENT_METHODS = ['银行卡付款', '微信支付', '微信转账', '支付宝花呗', '京东白条', '抖音支付/抖音采购', '现金', '其他'];

  function uid(prefix = 'txn') {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function nowDate() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  function nowTime() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  function normalizePayment(category, paymentMethod) {
    const source = `${category || ''} ${paymentMethod || ''}`;
    if (source.includes('淘宝')) return '支付宝花呗';
    if (source.includes('京东')) return '京东白条';
    if (source.includes('抖音')) return '抖音支付/抖音采购';
    if (source.includes('支付宝')) return '支付宝花呗';
    return paymentMethod || DEFAULT_SETTINGS.defaultPaymentMethod;
  }

  function normalizeRecord(record = {}) {
    const type = record.type === 'income' ? 'income' : 'expense';
    const accountType = record.accountType || (type === 'income' ? '收入' : '个人支出');
    const category = record.category || (accountType.includes('工作') ? '其他工作支出' : type === 'income' ? '收入' : '其他');
    const date = record.date || nowDate();
    const time = record.time || nowTime();
    const amount = Number(record.amount || 0);
    const createdAt = record.createdAt || `${date}T${time}:00`;
    return {
      id: record.id || uid(),
      type,
      accountType,
      category,
      title: record.title || category || '未命名账单',
      amount: Number.isFinite(amount) ? Math.abs(amount) : 0,
      paymentMethod: normalizePayment(category, record.paymentMethod),
      date,
      time,
      project: record.project || '',
      supplier: record.supplier || '',
      invoiceStatus: record.invoiceStatus || (accountType.includes('工作') ? '未开票' : '无需开票'),
      reimbursementStatus: record.reimbursementStatus || (accountType.includes('工作') ? '未报销' : '无需报销'),
      contractStatus: record.contractStatus || '',
      contractNo: record.contractNo || '',
      note: record.note || '',
      createdAt,
      updatedAt: record.updatedAt || new Date().toISOString()
    };
  }

  function safeParse(text, fallback) {
    try { return JSON.parse(text); } catch (e) { return fallback; }
  }

  const Storage = {
    KEYS,
    DEFAULT_SETTINGS,
    PERSONAL_CATEGORIES,
    WORK_CATEGORIES,
    PAYMENT_METHODS,
    uid,
    nowDate,
    nowTime,
    normalizeRecord,
    loadTransactions() {
      const raw = localStorage.getItem(KEYS.txns);
      const data = safeParse(raw, []);
      return Array.isArray(data) ? data.map(normalizeRecord) : [];
    },
    saveTransactions(list) {
      localStorage.setItem(KEYS.txns, JSON.stringify((list || []).map(normalizeRecord)));
    },
    loadSettings() {
      const raw = localStorage.getItem(KEYS.settings);
      return { ...DEFAULT_SETTINGS, ...safeParse(raw, {}) };
    },
    saveSettings(settings) {
      localStorage.setItem(KEYS.settings, JSON.stringify({ ...DEFAULT_SETTINGS, ...(settings || {}) }));
    },
    importTransactions(json) {
      let payload = json;
      if (typeof json === 'string') payload = JSON.parse(json);
      let incoming = [];
      if (Array.isArray(payload)) incoming = payload;
      else if (Array.isArray(payload.transactions)) incoming = payload.transactions;
      else if (Array.isArray(payload.data)) incoming = payload.data;
      else throw new Error('JSON 中未找到 transactions 数组。');

      const existing = Storage.loadTransactions();
      const used = new Set(existing.map(item => item.id));
      const normalized = incoming.map(item => {
        const next = normalizeRecord(item);
        if (used.has(next.id)) next.id = uid('txn_import');
        used.add(next.id);
        return next;
      });
      Storage.saveTransactions([...existing, ...normalized]);
      return normalized;
    },
    clear() {
      localStorage.removeItem(KEYS.txns);
    }
  };

  window.AccountStorage = Storage;
})();
