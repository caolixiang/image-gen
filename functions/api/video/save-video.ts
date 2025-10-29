// Cloudflare Pages Function - 保存视频到 R2
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
      videoUrl?: string
      filename?: string
      taskId?: string
    }

    if (!body.videoUrl || !body.filename) {
      return new Response("Missing videoUrl or filename", { status: 400 })
    }

    // 方案一：使用固定 key（videos/{taskId}.mp4）做 O(1) 去重，避免 list 分页遗漏
    let keyFromTask: string | undefined = undefined
    if (body.taskId) {
      const sanitizedTaskId = body.taskId.replace(/[^\w\-:.]/g, "_")
      keyFromTask = `videos/${sanitizedTaskId}.mp4`
      const existing = await env.IMAGE_BUCKET.head(keyFromTask)
      if (existing) {
        const publicUrl = `/api/video/r2-video/${keyFromTask}`
        return new Response(
          JSON.stringify({
            key: keyFromTask,
            url: publicUrl,
            size: existing.size,
            uploaded: existing.uploaded.toISOString(),
            alreadyExists: true,
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          }
        )
      }
    }

    // 不存在，继续下载和上传
    const videoResponse = await fetch(body.videoUrl)
    if (!videoResponse.ok) {
      return new Response(JSON.stringify({ error: "Failed to fetch video" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    }

    const videoBlob = await videoResponse.arrayBuffer()

    // 生成对象 key：优先使用固定 taskId key，否则回退到时间戳+文件名
    const timestamp = Date.now()
    const key = keyFromTask ?? `videos/${timestamp}-${body.filename}`

    // 上传到 R2（双通道：waitUntil 兜底 + await 正常返回）
    const putPromise = env.IMAGE_BUCKET.put(key, videoBlob, {
      httpMetadata: {
        contentType: "video/mp4",
      },
      customMetadata: {
        uploadedAt: new Date().toISOString(),
        originalUrl: body.videoUrl,
        taskId: body.taskId || "",
      },
    })
    context.waitUntil(putPromise as unknown as Promise<void>)
    await putPromise

    // 返回视频 URL
    const publicUrl = `/api/video/r2-video/${key}`

    return new Response(
      JSON.stringify({
        key,
        url: publicUrl,
        size: videoBlob.byteLength,
        uploaded: new Date().toISOString(),
        alreadyExists: false,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    )
  } catch (error) {
    console.error("Error uploading video:", error)
    return new Response(
      JSON.stringify({
        error: "Upload failed",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    )
  }
}

// 处理 OPTIONS 请求 (CORS preflight)
export const onRequestOptions = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  })
}
