# Cloudflare Pages Deployment Guide

This guide provides step-by-step instructions for deploying the AI Image Studio to Cloudflare Pages with R2 storage.

## Prerequisites

Before you begin, ensure you have:

- [x] A Cloudflare account ([Sign up here](https://dash.cloudflare.com/sign-up))
- [x] R2 enabled on your account (available on all plans including Free)
- [x] Git repository with your code (GitHub, GitLab, or Bitbucket)
- [x] Node.js 18+ and pnpm installed locally

## Part 1: Set Up R2 Storage

### 1.1 Create R2 Bucket

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **R2 Object Storage** in the sidebar
3. Click **Create bucket**
4. Enter bucket name: `image-gen-storage`
5. Choose your preferred location
6. Click **Create bucket**

### 1.2 Configure R2 Public Access

You have three options for serving images publicly:

#### Option A: R2.dev Domain (Easiest)

1. In your bucket settings, click **Settings**
2. Scroll to **Public access**
3. Click **Allow Access** to enable the R2.dev domain
4. Copy the public URL (e.g., `https://pub-xxxxx.r2.dev`)

#### Option B: Custom Domain (Recommended for Production)

1. In bucket settings, go to **Settings** → **Custom Domains**
2. Click **Connect Domain**
3. Enter your domain (e.g., `images.yourdomain.com`)
4. Follow DNS setup instructions
5. Wait for SSL certificate provisioning

#### Option C: Cloudflare Worker Proxy

Create a Worker to proxy R2 content with custom logic (see [Cloudflare R2 docs](https://developers.cloudflare.com/r2/)).

### 1.3 Update Your Code

Edit `functions/api/save-image.ts` line 54:

```typescript
// Replace YOUR_R2_PUBLIC_URL with your actual URL from step 1.2
const publicUrl = `https://YOUR_R2_PUBLIC_URL/${key}`
```

For example:

```typescript
const publicUrl = `https://pub-abc123.r2.dev/${key}`
// or
const publicUrl = `https://images.yourdomain.com/${key}`
```

Commit and push this change:

```bash
git add functions/api/save-image.ts
git commit -m "Configure R2 public URL"
git push
```

## Part 2: Deploy to Cloudflare Pages

### Method 1: Git Integration (Recommended)

#### 2.1 Connect Repository

1. Go to [Cloudflare Pages](https://dash.cloudflare.com/?to=/:account/pages)
2. Click **Create a project**
3. Click **Connect to Git**
4. Authorize Cloudflare to access your Git provider
5. Select the `image-gen` repository

#### 2.2 Configure Build Settings

Set the following build configuration:

```
Framework preset: None
Build command: pnpm build
Build output directory: dist
Root directory: (leave empty)
```

#### 2.3 Environment Variables (Optional)

No environment variables are needed for basic setup. The app uses user-provided API keys.

#### 2.4 Deploy

1. Click **Save and Deploy**
2. Wait for the build to complete (usually 2-3 minutes)
3. Your site will be available at `https://image-gen-xxx.pages.dev`

### Method 2: CLI Deployment (Alternative)

#### 2.1 Install Wrangler

```bash
pnpm add -g wrangler
```

#### 2.2 Authenticate

```bash
wrangler login
```

This opens a browser window to authorize Wrangler.

#### 2.3 Build the Project

```bash
pnpm build
```

#### 2.4 Deploy

```bash
wrangler pages deploy dist --project-name=image-gen
```

## Part 3: Configure R2 Bindings

After your first deployment, you need to bind the R2 bucket to your Pages project.

### 3.1 Add R2 Binding via Dashboard

1. In Cloudflare Dashboard, go to **Workers & Pages**
2. Select your `image-gen` project
3. Go to **Settings** → **Functions**
4. Scroll to **R2 bucket bindings**
5. Click **Add binding**
6. Configure:
   - **Variable name**: `IMAGE_BUCKET` (must match code)
   - **R2 bucket**: Select `image-gen-storage`
   - **Environment**: Production
7. Click **Save**

### 3.2 Add Preview Binding (Optional)

For preview deployments:

1. In R2 bucket bindings, click **Add binding** again
2. Configure:
   - **Variable name**: `IMAGE_BUCKET`
   - **R2 bucket**: `image-gen-storage-preview` (create if needed)
   - **Environment**: Preview
3. Click **Save**

### 3.3 Redeploy

After adding bindings, redeploy your site:

**Git method**: Push a new commit or use "Retry deployment" in dashboard

**CLI method**:

```bash
pnpm build && wrangler pages deploy dist
```

## Part 4: Configure Custom Domain (Optional)

### 4.1 Add Custom Domain

1. In your Pages project, go to **Custom domains**
2. Click **Set up a custom domain**
3. Enter your domain (e.g., `app.yourdomain.com`)
4. Follow the DNS setup instructions

### 4.2 DNS Configuration

Add a CNAME record to your DNS:

```
Type: CNAME
Name: app (or your subdomain)
Content: image-gen-xxx.pages.dev
Proxy status: Proxied (orange cloud)
```

### 4.3 SSL Certificate

Cloudflare automatically provisions an SSL certificate. This usually takes 5-15 minutes.

## Part 5: Verify Deployment

### 5.1 Test Basic Functionality

1. Visit your deployment URL
2. Click the **Settings** icon (top right)
3. Enter test API credentials:
   - Base URL: Your AI API endpoint
   - API Key: Your API key
4. Try generating an image

### 5.2 Test R2 Storage

1. Generate an image successfully
2. Check browser Network tab for `/api/save-image` request
3. Verify the response contains an R2 URL
4. Open the R2 URL directly in a new tab to confirm image is accessible

### 5.3 Common Issues

**R2 binding not working:**

- Check binding variable name is exactly `IMAGE_BUCKET`
- Verify bucket exists and has correct name
- Redeploy after adding binding

**Images not loading:**

- Verify R2 public URL is correctly configured in code
- Check R2 public access is enabled
- Look for CORS errors in browser console

**Build failures:**

- Check build logs in Cloudflare dashboard
- Verify `package.json` scripts are correct
- Ensure pnpm-lock.yaml is committed

## Part 6: Monitoring & Maintenance

### 6.1 View Analytics

1. In Pages project dashboard, view:
   - **Analytics**: Traffic, requests, bandwidth
   - **Functions**: Function invocations, errors
2. In R2 dashboard:
   - Storage usage
   - Request metrics

### 6.2 Update Deployment

To deploy updates:

**Git method:**

```bash
git add .
git commit -m "Your update message"
git push
```

Cloudflare automatically rebuilds and deploys.

**CLI method:**

```bash
pnpm build
wrangler pages deploy dist
```

### 6.3 Rollback

To rollback to a previous deployment:

1. In Pages dashboard, go to **Deployments**
2. Find the working deployment
3. Click **...** → **Rollback to this deployment**

## Troubleshooting

### Build Errors

```bash
# Clear cache and rebuild
rm -rf node_modules dist
pnpm install
pnpm build
```

### R2 Access Denied

- Verify R2 binding is configured
- Check IAM permissions in Cloudflare dashboard
- Ensure bucket name matches exactly

### CORS Issues

If calling external APIs:

- Check API provider allows your domain
- Verify API credentials are correct
- Look for CORS errors in browser console

## Next Steps

- [ ] Set up custom domain for your app
- [ ] Configure custom domain for R2 bucket
- [ ] Set up monitoring and alerts
- [ ] Configure analytics tracking
- [ ] Implement rate limiting (if needed)
- [ ] Set up staging environment

## Resources

- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/)

## Support

For issues specific to Cloudflare services:

- [Cloudflare Community](https://community.cloudflare.com/)
- [Cloudflare Discord](https://discord.gg/cloudflaredev)

For issues with this app:

- Open an issue in the GitHub repository
