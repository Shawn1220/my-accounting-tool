# Shawn 私人记账本 GitHub Pages

这是一个可以直接部署到 GitHub Pages 的私人记账本 Web App。项目使用原生 HTML、CSS、JavaScript 编写，不依赖外部 CDN、不需要后端服务器、不需要数据库服务器。

## 主要功能

- 首页月度支出、今日支出、预算进度
- 新增、编辑、复制、删除账单
- 最近删除 / 回收站恢复
- 常用模板管理
- 一句话记账解析与预览
- 全部明细搜索和筛选
- 分类占比、支付方式占比、最近 7 天趋势
- 浅色 / 深色 / 跟随系统
- 多主题色
- JSON 导入导出
- CSV 导出
- 导入前自动备份
- 手动本地备份与恢复
- PWA 添加到主屏幕
- Service Worker 基础缓存

## GitHub Pages 部署方法

1. 新建一个 GitHub 仓库。
2. 解压本项目压缩包。
3. 进入项目文件夹，把里面的所有文件上传到仓库根目录。
4. 打开仓库 Settings。
5. 找到 Pages。
6. Source 选择 Deploy from a branch。
7. Branch 选择 main，目录选择 /root。
8. 保存后等待 GitHub 生成访问网址。

仓库根目录应直接看到：

```text
index.html
README.md
manifest.json
service-worker.js
.nojekyll
assets/
data/
```

不要只上传 zip，也不要让 `index.html` 留在二级文件夹里。

## 数据保存

本工具默认使用浏览器 localStorage 保存数据。数据只保存在当前浏览器中，不会上传到服务器。

建议定期使用：

- 导出 JSON
- 导出 CSV
- 创建本地备份

更换手机、清理浏览器数据或更换浏览器前，请先导出 JSON 备份。

## 更新后仍显示旧页面

手机端 PWA 可能会缓存旧文件。可以在“我的 → 数据管理”中点击“清除缓存 / 更新”，也可以在访问网址后加一个查询参数，例如：

```text
?refresh=1
```

## 技术说明

- 原生 HTML + CSS + JavaScript
- CSS variables 管理主题
- prefers-color-scheme 支持跟随系统
- localStorage 保存数据
- SVG / CSS 绘制图表
- 所有资源均使用相对路径
- 不写入任何 API Key、GitHub Token 或 Google Token
