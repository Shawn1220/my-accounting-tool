# Shawn 记账本 GitHub Pages V1-2

这是一个可以直接部署到 GitHub Pages 的静态记账本 Web App / PWA。

## V1-2 更新重点

- 首页视觉优化：主卡片缩小，默认主题改为更清爽的薄荷绿。
- 最近记录和全部明细左滑删除：点击删除后直接删除，不再二次弹窗，并提供撤销提示。
- 右上角更多按钮：改为二级菜单，不再直接跳转设置。
- 底部导航：`设置` 改为 `我的`，设置功能收纳到我的页面。
- 主题增强：支持跟随系统 / 浅色 / 深色，同时支持薄荷绿、天空蓝、蓝紫、奶油橙、樱花粉、石墨灰主题色。
- 统计页圆环图修复：强制正圆 SVG，不再出现椭圆或异常缺口。
- 保留 V1-1 的 GitHub Pages、PWA、localStorage、JSON 导入导出、Shawn Tools 预留接口。

## 文件结构

```text
account-book-app/
├── index.html
├── README.md
├── manifest.json
├── service-worker.js
├── .nojekyll
├── assets/
│   ├── css/style.css
│   ├── js/app.js
│   ├── js/storage.js
│   ├── js/ui.js
│   ├── js/charts.js
│   └── icons/
│       ├── icon-192.png
│       └── icon-512.png
└── data/demo-data.json
```

## GitHub Pages 部署方法

1. 新建 GitHub 仓库。
2. 解压 zip 文件。
3. 进入 `account-book-app` 文件夹。
4. 把文件夹内的所有文件上传到 GitHub 仓库根目录。
5. 打开仓库 `Settings`。
6. 找到 `Pages`。
7. Source 选择 `Deploy from a branch`。
8. Branch 选择 `main / root`。
9. 保存后等待 GitHub Pages 生成访问网址。

注意：仓库根目录需要直接看到 `index.html`，不要只上传 zip，也不要让 `index.html` 留在二级目录。

## 数据说明

本工具默认使用浏览器 `localStorage` 保存数据，不依赖数据库服务器，不写入任何 API Key、GitHub Token 或 Google Token。

## Shawn Tools 预留接口

页面加载后会暴露：

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

## 建议测试项

- 首页新增记录。
- 最近记录左滑删除和撤销。
- 明细页搜索和筛选。
- 统计页分类圆环、支付方式排行和趋势图。
- 我的页面主题模式和主题色切换。
- JSON 导入导出。
- iPhone Safari 添加到主屏幕后打开。
