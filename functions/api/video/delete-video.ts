// Cloudflare Pages Function - 删除 R2 中的视频
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
      key?: string
    }

    if (!body.key) {
      return new Response("Missing video key", { status: 400 })
    }

    // 从 R2 删除视频
    await env.IMAGE_BUCKET.delete(body.key)

    return new Response(
      JSON.stringify({
        success: true,
        message: "Video deleted successfully",
        key: body.key,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    )
  } catch (error) {
    console.error("Error deleting video from R2:", error)
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
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  })
}
