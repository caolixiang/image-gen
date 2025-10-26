# 开发指南

## 🚀 快速开始

### 本地开发（推荐方式）

使用 wrangler pages dev 在本地运行，完整模拟 Cloudflare Pages 环境：

```bash
# 安装依赖
pnpm install

# 启动开发服务器（包含 Functions 和 R2）
pnpm pages:dev
```

**访问**: http://localhost:5173

### 纯前端开发（不包含 R2 功能）

如果只想开发前端，不需要 R2 功能：

```bash
pnpm dev
```

## 📁 项目结构

```
image-gen/
├── functions/              # Cloudflare Pages Functions
│   └── api/
│       ├── save-image.ts      # 保存图片到 R2
│       ├── list-images.ts     # 列出 R2 图片
│       ├── delete-image.ts    # 删除 R2 图片
│       ├── proxy-image.ts     # 代理外部图片
│       └── r2-image/[[path]].ts # 从 R2 读取图片
├── src/                    # React 前端代码
│   ├── components/         # React 组件
│   ├── lib/               # 工具函数和 API
│   └── main.tsx           # 入口文件
├── public/                # 静态资源
├── wrangler.toml          # Cloudflare 配置
└── vite.config.ts         # Vite 配置
```

## 🔧 本地开发配置

### 方案 1: Wrangler Pages Dev（推荐）✅

**优点**：
- ✅ 完整模拟生产环境
- ✅ 自动绑定 R2
- ✅ 无需额外配置
- ✅ Functions 本地运行

**使用**：
```bash
pnpm pages:dev
```

### 方案 2: 使用 R2 API 令牌

如果需要使用纯 Vite 开发，参考 `LOCAL_DEV_SETUP.md`

## 🌐 部署到 Cloudflare Pages

### 首次部署

```bash
# 1. 构建项目
pnpm build

# 2. 部署到 Cloudflare Pages
pnpm pages:deploy
```

### 后续更新

```bash
# 构建并部署
pnpm pages:deploy
```

## 📦 Functions API 说明

### 保存图片
```
POST /api/save-image
Body: { "imageUrl": "https://..." }
Response: { "success": true, "url": "/api/r2-image/..." }
```

### 列出图片
```
GET /api/list-images?limit=50
Response: { "success": true, "images": [...] }
```

### 删除图片
```
POST /api/delete-image
Body: { "key": "generated/xxx.png" }
Response: { "success": true }
```

### 代理图片
```
GET /api/proxy-image?url=https://...
Response: Image binary data
```

### 读取 R2 图片
```
GET /api/r2-image/generated/xxx.png
Response: Image binary data
```

## 🔍 查看 Functions

### Cloudflare Dashboard

1. 登录: https://dash.cloudflare.com/
2. Workers & Pages → 选择 `image-gen`
3. Functions 标签页

### 本地查看

```bash
# 启动本地开发服务器
pnpm pages:dev

# Functions 会自动在以下路径可用:
# http://localhost:5173/api/*
```

## 🐛 调试

### 查看日志

**本地开发**:
- 查看终端输出
- 浏览器控制台

**生产环境**:
```bash
# 实时日志
wrangler pages deployment tail
```

### 常见问题

**Q: 本地开发时 R2 不可用？**  
A: 使用 `pnpm pages:dev` 而不是 `pnpm dev`

**Q: 图片保存失败？**  
A: 检查 wrangler.toml 中的 R2 binding 配置

**Q: Functions 没有运行？**  
A: 确保 `functions/` 目录中的文件格式正确

## 📝 环境变量

生产环境的敏感信息通过 Cloudflare Dashboard 配置，不需要在代码中硬编码。

本地开发使用 `wrangler pages dev` 时，会自动使用 wrangler.toml 中的配置。

## 🔒 安全注意事项

- ❌ 不要提交 `.env.local` 文件
- ❌ 不要在代码中硬编码密钥
- ✅ 使用 Cloudflare 的环境变量
- ✅ 使用 R2 bindings 而不是 API 令牌

