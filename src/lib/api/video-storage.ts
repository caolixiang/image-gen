export interface R2Video {
  key: string
  url: string
  size: number
  uploaded: string
  metadata?: Record<string, string>
  alreadyExists?: boolean
}

/**
 * 上传视频到 R2
 */
export async function uploadVideoToR2(
  videoUrl: string,
  filename: string,
  taskId?: string
): Promise<R2Video> {
  const response = await fetch("/api/video/save-video", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      videoUrl,
      filename,
      taskId,
    }),
  })

  if (!response.ok) {
    const error = await response.json() as { message?: string }
    throw new Error(error.message || "Failed to upload video to R2")
  }

  return response.json()
}

/**
 * 获取 R2 视频列表
 */
export async function listStoredVideos(): Promise<R2Video[]> {
  const response = await fetch("/api/video/list-videos")
  
  if (!response.ok) {
    const error = await response.json() as { message?: string }
    throw new Error(error.message || "Failed to list videos from R2")
  }

  const result = await response.json() as { videos?: R2Video[] }
  return result.videos || []
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
    const error = await response.json() as { message?: string }
    throw new Error(error.message || "Failed to delete video from R2")
  }
}
