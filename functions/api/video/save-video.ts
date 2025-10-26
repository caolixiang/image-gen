// Cloudflare Pages Function - 保存视频到 R2
interface Env {
  IMAGE_BUCKET: R2Bucket
}

export const onRequestPost = async (context: { env: Env; request: Request }) => {
  try {
    const { request, env } = context
    const contentType = request.headers.get("content-type")

    if (!contentType?.includes("application/json")) {
      return new Response("Content-Type must be application/json", {
        status: 400,
      })
    }

    const body = (await request.json()) as {
      videoUrl?: string
      filename?: string
      taskId?: string
    }

    if (!body.videoUrl || !body.filename) {
      return new Response("Missing videoUrl or filename", { status: 400 })
    }

    // 如果提供了 taskId，检查是否已存在相同任务的视频
    if (body.taskId) {
      const listed = await env.IMAGE_BUCKET.list({
        prefix: 'videos/'
      })

      // 查找是否有相同 taskId 的视频
      for (const obj of listed.objects) {
        if (obj.customMetadata?.taskId === body.taskId) {
          // 找到已存在的视频，直接返回
          const publicUrl = `/api/video/r2-video/${obj.key}`
          
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

    // 不存在，继续下载和上传
    const videoResponse = await fetch(body.videoUrl)
    if (!videoResponse.ok) {
      return new Response(JSON.stringify({ error: 'Failed to fetch video' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const videoBlob = await videoResponse.arrayBuffer()
    
    // 生成唯一的 key
    const timestamp = Date.now()
    const key = `videos/${timestamp}-${body.filename}`

    // 上传到 R2
    await env.IMAGE_BUCKET.put(key, videoBlob, {
      httpMetadata: {
        contentType: 'video/mp4'
      },
      customMetadata: {
        uploadedAt: new Date().toISOString(),
        originalUrl: body.videoUrl,
        taskId: body.taskId || ''
      }
    })

    // 返回视频 URL
    const publicUrl = `/api/video/r2-video/${key}`

    return new Response(JSON.stringify({
      key,
      url: publicUrl,
      size: videoBlob.byteLength,
      uploaded: new Date().toISOString(),
      alreadyExists: false
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  } catch (error) {
    console.error('Error uploading video:', error)
    return new Response(JSON.stringify({ 
      error: 'Upload failed', 
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }
}

// 处理 OPTIONS 请求 (CORS preflight)
export const onRequestOptions = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    }
  })
}
