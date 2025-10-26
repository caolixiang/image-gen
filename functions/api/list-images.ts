// Cloudflare Pages Function - 直接使用 R2 Bucket API

interface Env {
  IMAGE_BUCKET: R2Bucket
}

export const onRequestGet = async (context: { env: Env; request: Request }) => {
  try {
    const { env } = context
    const url = new URL(context.request.url)
    
    // 获取分页参数
    const limit = parseInt(url.searchParams.get('limit') || '100')
    const cursor = url.searchParams.get('cursor') || undefined

    let images: Array<{ key: string; url: string; uploaded: string; size: number }>
    let truncated = false
    let nextCursor: string | undefined

    // 列出 R2 bucket 中的对象
    const listed = await env.IMAGE_BUCKET.list({
      prefix: 'generated/',
      limit: limit,
      cursor: cursor,
    })

    images = listed.objects.map((obj) => ({
      key: obj.key,
      url: `/api/r2-image/${obj.key}`,
      uploaded: obj.uploaded.toISOString(),
      size: obj.size,
    }))

    truncated = listed.truncated
    nextCursor = listed.truncated ? listed.cursor : undefined

    // 按上传时间倒序排序（最新的在前）
    images.sort((a, b) => new Date(b.uploaded).getTime() - new Date(a.uploaded).getTime())

    return new Response(
      JSON.stringify({
        success: true,
        images: images,
        truncated: truncated,
        cursor: nextCursor,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  } catch (error) {
    console.error('Error listing images from R2:', error)
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


