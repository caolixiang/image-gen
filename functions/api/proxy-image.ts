export const onRequestGet = async (context: any) => {
  try {
    const url = new URL(context.request.url)
    const imageUrl = url.searchParams.get('url')

    if (!imageUrl) {
      return new Response('Missing url parameter', { status: 400 })
    }

    // 验证 URL 是否来自允许的域名
    const allowedDomains = [
      'cdn.midjourney.com',
      'cdn.discordapp.com',
      'storage.googleapis.com',
    ]
    
    let urlObj: URL
    try {
      urlObj = new URL(imageUrl)
    } catch {
      return new Response('Invalid URL', { status: 400 })
    }

    const isAllowed = allowedDomains.some(domain => urlObj.hostname.includes(domain))
    if (!isAllowed) {
      return new Response('Domain not allowed', { status: 403 })
    }

    // 获取图片
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
      return new Response('Failed to fetch image', { status: imageResponse.status })
    }

    // 返回图片，添加 CORS 头
    const imageBlob = await imageResponse.arrayBuffer()
    
    return new Response(imageBlob, {
      headers: {
        'Content-Type': imageResponse.headers.get('Content-Type') || 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  } catch (error) {
    console.error('Error proxying image:', error)
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

