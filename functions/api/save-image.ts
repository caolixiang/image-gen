// Cloudflare Pages Function - 直接使用 R2 Bucket API

interface Env {
  IMAGE_BUCKET: R2Bucket
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context
    const contentType = request.headers.get("content-type")

    if (!contentType?.includes("application/json")) {
      return new Response("Content-Type must be application/json", {
        status: 400,
      })
    }

    const body = (await request.json()) as {
      imageUrl?: string
      imageData?: string
      taskId?: string
    }

    if (!body.imageUrl && !body.imageData) {
      return new Response("Missing imageUrl or imageData", { status: 400 })
    }

    // 如果提供了 imageUrl，检查是否已存在相同的图片
    if (body.imageUrl) {
      const listed = await env.IMAGE_BUCKET.list({
        prefix: 'images/'
      })

      // 查找是否有相同 imageUrl 的图片
      for (const obj of listed.objects) {
        if (obj.customMetadata?.originalUrl === body.imageUrl) {
          // 找到已存在的图片，直接返回
          const publicUrl = `/api/r2-image/${obj.key}`
          
          return new Response(JSON.stringify({
            key: obj.key,
            url: publicUrl,
            size: obj.size,
            uploaded: obj.uploaded.toISOString(),
            alreadyExists: true
          }), {
            status: 200,
            headers: { 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          })
        }
      }
    }

    let imageBlob: ArrayBuffer

    // Download image from URL or decode base64
    if (body.imageUrl) {
      // 检查是否是外部 URL，如果是则通过代理获取
      let fetchUrl = body.imageUrl
      if (!body.imageUrl.startsWith('/') && !body.imageUrl.startsWith('data:')) {
        // 外部 URL，通过代理获取
        // 在生产环境中，需要构建完整的代理 URL
        const baseUrl = new URL(request.url).origin
        fetchUrl = `${baseUrl}/api/proxy-image?url=${encodeURIComponent(body.imageUrl)}`
      }
      
      const imageResponse = await fetch(fetchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://www.midjourney.com/',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
        },
      })
      if (!imageResponse.ok) {
        return new Response(`Failed to fetch image from URL: ${imageResponse.status} ${imageResponse.statusText}`, { status: 500 })
      }
      imageBlob = await imageResponse.arrayBuffer()
    } else if (body.imageData) {
      // Handle base64 data
      const base64Data = body.imageData.includes(",")
        ? body.imageData.split(",")[1]
        : body.imageData

      const binaryString = atob(base64Data)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      imageBlob = bytes.buffer
    } else {
      return new Response("Invalid image data", { status: 400 })
    }

    // Generate unique key for R2
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 15)
    const key = `images/${timestamp}-${randomStr}.png`

    // Upload to R2 using Cloudflare R2 Bucket API
    await env.IMAGE_BUCKET.put(key, imageBlob, {
      httpMetadata: {
        contentType: "image/png",
      },
      customMetadata: {
        uploadedAt: new Date().toISOString(),
        originalUrl: body.imageUrl || '',
        taskId: body.taskId || ''
      }
    })

    // 返回 R2 对象的访问路径
    // 使用 Cloudflare Pages 的 R2 绑定可以直接通过 API 访问
    const publicUrl = `/api/r2-image/${key}`

    return new Response(
      JSON.stringify({
        success: true,
        url: publicUrl,
        key: key,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    )
  } catch (error) {
    console.error("Error saving image to R2:", error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    )
  }
}
