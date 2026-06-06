# Shawn 记账本 GitHub Pages V1-1

这是一个可以直接部署到 GitHub Pages 的静态记账本 Web App。项目使用原生 HTML、CSS、JavaScript 编写，不依赖服务器、数据库、外部 CDN 或构建工具。

## V1-1 更新重点

- 首页左上角按钮改为 Shawn Tools 返回占位；独立打开时会提示当前为独立模式。
- 首页和全部明细支持左滑显示“编辑 / 删除”。
- 重构“记一笔”底部弹层，更接近手机 App 录入体验。
- 修复 iPhone Safari 下日期和时间输入框重叠问题。
- 新增快速金额按钮：10、20、50、100、500、1000。
- 新增底部导航：首页、明细、统计、设置。
- 工作信息默认折叠，选择工作支出或工作分类时自动展开。
- 分类与支付方式自动联动：淘宝采购=支付宝花呗，京东采购=京东白条，抖音采购=抖音支付 / 抖音采购。

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
2. 将本项目文件上传到仓库根目录，确保 `index.html` 位于仓库根目录。
3. 打开仓库 `Settings`。
4. 找到 `Pages`。
5. Source 选择 `Deploy from a branch`。
6. Branch 选择 `main`，目录选择 `/root`。
7. 保存后等待 GitHub Pages 生成访问网址。

## 数据保存说明

当前版本使用浏览器 `localStorage` 保存数据。数据保存在当前浏览器和当前域名下。更换设备或浏览器时，请使用“设置 → 导出 JSON / 导入 JSON”迁移数据。

## Shawn Tools 接口

页面预留：

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

- 不要把 API Key、GitHub Token、Google Token 写入前端代码。
- 如果未来增加云同步，请通过安全后端或受控授权流程实现。
- GitHub Pages 是静态托管，不能直接提供数据库能力。
