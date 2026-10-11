# home · 起点

一个简洁的个人浏览器主页，使用原生 HTML、CSS、JavaScript 和 Vite 构建。保留时间、网页搜索、常用入口与外观设置，数据保存在当前浏览器。

## 直接导入阿里云 ESA Pages

项目采用阿里云官方 [pages/vite-react](https://github.com/aliyun/alibabacloud-esa-er-templates/tree/master/pages/vite-react) 示例的 Vite 构建形式和 `esa.jsonc` 静态资源配置，前端使用原生 JavaScript。

在 ESA 控制台进入 **函数和 Pages → 创建项目 → 导入 GitHub 仓库**，选择 `2428424081cn/home`。授权仓库后，按下表导入：

| 配置 | 值 |
| --- | --- |
| 生产分支 | `main` |
| 根目录 | `/`（仓库根目录） |
| 框架预设 | `Vite`，或按下面命令配置 |
| 安装命令 | `npm ci` |
| 构建命令 | `npm run build` |
| 静态资源目录 | `./dist` |
| Node.js | `22`，使用 22.12 及以上版本 |
| 函数文件路径 | 留空 |
| 环境变量 | 留空 |

根目录 `esa.jsonc` 已声明安装命令、构建命令和静态目录，平台会自动读取相应设置。GitHub 导入后，提交到 `main` 会触发生产构建。部署成功后可绑定 `start.你的域名` 等自定义域名。

当前官方公共预览域名需携带访问 token；长期使用请绑定自定义域名，配置 HTTPS 后将它设为浏览器启动页。

参考：[ESA 构建配置](https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/build-pages)、[GitHub 导入](https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/connect-pages-to-github)。

## 本地开发与检查

安装 Node.js 22.12+：

```sh
npm ci
npm run dev
```

```sh
npm test
npm run build
npm run preview
```

`dist` 是构建产物，由 ESA 构建生成；`package-lock.json` 随源码提交，用于固定安装结果。

## 使用

- 搜索引擎支持 Google、Bing、百度；输入关键词或 HTTP/HTTPS 网址，按 Enter 打开。
- `/` 聚焦搜索；Esc 关闭菜单和对话框。
- 点击添加入口创建快捷方式，点击入口上的 `⋯` 编辑或删除。
- 点击右上角或右下角自定义按钮，选择晨雾、暖纸、夜色外观。
- 主题、引擎和快捷方式保存在 `localStorage`，按浏览器和站点来源分别保存。换设备、浏览器或域名后需重新设置。

页面运行无需服务端程序、数据库、账号或接口密钥。访问搜索引擎和外部网站需要网络。替换浏览器的每个新标签页可后续打包为浏览器扩展。

## 目录

```text
index.html             页面入口
src/app.js             页面交互
src/core.js            搜索、网址和本地数据处理
src/styles.css         样式与响应式布局
public/favicon.svg     站点图标
tests/core.test.js     核心行为检查
esa.jsonc              ESA Pages 部署配置
package.json           构建脚本
package-lock.json      依赖锁定
design/                原始视觉稿与设计说明
```
