import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import type { Connect } from 'vite'
import { loadEnv } from 'vite'

// 创建 S3 客户端
function createS3Client() {
  // 使用 Vite 的 loadEnv 加载环境变量
  const env = loadEnv('development', process.cwd(), '')
  
  const accountId = env.VITE_R2_ACCOUNT_ID
  const accessKeyId = env.VITE_R2_ACCESS_KEY_ID
  const secretAccessKey = env.VITE_R2_SECRET_ACCESS_KEY

  console.log('[R2 Dev] Checking credentials:', {
    accountId: accountId ? `${accountId.substring(0, 8)}...` : 'MISSING',
    accessKeyId: accessKeyId ? `${accessKeyId.substring(0, 8)}...` : 'MISSING',
    secretAccessKey: secretAccessKey ? 'EXISTS' : 'MISSING',
  })

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('Missing R2 credentials. Please check your .env.local file.')
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  })
}

// 使用 Vite 的 loadEnv 加载环境变量
const env = loadEnv('development', process.cwd(), '')
const bucketName = env.VITE_R2_BUCKET_NAME || 'image-gen-storage'

// Vite 中间件：处理 R2 API 请求
export function r2DevMiddleware(): Connect.NextHandleFunction {
  return async (req, res, next) => {
    console.log(`[R2 Dev Server] Middleware called: ${req.method} ${req.url}`)
    
    // 只处理 /api/ 开头的请求
    if (!req.url?.startsWith('/api/')) {
      console.log(`[R2 Dev Server] Not an API request, passing to next middleware`)
      next()
      return
    }

    const url = new URL(req.url!, `http://${req.headers.host}`)
    console.log(`[R2 Dev Server] Handling API request: ${req.method} ${req.url}`)

    try {
      // 代理图片请求
      if (url.pathname === '/api/proxy-image' && req.method === 'GET') {
        const imageUrl = url.searchParams.get('url')
        if (!imageUrl) {
          res.statusCode = 400
          res.end('Missing url parameter')
          return
        }

        console.log(`[R2 Dev Server] Proxying image: ${imageUrl}`)

        try {
          const imageResponse = await fetch(imageUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Referer': 'https://www.midjourney.com/',
              'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9',
              'Accept-Encoding': 'gzip, deflate, br',
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache',
            },
          })

          if (!imageResponse.ok) {
            throw new Error(`Failed to fetch image: ${imageResponse.statusText}`)
          }

          const imageBuffer = await imageResponse.arrayBuffer()
          const contentType = imageResponse.headers.get('content-type') || 'image/png'

          res.setHeader('Content-Type', contentType)
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.end(Buffer.from(imageBuffer))
        } catch (error: any) {
          console.error(`[R2 Dev Server] Error proxying image:`, error)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({
            success: false,
            error: error.message,
          }))
        }
        return
      }

      // 列出图片
      if (url.pathname === '/api/list-images' && req.method === 'GET') {
        console.log('[R2 Dev Server] Listing images from remote R2')
        
        const s3Client = createS3Client()
        const limit = parseInt(url.searchParams.get('limit') || '100')
        const cursor = url.searchParams.get('cursor') || undefined

        // 同时列出 images/ 和 generated/ 前缀的图片
        const [imagesCommand, generatedCommand] = [
          new ListObjectsV2Command({
            Bucket: bucketName,
            Prefix: 'images/',
            MaxKeys: limit,
            ContinuationToken: cursor,
          }),
          new ListObjectsV2Command({
            Bucket: bucketName,
            Prefix: 'generated/',
            MaxKeys: limit,
            ContinuationToken: cursor,
          })
        ]

        const [imagesResponse, generatedResponse] = await Promise.all([
          s3Client.send(imagesCommand),
          s3Client.send(generatedCommand)
        ])

        const allObjects = [
          ...(imagesResponse.Contents || []),
          ...(generatedResponse.Contents || [])
        ]

        console.log(`[R2 Dev Server] Found ${allObjects.length} objects`)

        const images = allObjects.map((obj) => ({
          key: obj.Key!,
          url: `/api/r2-image/${obj.Key}`,
          uploaded: obj.LastModified?.toISOString() || new Date().toISOString(),
          size: obj.Size || 0,
        }))

        images.sort((a, b) => new Date(b.uploaded).getTime() - new Date(a.uploaded).getTime())

        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.end(JSON.stringify({
          success: true,
          images,
          truncated: imagesResponse.IsTruncated || generatedResponse.IsTruncated || false,
          cursor: imagesResponse.NextContinuationToken || generatedResponse.NextContinuationToken,
        }))
        return
      }

      // 获取图片
      if (url.pathname.startsWith('/api/r2-image/') && req.method === 'GET') {
        const key = url.pathname.replace('/api/r2-image/', '')
        console.log(`[R2 Dev Server] Getting image: ${key}`)
        
        const s3Client = createS3Client()
        const command = new GetObjectCommand({
          Bucket: bucketName,
          Key: key,
        })

        const response = await s3Client.send(command)

        if (!response.Body) {
          res.statusCode = 404
          res.end('Image not found')
          return
        }

        const chunks: Uint8Array[] = []
        for await (const chunk of response.Body as any) {
          chunks.push(chunk)
        }
        const imageData = Buffer.concat(chunks)

        res.setHeader('Content-Type', response.ContentType || 'image/png')
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.end(imageData)
        return
      }

      // 保存图片
      if (url.pathname === '/api/save-image' && req.method === 'POST') {
        console.log('[R2 Dev Server] Saving image to remote R2')
        
        // 等待完整的请求体
        const body = await new Promise<string>((resolve) => {
          let data = ''
          req.on('data', (chunk) => {
            data += chunk.toString()
          })
          req.on('end', () => {
            resolve(data)
          })
        })

        try {
          const data = JSON.parse(body)

          if (!data.imageUrl && !data.imageData) {
            res.statusCode = 400
            res.end('Missing imageUrl or imageData')
            return
          }

          let imageBlob: ArrayBuffer

          if (data.imageUrl) {
            // 检查是否是外部 URL，如果是则通过代理获取
            let fetchUrl = data.imageUrl
            if (!data.imageUrl.startsWith('/') && !data.imageUrl.startsWith('data:')) {
              // 外部 URL，通过代理获取
              fetchUrl = `http://localhost:5173/api/proxy-image?url=${encodeURIComponent(data.imageUrl)}`
            }
            
            const imageResponse = await fetch(fetchUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://discord.com/',
                'Accept': 'image/*',
              },
            })
            if (!imageResponse.ok) {
              throw new Error(`Failed to fetch image: ${imageResponse.statusText}`)
            }
            imageBlob = await imageResponse.arrayBuffer()
          } else {
            const base64Data = data.imageData.includes(',')
              ? data.imageData.split(',')[1]
              : data.imageData
            const binaryString = Buffer.from(base64Data, 'base64')
            imageBlob = binaryString.buffer
          }

          const timestamp = Date.now()
          const randomStr = Math.random().toString(36).substring(2, 15)
          const key = `images/${timestamp}-${randomStr}.png`

          const s3Client = createS3Client()
          await s3Client.send(
            new PutObjectCommand({
              Bucket: bucketName,
              Key: key,
              Body: new Uint8Array(imageBlob),
              ContentType: 'image/png',
            })
          )

          console.log(`[R2 Dev Server] Saved image: ${key}`)

          res.setHeader('Content-Type', 'application/json')
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.end(JSON.stringify({
            success: true,
            url: `/api/r2-image/${key}`,
            key,
          }))
        } catch (error: any) {
          console.error('[R2 Dev Server] Error saving image:', error)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({
            success: false,
            error: error.message,
          }))
        }
        return
      }

      // 删除图片
      if (url.pathname === '/api/delete-image' && req.method === 'POST') {
        // 等待完整的请求体
        const body = await new Promise<string>((resolve) => {
          let data = ''
          req.on('data', (chunk) => {
            data += chunk.toString()
          })
          req.on('end', () => {
            resolve(data)
          })
        })

        try {
          const data = JSON.parse(body)

          if (!data.key) {
            res.statusCode = 400
            res.end('Missing image key')
            return
          }

          console.log(`[R2 Dev Server] Deleting image: ${data.key}`)

          const s3Client = createS3Client()
          await s3Client.send(
            new DeleteObjectCommand({
              Bucket: bucketName,
              Key: data.key,
            })
          )

          res.setHeader('Content-Type', 'application/json')
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.end(JSON.stringify({
            success: true,
            message: 'Image deleted successfully',
            key: data.key,
          }))
        } catch (error: any) {
          console.error('[R2 Dev Server] Error deleting image:', error)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({
            success: false,
            error: error.message,
          }))
        }
        return
      }

      // 列出视频
      if (url.pathname === '/api/video/list-videos' && req.method === 'GET') {
        console.log('[R2 Dev Server] Listing videos from remote R2')
        
        const s3Client = createS3Client()
        const limit = parseInt(url.searchParams.get('limit') || '100')
        const cursor = url.searchParams.get('cursor') || undefined

        const command = new ListObjectsV2Command({
          Bucket: bucketName,
          Prefix: 'videos/',
          MaxKeys: limit,
          ContinuationToken: cursor,
        })

        const response = await s3Client.send(command)
        console.log(`[R2 Dev Server] Found ${response.Contents?.length || 0} videos`)

        const videos = (response.Contents || []).map((obj) => ({
          key: obj.Key!,
          url: `/api/video/r2-video/${obj.Key}`,
          uploaded: obj.LastModified?.toISOString() || new Date().toISOString(),
          size: obj.Size || 0,
          metadata: obj.Metadata,
        }))

        videos.sort((a, b) => new Date(b.uploaded).getTime() - new Date(a.uploaded).getTime())

        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.end(JSON.stringify({
          success: true,
          videos,
          truncated: response.IsTruncated || false,
          cursor: response.NextContinuationToken,
        }))
        return
      }

      // 获取视频
      if (url.pathname.startsWith('/api/video/r2-video/') && req.method === 'GET') {
        const key = url.pathname.replace('/api/video/r2-video/', '')
        console.log(`[R2 Dev Server] Getting video: ${key}`)
        
        const s3Client = createS3Client()
        const command = new GetObjectCommand({
          Bucket: bucketName,
          Key: key,
        })

        const response = await s3Client.send(command)

        if (!response.Body) {
          res.statusCode = 404
          res.end('Video not found')
          return
        }

        const chunks: Uint8Array[] = []
        for await (const chunk of response.Body as any) {
          chunks.push(chunk)
        }
        const videoData = Buffer.concat(chunks)

        res.setHeader('Content-Type', response.ContentType || 'video/mp4')
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Accept-Ranges', 'bytes')
        res.end(videoData)
        return
      }

      // 保存视频
      if (url.pathname === '/api/video/save-video' && req.method === 'POST') {
        console.log('[R2 Dev Server] Saving video to remote R2')
        
        // 等待完整的请求体
        const body = await new Promise<string>((resolve) => {
          let data = ''
          req.on('data', (chunk) => {
            data += chunk.toString()
          })
          req.on('end', () => {
            resolve(data)
          })
        })

        try {
          const data = JSON.parse(body)

          if (!data.videoUrl || !data.filename) {
            res.statusCode = 400
            res.end('Missing videoUrl or filename')
            return
          }

          // 检查是否已存在相同 taskId 的视频
          if (data.taskId) {
            const listCommand = new ListObjectsV2Command({
              Bucket: bucketName,
              Prefix: 'videos/'
            })
            const s3Client = createS3Client()
            const listResponse = await s3Client.send(listCommand)

            for (const obj of listResponse.Contents || []) {
              if (obj.Metadata?.taskId === data.taskId) {
                // 找到已存在的视频，直接返回
                res.setHeader('Content-Type', 'application/json')
                res.setHeader('Access-Control-Allow-Origin', '*')
                res.end(JSON.stringify({
                  key: obj.Key!,
                  url: `/api/video/r2-video/${obj.Key}`,
                  size: obj.Size || 0,
                  uploaded: obj.LastModified?.toISOString() || new Date().toISOString(),
                  alreadyExists: true
                }))
                return
              }
            }
          }

          // 下载视频
          const videoResponse = await fetch(data.videoUrl)
          if (!videoResponse.ok) {
            throw new Error(`Failed to fetch video: ${videoResponse.statusText}`)
          }
          const videoBlob = await videoResponse.arrayBuffer()

          const timestamp = Date.now()
          const key = `videos/${timestamp}-${data.filename}`

          const s3Client = createS3Client()
          await s3Client.send(
            new PutObjectCommand({
              Bucket: bucketName,
              Key: key,
              Body: new Uint8Array(videoBlob),
              ContentType: 'video/mp4',
              Metadata: {
                uploadedAt: new Date().toISOString(),
                originalUrl: data.videoUrl,
                taskId: data.taskId || ''
              }
            })
          )

          console.log(`[R2 Dev Server] Saved video: ${key}`)

          res.setHeader('Content-Type', 'application/json')
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.end(JSON.stringify({
            key,
            url: `/api/video/r2-video/${key}`,
            size: videoBlob.byteLength,
            uploaded: new Date().toISOString(),
            alreadyExists: false
          }))
        } catch (error: any) {
          console.error('[R2 Dev Server] Error saving video:', error)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({
            success: false,
            error: error.message,
          }))
        }
        return
      }

      // 删除视频
      if (url.pathname === '/api/video/delete-video' && req.method === 'POST') {
        // 等待完整的请求体
        const body = await new Promise<string>((resolve) => {
          let data = ''
          req.on('data', (chunk) => {
            data += chunk.toString()
          })
          req.on('end', () => {
            resolve(data)
          })
        })

        try {
          const data = JSON.parse(body)

          if (!data.key) {
            res.statusCode = 400
            res.end('Missing video key')
            return
          }

          console.log(`[R2 Dev Server] Deleting video: ${data.key}`)

          const s3Client = createS3Client()
          await s3Client.send(
            new DeleteObjectCommand({
              Bucket: bucketName,
              Key: data.key,
            })
          )

          res.setHeader('Content-Type', 'application/json')
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.end(JSON.stringify({
            success: true,
            message: 'Video deleted successfully',
            key: data.key,
          }))
        } catch (error: any) {
          console.error('[R2 Dev Server] Error deleting video:', error)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({
            success: false,
            error: error.message,
          }))
        }
        return
      }

      // CORS 预检
      if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
        res.statusCode = 204
        res.end()
        return
      }

    } catch (error) {
      console.error('[R2 Dev Server] Error:', error)
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }))
      return
    }

    next()
  }
}

