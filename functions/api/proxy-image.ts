export const onRequestGet = async (context: any) => {
  try {
    const url = new URL(context.request.url)
    const imageUrl = url.searchParams.get("url")

    if (!imageUrl) {
      return new Response("Missing url parameter", { status: 400 })
    }

    // 允许的域名（白名单优先）+ 受控兜底
    const allowedDomains = [
      "cdn.midjourney.com",
      "cdn.discordapp.com",
      "media.discordapp.net",
      "storage.googleapis.com",
      "midjourneycloud.com",
      "image2.midjourneycloud.com",
      "s.mj.run",
      "aliyuncs.com",
    ]

    let urlObj: URL
    try {
      urlObj = new URL(imageUrl)
    } catch {
      return new Response("Invalid URL", { status: 400 })
    }

    // 基础安全门槛
    if (urlObj.protocol !== "https:") {
      return new Response("Only https is allowed", { status: 403 })
    }

    const isWhitelisted = allowedDomains.some((domain) =>
      urlObj.hostname.includes(domain)
    )

    // 根据来源设置合适的 Referer
    const inferReferer = () =>
      urlObj.hostname.includes("discord")
        ? "https://discord.com/"
        : "https://www.midjourney.com/"

    // 准备通用请求头
    const commonHeaders: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept:
        "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    }

    const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024 // 10MB

    // 1) 白名单命中：直接放行，附带必要 Referer
    if (isWhitelisted) {
      const imageResponse = await fetch(imageUrl, {
        headers: { ...commonHeaders, Referer: inferReferer() },
      })
      if (!imageResponse.ok) {
        return new Response("Failed to fetch image", {
          status: imageResponse.status,
        })
      }
      const imageBlob = await imageResponse.arrayBuffer()
      return new Response(imageBlob, {
        headers: {
          "Content-Type":
            imageResponse.headers.get("Content-Type") || "image/png",
          "Cache-Control": "public, max-age=31536000, immutable",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      })
    }

    // 2) 默认放行的“受控兜底”
    // 先尝试 HEAD 检查类型与大小
    let contentType = ""
    let contentLength = 0
    try {
      const headRes = await fetch(imageUrl, {
        method: "HEAD",
        headers: commonHeaders,
      })
      if (headRes.ok) {
        contentType = headRes.headers.get("Content-Type") || ""
        const lenStr =
          headRes.headers.get("Content-Length") ||
          headRes.headers.get("content-length")
        contentLength = lenStr ? parseInt(lenStr) : 0
      }
    } catch {}

    if (contentType && !contentType.toLowerCase().startsWith("image/")) {
      return new Response("Domain not allowed", { status: 403 })
    }
    if (contentLength && contentLength > MAX_IMAGE_SIZE_BYTES) {
      return new Response("Image too large", { status: 413 })
    }

    const imageResponse = await fetch(imageUrl, { headers: commonHeaders })
    if (!imageResponse.ok) {
      return new Response("Failed to fetch image", {
        status: imageResponse.status,
      })
    }

    const respType =
      imageResponse.headers.get("Content-Type") || "application/octet-stream"
    if (!respType.toLowerCase().startsWith("image/")) {
      return new Response("Domain not allowed", { status: 403 })
    }

    const imageBlob = await imageResponse.arrayBuffer()
    return new Response(imageBlob, {
      headers: {
        "Content-Type": respType.startsWith("image/") ? respType : "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    })
  } catch (error) {
    console.error("Error proxying image:", error)
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

// 处理 OPTIONS 请求（CORS 预检）
export const onRequestOptions = async () => {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  })
}
