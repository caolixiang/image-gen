# Quick Start Guide

Get your AI Image Studio up and running in 5 minutes!

## 🚀 Local Development

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Start Development Server

```bash
pnpm dev
```

The app will be available at **http://localhost:5173**

### 3. Configure API

1. Click the **Settings** icon (⚙️) in the top right corner
2. Enter your AI API details:
   - **Base URL**: Your AI image generation API endpoint
   - **API Key**: Your authentication key

### 4. Generate Your First Image

1. Go to the **Generate Image** tab
2. Select a model (e.g., Stable Diffusion XL)
3. Enter a prompt: `A serene mountain landscape at sunset`
4. Click **Generate Image**

## 📦 Build for Production

```bash
pnpm build
```

The build output will be in the `dist/` directory.

### Preview Production Build

```bash
pnpm preview
```

## ☁️ Deploy to Cloudflare Pages

### Quick Deploy (Git Method)

1. Push your code to GitHub
2. Go to [Cloudflare Pages](https://dash.cloudflare.com)
3. Click **Create a project** → **Connect to Git**
4. Select your repository
5. Use these settings:
   - Build command: `pnpm build`
   - Build output directory: `dist`
6. Click **Save and Deploy**

### Configure R2 Storage

After deployment:

1. Create an R2 bucket named `image-gen-storage` in Cloudflare Dashboard
2. Enable public access on the bucket
3. In your Pages project: **Settings** → **Functions** → **R2 bucket bindings**
   - Variable name: `IMAGE_BUCKET`
   - R2 bucket: `image-gen-storage`
4. Update `functions/api/save-image.ts` with your R2 public URL
5. Redeploy

For detailed instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md)

## 🛠️ Development Commands

| Command             | Description                        |
| ------------------- | ---------------------------------- |
| `pnpm dev`          | Start development server           |
| `pnpm build`        | Build for production               |
| `pnpm preview`      | Preview production build           |
| `pnpm lint`         | Run linter                         |
| `pnpm pages:deploy` | Deploy to Cloudflare Pages via CLI |

## 📁 Project Structure

```
image-gen/
├── src/                    # Source code
│   ├── components/         # React components
│   ├── App.tsx            # Main app component
│   └── main.tsx           # Entry point
├── functions/             # Cloudflare Workers
│   └── api/
│       └── save-image.ts  # R2 storage handler
├── public/                # Static assets
└── dist/                  # Build output (after build)
```

## 🔧 Configuration

### Frontend Configuration

All frontend configuration is done through the UI. No environment variables needed!

### R2 Configuration

R2 bucket bindings are configured in:

- Local: `wrangler.toml`
- Production: Cloudflare Pages dashboard

## 🆘 Troubleshooting

### Development server not starting

```bash
rm -rf node_modules pnpm-lock.yaml
pnpm install
pnpm dev
```

### Build errors

```bash
pnpm build
# Check console for specific errors
```

### Images not saving to R2

- Verify R2 bucket binding is configured
- Check `functions/api/save-image.ts` has correct R2 URL
- Ensure R2 public access is enabled

## 📚 Learn More

- [Full Documentation](./README.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)

## 🎉 Next Steps

- [ ] Customize the UI theme in `src/index.css`
- [ ] Add your branding to the header
- [ ] Configure custom domain for deployment
- [ ] Set up R2 custom domain for image hosting
- [ ] Add analytics tracking

Happy building! 🚀
