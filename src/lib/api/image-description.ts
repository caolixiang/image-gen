/**
 * 图片描述 API 服务
 * 处理 Midjourney Describe（图生文）功能
 */

export interface DescriptionConfig {
  baseUrl: string
  apiKey: string
}

/**
 * Midjourney Describe（图生文）参数
 */
export interface MidjourneyDescribeParams {
  base64: string
  botType?: string
}

/**
 * 提交 Midjourney Describe 任务（图生文）
 */
export async function submitMidjourneyDescribe(
  config: DescriptionConfig,
  params: MidjourneyDescribeParams
): Promise<string> {
  const requestBody: Record<string, unknown> = {
    botType: params.botType || "MID_JOURNEY",
    base64: params.base64,
  }

  // 调试日志
  console.log("[Midjourney Describe] 提交任务请求体:", {
    botType: requestBody.botType,
    base64Length: params.base64.length,
  })

  const response = await fetch(`${config.baseUrl}/mj/submit/describe`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    throw new Error(`Failed to submit describe task: ${response.statusText}`)
  }

  const data = await response.json() as {
    code: number
    description?: string
    result: string
  }

  // 调试日志
  console.log("[Midjourney Describe] 提交任务响应:", data)

  if (data.code !== 1) {
    throw new Error(data.description || "Describe 任务提交失败")
  }

  return data.result.toString()
}

/**
 * 查询 Midjourney Describe 任务结果
 */
export async function fetchMidjourneyDescribeResult(
  config: DescriptionConfig,
  taskId: string
): Promise<{
  status: string
  prompt?: string
  progress?: number
}> {
  const response = await fetch(`${config.baseUrl}/mj/task/${taskId}/fetch`, {
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch describe task: ${response.statusText}`)
  }

  const data = await response.json() as {
    status?: string
    prompt?: string
    promptEn?: string
    progress?: string | number
    properties?: {
      finalPrompt?: string
    }
  }

  // 解析进度
  let progressValue: number | undefined = undefined
  if (data.progress) {
    if (typeof data.progress === "string") {
      progressValue = parseInt(data.progress.replace("%", ""))
    } else if (typeof data.progress === "number") {
      progressValue = data.progress
    }
  }

  // 尝试从多个可能的字段获取 prompt
  const promptText = 
    data.promptEn || 
    data.prompt || 
    data.properties?.finalPrompt || 
    ""

  // 调试日志
  console.log(`[Midjourney Describe] 任务 ${taskId} 状态:`, {
    status: data.status,
    prompt: data.prompt,
    promptEn: data.promptEn,
    finalPrompt: data.properties?.finalPrompt,
    progress: data.progress,
    progressValue,
    extractedPrompt: promptText ? promptText.substring(0, 100) + "..." : "(empty)",
  })

  return {
    status: data.status || "PROCESSING",
    prompt: promptText,
    progress: progressValue,
  }
}

/**
 * 轮询 Midjourney Describe 任务直到完成
 * @returns 返回生成的提示词描述
 */
export async function pollMidjourneyDescribe(
  config: DescriptionConfig,
  taskId: string,
  onProgress?: (status: string, progress: number) => void,
  maxAttempts: number = 100, // Describe 通常较快，100次足够
  pollInterval: number = 2000 // 每 2 秒轮询一次
): Promise<string> {
  let attempts = 0

  while (attempts < maxAttempts) {
    const result = await fetchMidjourneyDescribeResult(config, taskId)

    // 更新进度回调
    if (onProgress) {
      let progress: number
      if (result.progress !== undefined && result.progress > 0) {
        progress = result.progress
      } else {
        progress = Math.min(90, (attempts / maxAttempts) * 100)
      }
      onProgress(result.status, progress)
    }

    // 成功
    if (result.status === "SUCCESS") {
      if (onProgress) {
        onProgress(result.status, 100)
      }
      
      // 如果没有获取到 prompt，返回空字符串或抛出错误
      if (!result.prompt) {
        console.warn("[Midjourney Describe] 任务成功但未获取到 prompt")
        return ""
      }
      
      return result.prompt
    }

    // 失败
    if (result.status === "FAILURE" || result.status === "FAILED") {
      throw new Error("Describe 任务失败")
    }

    // 等待后重试
    await new Promise((resolve) => setTimeout(resolve, pollInterval))
    attempts++
  }

  throw new Error("Describe 超时（已等待 3 分钟），请稍后重试")
}
