/**
 * 图片生成 API 服务
 * 处理 nano-banana 和 Midjourney 的图片生成请求
 */

export interface GenerationConfig {
  baseUrl: string
  apiKey: string
}

export interface NanoBananaParams {
  model: string
  prompt: string
  n: number
  size: string
}

export interface MidjourneyParams {
  prompt: string
  base64Array: string[]
  botType?: string
  modes?: string[]
}

export interface GenerationResult {
  images: string[]
  taskId?: string
}

/**
 * nano-banana 图片生成（同步）
 */
export async function generateWithNanoBanana(
  config: GenerationConfig,
  params: NanoBananaParams
): Promise<string[]> {
  const response = await fetch(`${config.baseUrl}/v1/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: params.model,
      prompt: params.prompt,
      n: params.n,
      size: params.size,
    }),
  })

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`)
  }

  const data = (await response.json()) as {
    data: Array<{ url: string }>
  }
  return data.data.map((item: { url: string }) => item.url)
}

/**
 * 提交 Midjourney 任务
 */
export async function submitMidjourneyTask(
  config: GenerationConfig,
  params: MidjourneyParams
): Promise<string> {
  const requestBody: Record<string, unknown> = {
    botType: params.botType || "MID_JOURNEY",
    prompt: params.prompt,
    base64Array: params.base64Array,
  }

  // 添加 accountFilter 配置
  if (params.modes && params.modes.length > 0) {
    requestBody.accountFilter = {
      modes: params.modes,
      remix: true,
      remixAutoConsidered: true,
    }
  }

  // 调试日志
  console.log("[Midjourney] 提交任务请求体:", requestBody)

  const response = await fetch(`${config.baseUrl}/mj/submit/imagine`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    throw new Error(`Failed to submit task: ${response.statusText}`)
  }

  const data = (await response.json()) as {
    code: number
    description?: string
    result: string
  }

  // 调试日志
  console.log("[Midjourney] 提交任务响应:", data)

  if (data.code !== 1) {
    throw new Error(data.description || "任务提交失败")
  }

  return data.result.toString()
}

/**
 * 查询 Midjourney 任务状态
 */
export async function fetchMidjourneyTaskStatus(
  config: GenerationConfig,
  taskId: string
): Promise<{
  status: string
  imageUrl?: string
  imageUrls?: Array<{ url: string }>
  progress?: number
}> {
  const response = await fetch(`${config.baseUrl}/mj/task/${taskId}/fetch`, {
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch task: ${response.statusText}`)
  }

  const data = (await response.json()) as {
    status?: string
    progress?: string | number
    imageUrl?: string
    imageUrls?: Array<{ url: string }>
  }

  // 解析进度字符串 "80%" -> 80
  let progressValue: number | undefined = undefined
  if (data.progress) {
    if (typeof data.progress === "string") {
      // 去掉 % 符号并转换为数字
      progressValue = parseInt(data.progress.replace("%", ""))
    } else if (typeof data.progress === "number") {
      progressValue = data.progress
    }
  }

  // 调试日志
  console.log(`[Midjourney] 任务 ${taskId} 状态:`, {
    status: data.status,
    progress: data.progress,
    progressValue,
    imageUrl: data.imageUrl,
    imageUrls: data.imageUrls,
  })

  return {
    status: data.status || "PROCESSING",
    imageUrl: data.imageUrl,
    imageUrls: data.imageUrls,
    progress: progressValue,
  }
}

/**
 * 轮询 Midjourney 任务直到完成
 * @returns 返回生成的图片 URL 数组（4张独立图片）
 */
export async function pollMidjourneyTask(
  config: GenerationConfig,
  taskId: string,
  onProgress?: (status: string, progress: number) => void,
  maxAttempts: number = 200, // 增加到 200 次 (10 分钟)
  pollInterval: number = 3000 // 每 3 秒轮询一次
): Promise<string[]> {
  let attempts = 0

  while (attempts < maxAttempts) {
    const result = await fetchMidjourneyTaskStatus(config, taskId)

    // 更新进度回调 - 优先使用 API 返回的真实进度
    if (onProgress) {
      let progress: number
      if (result.progress !== undefined && result.progress > 0) {
        // 使用 API 返回的真实进度
        progress = result.progress
      } else {
        // 如果 API 没有返回进度，使用轮询次数估算
        progress = Math.min(90, (attempts / maxAttempts) * 100)
      }
      onProgress(result.status, progress)
    }

    // 成功 - 优先使用 imageUrls（4张独立图片）
    if (result.status === "SUCCESS") {
      if (onProgress) {
        onProgress(result.status, 100)
      }

      // 优先使用 imageUrls 数组（4张独立图片）
      if (result.imageUrls && result.imageUrls.length > 0) {
        return result.imageUrls.map((item) => item.url)
      }

      // 降级方案：如果没有 imageUrls，使用 imageUrl（合并图片）
      if (result.imageUrl) {
        return [result.imageUrl]
      }

      throw new Error("未找到生成的图片")
    }

    // 失败
    if (result.status === "FAILURE" || result.status === "FAILED") {
      throw new Error("图片生成失败")
    }

    // 等待后重试
    await new Promise((resolve) => setTimeout(resolve, pollInterval))
    attempts++
  }

  throw new Error("生成超时（已等待 10 分钟），请稍后重试或联系 API 提供商")
}

/**
 * 保存图片到 R2
 */
export async function saveImageToR2(imageUrl: string): Promise<string> {
  const response = await fetch("/api/save-image", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    keepalive: true,
    body: JSON.stringify({ imageUrl }),
  })

  if (!response.ok) {
    const errText = await response.text().catch(() => "")
    console.error(
      "Failed to save image to R2:",
      response.status,
      response.statusText,
      errText
    )
    throw new Error(
      `Failed to save image to R2: ${response.status} ${response.statusText}`
    )
  }

  const data = (await response.json()) as {
    url: string
  }
  return data.url
}

/**
 * 批量保存图片到 R2
 */
export async function saveImagesToR2(imageUrls: string[]): Promise<string[]> {
  const savedImages: string[] = []

  // 引入本地持久化队列，先入队，成功再移除，保证页面关闭也能兜底
  const { addPendingImage, removePendingImage } = await import(
    "@/lib/pending-uploads"
  )

  for (const imageUrl of imageUrls) {
    try {
      addPendingImage(imageUrl)
      const savedUrl = await saveImageToR2(imageUrl)
      savedImages.push(savedUrl)
      // 成功则从队列移除
      removePendingImage(imageUrl)
    } catch (error) {
      console.error("Failed to save image:", error)
      // 失败：保留在 pending 队列，等待后续自动重试；不将外链加入已保存列表，避免“假结果”
      // 注意：此处不调用 removePendingImage(imageUrl)
    }
  }

  return savedImages
}
