# AI Image & Video Studio

A modern React SPA for generating images, creating videos, and describing images using AI. Features advanced state management, seamless tab switching, and automatic progress recovery. Deployed on Cloudflare Pages with R2 storage.

## Features

### 🎨 **Image Generation**
- Generate stunning images from text descriptions
- Support for multiple AI models (Midjourney, nano-banana)
- Reference image support for style transfer
- Configurable aspect ratios and generation modes
- Automatic saving to R2 storage

### 🎬 **Video Generation**
- Text-to-video generation with advanced AI models
- Customizable aspect ratio (16:9, 9:16, 1:1)
- Duration control (5s, 10s, 15s)
- Remix functionality for iterating on generated videos
- Real-time progress tracking

### 🔍 **Image Description**
- Upload images to get detailed AI-generated descriptions
- Extract multiple prompt variations from a single image
- Perfect for reverse-engineering image styles

### 💾 **Smart Storage & State Management**
- Generated content automatically saved to Cloudflare R2
- **Zustand-powered state persistence**: Never lose your progress
- **Seamless tab switching**: Switch between Image, Video, and Describe without losing state
- **Auto-recovery**: Refresh the page and your generation continues where it left off
- **Polling recovery**: Resume progress tracking after browser close

### 🎨 **Modern UI/UX**
- Beautiful interface built with Radix UI and Tailwind CSS
- Hover-to-reveal action buttons on images/videos
- Modal preview for fullscreen viewing
- Delete confirmations for safe operations
- 🌙 Full dark mode support

### ⚡ **Performance**
- Built with Vite for optimal performance
- Smart polling mechanism with automatic cleanup
- Efficient state management with Zustand
- Minimal API calls with intelligent caching

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **State Management**: Zustand with persistence middleware
- **UI Components**: Radix UI + Tailwind CSS
- **Styling**: Tailwind CSS + CSS Variables
- **Deployment**: Cloudflare Pages
- **Storage**: Cloudflare R2 (Images & Videos)
- **Backend**: Cloudflare Pages Functions (Serverless)

## Prerequisites

- Node.js 18+
- pnpm (package manager)
- Cloudflare account with:
  - Pages enabled
  - R2 storage enabled

## Local Development

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Run Development Server

```bash
pnpm dev
```

The app will be available at `http://localhost:5173`

### 3. Test with Cloudflare Pages Locally (Optional)

```bash
pnpm pages:dev
```

## Deployment to Cloudflare Pages

### Step 1: Create R2 Bucket

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → R2
2. Create a new bucket named `image-gen-storage`
3. (Optional) Create a preview bucket `image-gen-storage-preview` for staging
4. Configure public access or set up a custom domain for your R2 bucket

### Step 2: Update R2 Public URL

Edit `functions/api/save-image.ts` and replace `YOUR_R2_PUBLIC_URL` with your actual R2 public domain:

```typescript
const publicUrl = `https://YOUR_R2_PUBLIC_URL/${key}`
```

Options for R2 public access:

- Use R2.dev subdomain (automatic)
- Set up custom domain in R2 settings
- Use Cloudflare Workers to serve from R2

### Step 3: Deploy via Git

#### Option A: GitHub Integration (Recommended)

1. Push your code to GitHub
2. Go to [Cloudflare Pages](https://dash.cloudflare.com/?to=/:account/pages)
3. Click "Create a project" → "Connect to Git"
4. Select your repository
5. Configure build settings:
   - **Build command**: `pnpm build`
   - **Build output directory**: `dist`
   - **Root directory**: `/` (leave empty)
6. Add R2 bindings:
   - Go to Settings → Functions → R2 bucket bindings
   - Variable name: `IMAGE_BUCKET`
   - R2 bucket: `image-gen-storage`
7. Click "Save and Deploy"

#### Option B: Direct Deployment via CLI

```bash
# Install Wrangler CLI
pnpm add -g wrangler

# Login to Cloudflare
wrangler login

# Deploy
pnpm pages:deploy
```

### Step 4: Configure R2 Bindings (if using CLI)

After first deployment, bind R2 bucket in the Cloudflare dashboard:

1. Go to your Pages project → Settings → Functions
2. Add R2 bucket binding:
   - Variable name: `IMAGE_BUCKET`
   - R2 bucket: `image-gen-storage`

### Step 5: Configure API Settings

Once deployed, open your app and:

1. Click the Settings icon in the top right
2. Enter your AI API credentials:
   - **Base URL**: Your AI image generation API endpoint (e.g., `https://api.example.com`)
   - **API Key**: Your API key for authentication

