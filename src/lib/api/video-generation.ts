export interface VideoGenerationParams {
  prompt: string
  imageFile?: File  // 可选参数
  model: string
  size: string
  seconds: number
  watermark: boolean
}

export interface VideoTask {
  id: string
  object: string
  model: string
  status: string
  progress: number
  created_at: number
  seconds: string
  video_url?: string
  size?: string
}

export interface RemixParams {
  prompt: string
}

/**
 * 生成视频
 */
export async function generateVideo(
  baseUrl: string,
  apiKey: string,
  params: VideoGenerationParams
): Promise<VideoTask> {
  console.log('🚀 开始生成视频')
  console.log('📝 参数:', {
    model: params.model,
    prompt: params.prompt,
    imageFileName: params.imageFile?.name,
    imageFileSize: params.imageFile?.size,
    imageFileType: params.imageFile?.type,
    hasImage: !!params.imageFile,
    size: params.size,
    seconds: params.seconds,
    watermark: params.watermark
  })
  console.log('🔑 API Key 前缀:', apiKey.substring(0, 10) + '...')
  console.log('🌐 请求 URL:', `${baseUrl}/v1/videos`)

  const formData = new FormData()
  formData.append('model', params.model)
  formData.append('prompt', params.prompt)
  // 只有在有图片时才添加
  if (params.imageFile) {
    formData.append('input_reference', params.imageFile)
  }
  formData.append('size', params.size)
  formData.append('seconds', params.seconds.toString())
  formData.append('watermark', params.watermark.toString())

  try {
    const response = await fetch(`${baseUrl}/v1/videos`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as { message?: string }
      throw new Error(`HTTP ${response.status}: ${errorData.message || response.statusText}`)
    }

    const data = await response.json() as VideoTask
    console.log('✅ 视频生成任务提交成功')
    console.log('📋 任务信息:', data)
    return data
  } catch (error: any) {
    console.error('❌ 视频生成任务提交失败')
    console.error('错误详情:', {
      message: error.message,
    })
    throw error
  }
}

/**
 * 查询视频状态
 */
export async function getVideoStatus(baseUrl: string, apiKey: string, taskId: string): Promise<VideoTask> {
  console.log('🔍 查询视频状态:', taskId)
  console.log('🔍 完整请求URL:', `${baseUrl}/v1/videos/${taskId}`)
  
  if (!taskId || taskId.trim() === '') {
    throw new Error('Task ID is empty or invalid')
  }
  
  try {
    const response = await fetch(`${baseUrl}/v1/videos/${taskId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as { message?: string }
      throw new Error(`HTTP ${response.status}: ${errorData.message || response.statusText}`)
    }

    const data = await response.json() as VideoTask
    console.log('📊 视频状态:', {
      id: data.id,
      status: data.status,
      progress: data.progress,
      model: data.model
    })
    
    return data
  } catch (error: any) {
    console.error('❌ 查询视频状态失败')
    console.error('错误详情:', {
      taskId,
      message: error.message,
    })
    throw error
  }
}

/**
 * 下载视频（返回 blob URL）
 * 注意：根据 tuzi API 文档，下载视频可能需要直接使用 video_url
 */
export async function downloadVideo(baseUrl: string, apiKey: string, taskId: string): Promise<Blob> {
  // 首先获取任务状态以获取 video_url
  const task = await getVideoStatus(baseUrl, apiKey, taskId)
  
  if (!task.video_url) {
    throw new Error('Video URL not available')
  }

  // 直接使用 video_url 下载视频
  const response = await fetch(task.video_url)

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  return response.blob()
}

/**
 * Remix 视频（重新编辑）
 */
export async function remixVideo(
  baseUrl: string,
  apiKey: string,
  videoId: string,
  params: RemixParams
): Promise<VideoTask> {
  console.log('🎬 Remix 请求参数:', {
    baseUrl,
    videoId,
    prompt: params.prompt
  })
  console.log('🎬 完整请求 URL:', `${baseUrl}/v1/videos/${videoId}/remix`)

  const response = await fetch(`${baseUrl}/v1/videos/${videoId}/remix`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ prompt: params.prompt })
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({})) as { message?: string }
    console.error('🎬 Remix 请求失败:', {
      status: response.status,
      statusText: response.statusText,
      errorData
    })
    throw new Error(`HTTP ${response.status}: ${errorData.message || response.statusText}`)
  }

  const result = await response.json() as VideoTask
  console.log('🎬 Remix 请求成功:', result)
  return result
}
