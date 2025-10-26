/**
 * R2 客户端 - 支持本地开发和生产环境
 * 本地开发时使用 S3 兼容 API，生产环境使用 Cloudflare Functions
 */

// 判断是否在本地开发环境
const isLocalDev = import.meta.env.DEV

// R2 配置（本地开发使用）
const R2_CONFIG = {
  accountId: import.meta.env.VITE_R2_ACCOUNT_ID || '',
  accessKeyId: import.meta.env.VITE_R2_ACCESS_KEY_ID || '',
  secretAccessKey: import.meta.env.VITE_R2_SECRET_ACCESS_KEY || '',
  bucketName: 'image-gen-storage',
}

/**
 * 上传图片到 R2
 */
export async function uploadImageToR2(imageUrl: string): Promise<string> {
  if (isLocalDev && R2_CONFIG.accountId) {
    // 本地开发：使用 S3 兼容 API
    return uploadViaS3Api(imageUrl)
  } else {
    // 生产环境：使用 Cloudflare Functions
    return uploadViaFunction(imageUrl)
  }
}

/**
 * 通过 Cloudflare Function 上传（生产环境）
 */
async function uploadViaFunction(imageUrl: string): Promise<string> {
  const response = await fetch('/api/save-image', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ imageUrl }),
  })

  if (!response.ok) {
    throw new Error('Failed to save image')
  }

  const data = await response.json() as {
    url: string
  }
  return data.url
}

/**
 * 通过 S3 兼容 API 上传（本地开发）
 */
async function uploadViaS3Api(imageUrl: string): Promise<string> {
  // 1. 下载图片
  const imageResponse = await fetch(imageUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Referer': 'https://www.midjourney.com/',
    },
  })

  if (!imageResponse.ok) {
    throw new Error('Failed to fetch image')
  }

  const imageBlob = await imageResponse.blob()
  
  // 2. 生成唯一的文件名
  const timestamp = Date.now()
  const randomStr = Math.random().toString(36).substring(2, 15)
  const key = `generated/${timestamp}-${randomStr}.png`

  // 3. 使用代理服务上传到 R2
  const formData = new FormData()
  formData.append('file', imageBlob, key)
  formData.append('key', key)

  const uploadResponse = await fetch('/api/local-r2-upload', {
    method: 'POST',
    body: formData,
  })

  if (!uploadResponse.ok) {
    throw new Error('Failed to upload to R2')
  }

  const data = await uploadResponse.json() as {
    url: string
  }
  return data.url
}

/**
 * 获取图片列表
 */
export async function listR2Images(limit: number = 100): Promise<string[]> {
  if (isLocalDev && R2_CONFIG.accountId) {
    // 本地开发：通过本地代理访问
    return listViaLocalProxy(limit)
  } else {
    // 生产环境：使用 Cloudflare Functions
    return listViaFunction(limit)
  }
}

/**
 * 通过 Function 获取列表（生产环境）
 */
async function listViaFunction(limit: number): Promise<string[]> {
  const response = await fetch(`/api/list-images?limit=${limit}`)
  
  if (!response.ok) {
    throw new Error('Failed to list images')
  }

  const data = await response.json() as {
    images: Array<{ url: string }>
  }
  return data.images.map((img: any) => img.url)
}

/**
 * 通过本地代理获取列表（本地开发）
 */
async function listViaLocalProxy(limit: number): Promise<string[]> {
  // 本地开发时，仍然使用 /api/list-images
  // 但需要配置本地开发服务器
  return listViaFunction(limit)
}

/**
 * 删除图片
 */
export async function deleteR2Image(imageUrl: string): Promise<boolean> {
  // 本地和生产都使用相同的 API
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
    return false
  }

  const data = await response.json() as {
    success: boolean
  }
  return data.success
}

/**
 * 从 URL 提取图片 key
 */
function extractKeyFromUrl(url: string): string | null {
  const match = url.match(/\/api\/r2-image\/(.+)/)
  return match ? match[1] : null
}