## Project Structure

```
image-gen/
├── src/
│   ├── components/           # React components
│   │   ├── ui/              # Radix UI components (40+ components)
│   │   ├── image-generator.tsx   # Image generation with polling recovery
│   │   ├── video-generator.tsx   # Video generation with remix
│   │   ├── image-describer.tsx   # Image-to-text description
│   │   ├── config-panel.tsx      # API configuration
│   │   └── theme-provider.tsx    # Dark mode support
│   ├── store/               # Zustand state management
│   │   ├── image-store.ts   # Image generator state & persistence
│   │   ├── video-store.ts   # Video generator state & persistence
│   │   └── describe-store.ts # Image describer state & persistence
│   ├── lib/                 # Utility functions & API clients
│   │   ├── api/
│   │   │   ├── image-generation.ts    # Image generation API
│   │   │   ├── video-generation.ts    # Video generation API
│   │   │   ├── image-description.ts   # Image description API
│   │   │   ├── image-storage.ts       # R2 image storage
│   │   │   └── video-storage.ts       # R2 video storage
│   │   ├── utils.ts         # General utilities
│   │   └── proxy-image.ts   # Image proxy for CORS
│   ├── hooks/               # Custom React hooks
│   │   ├── use-toast.ts     # Toast notifications
│   │   └── use-mobile.ts    # Mobile detection
│   ├── App.tsx              # Main app component with tabs
│   ├── main.tsx             # React entry point
│   └── index.css            # Global styles & CSS variables
├── functions/               # Cloudflare Pages Functions
│   ├── api/
│   │   ├── save-image.ts    # Save images to R2
│   │   ├── save-video.ts    # Save videos to R2
│   │   ├── list-images.ts   # List stored images
│   │   ├── list-videos.ts   # List stored videos
│   │   ├── delete-image.ts  # Delete images from R2
│   │   ├── delete-video.ts  # Delete videos from R2
│   │   └── proxy-image.ts   # Proxy external images (CORS)
│   └── types.d.ts           # TypeScript types for Functions
├── server/                  # Local development server
│   └── r2-dev-server.ts     # Mock R2 for local dev
├── public/                  # Static assets
├── dist/                    # Build output
├── index.html               # HTML entry point
├── vite.config.ts           # Vite configuration
├── wrangler.toml            # Cloudflare R2 bindings
├── components.json          # shadcn/ui configuration
├── tsconfig.json            # TypeScript configuration
└── package.json             # Dependencies & scripts
```

## API Integration

The app integrates with various AI APIs. Configure your API endpoint and key in the Settings panel.

### 🎨 Image Generation API

#### Midjourney (Recommended)

**Submit Task:**
```
POST {baseUrl}/mj/submit/imagine
Authorization: Bearer {apiKey}
Content-Type: application/json

{
  "botType": "MID_JOURNEY",  // or "NIJI_JOURNEY"
  "prompt": "a beautiful sunset --ar 16:9",
  "base64Array": [],  // optional reference images
  "accountFilter": {
    "modes": ["RELAX"],  // or ["FAST", "TURBO"]
    "remix": true
  }
}
```

**Response:**
```json
{
  "code": 1,
  "description": "Submit Success",
  "result": "task_id_here"
}
```

**Query Status:**
```
GET {baseUrl}/mj/task/{taskId}/fetch
Authorization: Bearer {apiKey}
```

**Response:**
```json
{
  "status": "SUCCESS",
  "progress": "100%",
  "imageUrl": "https://cdn.example.com/merged.png",
  "imageUrls": [
    { "url": "https://cdn.example.com/image1.png" },
    { "url": "https://cdn.example.com/image2.png" },
    { "url": "https://cdn.example.com/image3.png" },
    { "url": "https://cdn.example.com/image4.png" }
  ]
}
```

#### nano-banana (Alternative)

**Request:**
```
POST {baseUrl}/v1/images/generations
Authorization: Bearer {apiKey}
Content-Type: application/json

{
  "model": "gemini-2.5-flash-image",
  "prompt": "a beautiful sunset",
  "n": 1,
  "size": "1024x1024"
}
```

**Response:**
```json
{
  "data": [
    { "url": "https://example.com/image.png" }
  ]
}
```

### 🎬 Video Generation API

