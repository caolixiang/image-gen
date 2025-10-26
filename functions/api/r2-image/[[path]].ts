// Cloudflare Pages Function - 直接使用 R2 Bucket API

interface Env {
  IMAGE_BUCKET: R2Bucket
}

export const onRequestGet = async (context: { env: Env; request: Request; params: { path?: string[] } }) => {
  try {
    const { env, params } = context
    
    // 获取图片路径（从 URL 参数中）
    const path = params.path ? params.path.join('/') : ''
    
    if (!path) {
      return new Response('Missing image path', { status: 400 })
    }

    // 从 R2 获取图片
    const object = await env.IMAGE_BUCKET.get(path)
    
    if (!object) {
      return new Response('Image not found', { status: 404 })
    }

    // 返回图片
    const headers = new Headers()
    object.writeHttpMetadata(headers)
    headers.set('Cache-Control', 'public, max-age=31536000, immutable')
    headers.set('Access-Control-Allow-Origin', '*')
    
    return new Response(object.body, {
      headers,
    })
  } catch (error) {
    console.error('Error fetching image from R2:', error)
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
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}