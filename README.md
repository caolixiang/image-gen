# AI Image Studio

A modern React SPA for generating and describing images using AI, deployed on Cloudflare Pages with R2 storage.

## Features

- 🎨 **Image Generation**: Generate stunning images from text descriptions using various AI models
- 🔍 **Image Description**: Upload images to get detailed AI-generated descriptions
- 💾 **R2 Storage**: Generated images are automatically saved to Cloudflare R2 for persistence
- 🎨 **Modern UI**: Beautiful interface built with Radix UI and Tailwind CSS
- 🌙 **Dark Mode**: Full dark mode support
- ⚡ **Fast**: Built with Vite for optimal performance

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **UI Components**: Radix UI + Tailwind CSS
- **Deployment**: Cloudflare Pages
- **Storage**: Cloudflare R2
- **Backend**: Cloudflare Workers Functions

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
│   ├── components/        # React components
│   │   ├── ui/           # Radix UI components
│   │   ├── image-generator.tsx
│   │   ├── image-describer.tsx
│   │   └── config-panel.tsx
│   ├── lib/              # Utility functions
│   ├── hooks/            # Custom React hooks
│   ├── App.tsx           # Main app component
│   ├── main.tsx          # React entry point
│   └── index.css         # Global styles
├── functions/
│   └── api/
│       └── save-image.ts # Cloudflare Worker for R2 storage
├── public/               # Static assets
├── index.html            # HTML entry point
├── vite.config.ts        # Vite configuration
├── wrangler.toml         # Cloudflare configuration
└── package.json
```

## API Integration

The app expects your AI API to follow these conventions:

### Image Generation Endpoint

**Request:**

```json
POST {baseUrl}/generate
Headers: Authorization: Bearer {apiKey}
Body: {
  "prompt": "Your image description",
  "model": "stable-diffusion-xl",
  "reference_images": ["base64_image_data"]
}
```

**Response:**

```json
{
  "images": ["https://url-to-image.png"],
  // or
  "image_url": "https://url-to-image.png",
  // or
  "url": "https://url-to-image.png",
  // or
  "image": "https://url-to-image.png"
}
```

### Image Description Endpoint

**Request:**

```json
POST {baseUrl}/describe
Headers: Authorization: Bearer {apiKey}
Body: {
  "image": "base64_image_data"
}
```

**Response:**

```json
{
  "description": "Detailed image description",
  // or
  "prompt": "Image description",
  // or
  "text": "Image description"
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

## Troubleshooting

### Images not saving to R2

1. Verify R2 bucket binding is configured correctly in Cloudflare dashboard
2. Check that `IMAGE_BUCKET` variable name matches in `wrangler.toml` and `save-image.ts`
3. Ensure R2 public URL is configured correctly

### API calls failing

1. Verify your API credentials in the settings panel
2. Check browser console for CORS errors
3. Ensure your AI API endpoints match the expected format

### Build errors

1. Clear node_modules and reinstall: `rm -rf node_modules pnpm-lock.yaml && pnpm install`
2. Ensure you're using Node.js 18+
3. Check TypeScript errors: `pnpm build`

## License

MIT

## Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.