**Submit Task:**
```
POST {baseUrl}/v1/videos
Authorization: Bearer {apiKey}
Content-Type: application/json

{
  "model": "sora-2",
  "prompt": "a cat playing with a ball",
  "resolution": "720p",
  "aspect_ratio": "16:9"
}
```

**Response:**
```json
{
  "id": "sora-2:task_xxxxx",
  "status": "pending"
}
```

**Query Status:**
```
GET {baseUrl}/v1/videos/{taskId}
Authorization: Bearer {apiKey}
```

**Response:**
```json
{
  "id": "sora-2:task_xxxxx",
  "status": "completed",
  "progress": 100,
  "video_url": "https://example.com/video.mp4"
}
```

**Remix Video:**
```
POST {baseUrl}/v1/videos/{videoId}/remix
Authorization: Bearer {apiKey}
Content-Type: application/json

{
  "prompt": "make the cat's eyes red"
}
```

### 🔍 Image Description API

**Submit Task:**
```
POST {baseUrl}/mj/submit/describe
Authorization: Bearer {apiKey}
Content-Type: application/json

{
  "base64": "data:image/png;base64,iVBORw0KGgo..."
}
```

**Response:**
```json
{
  "code": 1,
  "description": "Submit Success",
  "result": "describe_task_id"
}
```

**Query Status:**
```
GET {baseUrl}/mj/task/{taskId}/fetch
Authorization: Bearer {apiKey}
```

**Response:**
```json
{
  "status": "SUCCESS",
  "prompt": "1️⃣ description one 2️⃣ description two 3️⃣ description three 4️⃣ description four"
}
```

## Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm preview` - Preview production build locally
- `pnpm lint` - Run ESLint
- `pnpm pages:deploy` - Deploy to Cloudflare Pages

## Environment Variables

No environment variables are required for the frontend. All configuration is done through the UI.

For Workers Functions, R2 bindings are configured in `wrangler.toml`.

## Key Features Explained

### 💾 State Persistence with Zustand

All your work is automatically saved to browser localStorage:

- **Image Generator**: Prompts, model settings, reference images, generated images
- **Video Generator**: Descriptions, aspect ratios, durations, generated videos  
- **Image Describer**: Descriptions (preview images are not serializable)

**Benefits:**
- Switch between tabs without losing progress
- Refresh the page and continue where you left off
- Close browser and reopen - your state is restored

### 🔄 Polling Recovery Mechanism

When generating images/videos/descriptions:

1. **Start generation** → Task submitted, `taskId` saved
2. **Switch tabs** → Polling pauses, state persists
3. **Switch back** → Polling automatically resumes!
4. **Refresh page** → State restored, polling resumes
5. **Close browser** → State saved, resume next time

**Technical Implementation:**
- Uses `setInterval` for polling (instead of `while` loops)
- Automatic cleanup on component unmount
- Auto-recovery on component remount
- Error retry (up to 3 times)

### 🎨 UI/UX Highlights

**Hover Actions:**
- Hover over images/videos to reveal Download, Remix (videos), Delete buttons
- Buttons arranged vertically in top-right corner
- Smooth opacity transitions

**Modal Previews:**
- Click any image/video for fullscreen preview
- Click outside or ESC to close
- Native video controls for playback

**Delete Confirmation:**
- Modal dialog confirms before deleting
- Prevents accidental deletions
- Shows warning icon

## Troubleshooting

### Images/Videos not saving to R2

1. Verify R2 bucket binding: `IMAGE_BUCKET` in Cloudflare dashboard
2. Check `wrangler.toml` has correct bucket name
3. Ensure R2 public URL is configured in `functions/api/save-image.ts`
4. Check browser console for R2 errors

### Polling not resuming after tab switch

1. Check browser console for "🔄 检测到未完成的任务" message
2. Verify `localStorage` has state: `localStorage.getItem('image-generator-storage')`
3. Clear localStorage if corrupted: `localStorage.clear()`

### State not persisting

1. Check if localStorage is enabled in browser
2. Verify no privacy extensions blocking localStorage
3. Check console for Zustand persist errors

### API calls failing

1. Verify API credentials in Settings panel
2. Check browser console for CORS errors
3. Ensure API endpoints match expected format (see API Integration)
4. Test API with curl/Postman first

### Build errors

1. Clear cache: `rm -rf node_modules dist pnpm-lock.yaml`
2. Reinstall: `pnpm install`
3. Check Node version: `node -v` (requires 18+)
4. Build: `pnpm build`

## License

MIT

## Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.
