# Shawn 记账本 Web App

这是一个可以直接部署到 GitHub Pages 的静态记账本 Web App。项目使用原生 HTML、CSS、JavaScript 编写，不依赖服务器、不依赖数据库、不依赖外部 CDN，也不需要构建步骤。

## 功能

- 记账本首页：本月支出、本月收入、本月结余、今日支出
- 记一笔底部弹层：支持支出、收入、分类、支付方式、项目、供应商、发票、报销、合同信息
- 全部明细：按日期分组，支持搜索和筛选
- 统计分析：分类占比、支付方式占比、最近 7 天支出趋势
- 账单详情：查看、编辑、删除账单
- 设置：主题、默认支付方式、导入导出、清空数据、恢复示例数据、AI 提示词
- PWA：支持添加到手机主屏幕，并带有基础缓存
- 数据保存：使用浏览器 localStorage，本地保存账单数据

## 文件结构

```text
account-book-app/
├── index.html
├── README.md
├── manifest.json
├── service-worker.js
├── .nojekyll
├── assets/
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   ├── app.js
│   │   ├── storage.js
│   │   ├── ui.js
│   │   └── charts.js
│   └── icons/
│       ├── icon-192.png
│       └── icon-512.png
└── data/
    └── demo-data.json
```

## GitHub Pages 部署方法

1. 新建 GitHub 仓库。
2. 上传本项目文件夹内的所有文件，确保 `index.html` 位于仓库根目录。
3. 打开仓库的 `Settings`。
4. 找到 `Pages`。
5. `Source` 选择 `Deploy from a branch`。
6. `Branch` 选择 `main`，目录选择 `/root`。
7. 保存后等待 GitHub Pages 生成访问网址。
8. 打开生成的网址即可使用记账本。

## iPhone 添加到主屏幕

1. 使用 Safari 打开 GitHub Pages 网址。
2. 点击 Safari 底部分享按钮。
3. 选择“添加到主屏幕”。
4. 之后可像 App 一样从主屏幕打开。

## 数据说明

账单数据保存在当前浏览器的 localStorage 中。更换浏览器、清理浏览器数据或更换设备后，原数据不会自动同步。建议定期在设置页导出 JSON 备份。

## 导入 JSON 格式

支持以下两种格式：

```json
{
  "transactions": [
    {
      "id": "txn_001",
      "type": "expense",
      "accountType": "个人支出",
      "category": "餐饮",
      "title": "早餐",
      "amount": 18,
      "paymentMethod": "微信支付",
      "date": "2026-06-06",
      "time": "08:12",
      "project": "",
      "supplier": "",
      "invoiceStatus": "无需开票",
      "reimbursementStatus": "无需报销",
      "contractStatus": "",
      "contractNo": "",
      "note": "",
      "createdAt": "2026-06-06T08:12:00",
      "updatedAt": "2026-06-06T08:12:00"
    }
  ]
}
```

也支持直接导入数组：

```json
[
  {
    "title": "早餐",
    "amount": 18,
    "type": "expense",
    "accountType": "个人支出",
    "category": "餐饮",
    "paymentMethod": "微信支付",
    "date": "2026-06-06",
    "time": "08:12"
  }
]
```

如果字段缺失，系统会自动补默认值。如果 ID 重复，系统会自动生成新的 ID，避免覆盖已有数据。

## Shawn Tools 预留接口

`app.js` 中已预留：

```js
window.ShawnToolsAccounting = {
  getData(),
  setData(data),
  exportJSON(),
  importJSON(json),
  getSummary(),
  setTheme(theme),
  openAddEntry(),
  resetDemoData()
}
```

## 注意事项

- 所有资源路径均使用相对路径，适合 GitHub Pages。
- 前端没有写入任何 API Key、GitHub Token 或 Google Token。
- 当前同步功能仅为占位状态，不会连接任何云端服务。
- 如需多人或多设备同步，建议以后增加独立后端或安全的云同步方案，不要把密钥写在前端代码里。
