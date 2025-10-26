# Quick Start Guide

Get your AI Image & Video Studio up and running in 5 minutes!

Generate images, create videos, and describe images with AI - all with automatic state persistence and polling recovery.

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
2. Choose your API provider and enter credentials:
   - **Provider**: Select from Midjourney, tuzi (Sora), nano-banana
   - **Base URL**: Your AI API endpoint
   - **API Key**: Your authentication key

### 4. Try Different Features

#### 🎨 Generate Images
1. Go to the **Generate Image** tab
2. Select service type (Midjourney recommended)
3. Enter a prompt: `A serene mountain landscape at sunset`
4. Configure settings (model, aspect ratio, mode)
5. Click **Generate Image**
6. Watch real-time progress tracking
7. Images automatically save to R2 storage

#### 🎬 Generate Videos  
1. Go to the **Generate Video** tab
2. Enter a description: `A cat playing with a red ball`
3. Choose aspect ratio: `16:9`, `9:16`, or `1:1`
4. Select duration: `5s`, `10s`, or `15s`
5. Click **Generate Video**
6. Video saves automatically after generation
7. Use **Remix** to iterate on generated videos

#### 🔍 Describe Images
1. Go to the **Describe Image** tab
2. Upload an image (click or drag & drop)
3. Click **Analyze Image**
4. Get 4 AI-generated prompt variations
5. Copy any description for use in image generation

### 5. Test State Persistence

Try these to see the magic:

1. **Tab Switching**: Start generating → switch to another tab → switch back
   - ✅ Progress continues where you left off
   
2. **Page Refresh**: Start generating → refresh page (F5)
   - ✅ Generation resumes automatically
   
3. **Browser Close**: Start generating → close browser → reopen
   - ✅ State is restored, can continue

### 6. Explore UI Features

- **Hover on images/videos**: Reveals action buttons (Download, Remix, Delete)
- **Click images/videos**: Opens fullscreen preview modal
- **Delete confirmation**: Prevents accidental deletions
- **Dark mode**: Toggle in top-right corner

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
├── src/
│   ├── components/
│   │   ├── ui/                   # 40+ Radix UI components
│   │   ├── image-generator.tsx   # Image generation
│   │   ├── video-generator.tsx   # Video generation
│   │   └── image-describer.tsx   # Image description
│   ├── store/                    # Zustand state management
│   │   ├── image-store.ts        # Image state + persistence
│   │   ├── video-store.ts        # Video state + persistence
│   │   └── describe-store.ts     # Describe state + persistence
│   ├── lib/api/                  # API clients
│   └── App.tsx                   # Main app with tabs
├── functions/api/                # Cloudflare Pages Functions
│   ├── save-image.ts             # Save images to R2
│   ├── save-video.ts             # Save videos to R2
│   ├── list-images.ts            # List stored images
│   ├── list-videos.ts            # List stored videos
│   └── proxy-image.ts            # CORS proxy
├── server/
│   └── r2-dev-server.ts          # Local R2 mock
└── dist/                         # Build output
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

### Port 5173 already in use

The dev server will automatically try another port (e.g., 5174). Check the terminal output for the correct URL.

### Build errors

```bash
pnpm build
# Check console for specific errors
```

### Images/Videos not saving to R2

**Local Development:**
- R2 is mocked locally using `server/r2-dev-server.ts`
- Files save to local memory (lost on restart)
- Check console for R2 API logs

**Production:**
- Verify R2 bucket binding is configured
- Check `functions/api/save-image.ts` has correct R2 URL
- Ensure R2 public access is enabled

### State not persisting

```javascript
// Check localStorage in browser console
localStorage.getItem('image-generator-storage')
localStorage.getItem('video-generator-storage')
localStorage.getItem('image-describer-storage')

// Clear if corrupted
localStorage.clear()
```

### Polling not resuming

Look for console logs:
- `🔄 检测到未完成的任务，恢复轮询`
- `🎬 开始轮询...`

If missing, check:
1. `taskId` exists in state
2. `loading` or `isGenerating` is `true`
3. No errors in console

## 📚 Learn More

- [Full Documentation](./README.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)

## 🎉 Next Steps

- [ ] Explore all three features (Image, Video, Describe)
- [ ] Test state persistence by refreshing/closing browser
- [ ] Try the Remix feature for videos
- [ ] Customize the UI theme in `src/index.css`
- [ ] Add your branding to the header
- [ ] Configure custom domain for deployment
- [ ] Set up R2 custom domain for asset hosting
- [ ] Add analytics tracking

## ✨ Pro Tips

1. **Use Describe to improve prompts**: Upload an image you like → get AI descriptions → use in image generation
2. **Remix workflow**: Generate video → Remix with variations → Find the perfect result
3. **Reference images**: Upload style references in Image Generator for consistent aesthetics
4. **State management**: Your work auto-saves, so experiment freely!
5. **Keyboard shortcuts**: ESC closes modals, Click outside closes dialogs

Happy building! 🚀
