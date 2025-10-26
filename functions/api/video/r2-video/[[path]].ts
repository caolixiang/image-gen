// Cloudflare Pages Function - 提供 R2 中的视频流
interface Env {
  IMAGE_BUCKET: R2Bucket
}

export const onRequestGet = async (context: { env: Env; request: Request; params: { path?: string[] } }) => {
  try {
    const { env, params } = context
    
    // 获取视频路径（从 URL 参数中）
    const path = params.path ? params.path.join('/') : ''
    
    if (!path) {
      return new Response('Missing video path', { status: 400 })
    }

    // 从 R2 获取视频
    const object = await env.IMAGE_BUCKET.get(path)
    
    if (!object) {
      return new Response('Video not found', { status: 404 })
    }

    // 返回视频
    const headers = new Headers()
    object.writeHttpMetadata(headers)
    headers.set('Cache-Control', 'public, max-age=31536000, immutable')
    headers.set('Access-Control-Allow-Origin', '*')
    headers.set('Accept-Ranges', 'bytes')
    
    return new Response(object.body, {
      headers,
    })
  } catch (error) {
    console.error('Error fetching video from R2:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )
  }
}

// 处理 OPTIONS 请求（CORS 预检）
export const onRequestOptions = async () => {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Range',
    },
  })
}
