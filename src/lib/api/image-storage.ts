/**
 * 图片存储 API - 从 R2 获取图片列表
 */

export interface StoredImage {
  key: string
  url: string
  uploaded: string
  size: number
}

export interface ListImagesResponse {
  success: boolean
  images: StoredImage[]
  truncated: boolean
  cursor?: string
}

/**
 * 获取 R2 中存储的所有图片
 */
export async function listStoredImages(limit: number = 100): Promise<string[]> {
  try {
    const response = await fetch(`/api/list-images?limit=${limit}`)
    
    if (!response.ok) {
      throw new Error(`Failed to list images: ${response.statusText}`)
    }

    const data: ListImagesResponse = await response.json()
    
    if (!data.success) {
      throw new Error('Failed to list images')
    }

    // 返回图片 URL 数组
    return data.images.map(img => img.url)
  } catch (error) {
    console.error('Error listing stored images:', error)
    return []
  }
}

/**
 * 获取带详细信息的图片列表
 */
export async function listStoredImagesDetailed(limit: number = 100): Promise<StoredImage[]> {
  try {
    const response = await fetch(`/api/list-images?limit=${limit}`)
    
    if (!response.ok) {
      throw new Error(`Failed to list images: ${response.statusText}`)
    }

    const data: ListImagesResponse = await response.json()
    
    if (!data.success) {
      throw new Error('Failed to list images')
    }

    return data.images
  } catch (error) {
    console.error('Error listing stored images:', error)
    return []
  }
}

/**
 * 从 URL 提取图片 key
 */
function extractKeyFromUrl(url: string): string | null {
  // URL 格式: /api/r2-image/generated/xxx.png
  const match = url.match(/\/api\/r2-image\/(.+)/)
  return match ? match[1] : null
}

/**
 * 删除 R2 中的图片
 */
export async function deleteStoredImage(imageUrl: string): Promise<boolean> {
  try {
    const key = extractKeyFromUrl(imageUrl)
    
    if (!key) {
      throw new Error('Invalid image URL')
    }

    const response = await fetch('/api/delete-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ key }),
    })

    if (!response.ok) {
      throw new Error(`Failed to delete image: ${response.statusText}`)
    }

    const data = await response.json() as {
      success: boolean
    }
    return data.success
  } catch (error) {
    console.error('Error deleting image:', error)
    return false
  }
}

