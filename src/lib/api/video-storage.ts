export interface R2Video {
  key: string
  url: string
  size: number
  uploaded: string
  metadata?: Record<string, string>
  alreadyExists?: boolean
}

export interface ListVideosResponse {
  videos: R2Video[]
  truncated: boolean
  cursor?: string
}

/**
 * 上传视频到 R2
 */
export async function uploadVideoToR2(
  videoUrl: string,
  filename: string,
  taskId?: string
): Promise<R2Video> {
  // 先加入本地队列，保证页面关闭也会被兜底保存
  const { addPendingVideo, removePendingVideo } = await import(
    "@/lib/pending-uploads"
  )
  addPendingVideo(videoUrl, filename, taskId)

  const response = await fetch("/api/video/save-video", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    keepalive: true,
    body: JSON.stringify({
      videoUrl,
      filename,
      taskId,
    }),
  })

  if (!response.ok) {
    const error = (await response.json()) as { message?: string }
    throw new Error(error.message || "Failed to upload video to R2")
  }

  // 成功则从队列删除
  removePendingVideo(videoUrl, filename)

  return response.json()
}

/**
 * 获取 R2 视频列表
 */
export async function listStoredVideosPage(
  limit: number = 100,
  cursor?: string
): Promise<ListVideosResponse> {
  const params = new URLSearchParams()
  if (limit) params.set("limit", String(limit))
  if (cursor) params.set("cursor", cursor)

  const response = await fetch(`/api/video/list-videos?${params.toString()}`)
  if (!response.ok) {
    const error = (await response.json()) as { message?: string }
    throw new Error(error.message || "Failed to list videos from R2")
  }

  const result = (await response.json()) as {
    videos?: R2Video[]
    truncated?: boolean
    cursor?: string
  }

  return {
    videos: result.videos || [],
    truncated: Boolean(result.truncated),
    cursor: result.cursor,
  }
}

export async function listStoredVideos(): Promise<R2Video[]> {
  const { videos } = await listStoredVideosPage()
  return videos
}

/**
 * 删除 R2 视频
 */
export async function deleteStoredVideo(key: string): Promise<void> {
  const response = await fetch("/api/video/delete-video", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ key }),
  })

  if (!response.ok) {
    const error = (await response.json()) as { message?: string }
    throw new Error(error.message || "Failed to delete video from R2")
  }
}
