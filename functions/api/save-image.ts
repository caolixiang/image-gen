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
    }

    if (!body.imageUrl && !body.imageData) {
      return new Response("Missing imageUrl or imageData", { status: 400 })
    }

    let imageBlob: ArrayBuffer

    // Download image from URL or decode base64
    if (body.imageUrl) {
      const imageResponse = await fetch(body.imageUrl, {
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
    const key = `generated/${timestamp}-${randomStr}.png`

    // Upload to R2 using Cloudflare R2 Bucket API
    await env.IMAGE_BUCKET.put(key, imageBlob, {
      httpMetadata: {
        contentType: "image/png",
      },
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
