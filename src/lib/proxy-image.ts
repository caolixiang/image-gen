/**
 * 图片代理工具
 * 用于解决跨域图片访问问题
 */

/**
 * 将外部图片 URL 转换为通过代理访问的 URL
 */
export function proxyImageUrl(imageUrl: string): string {
  // 如果是相对路径或本地图片，直接返回
  if (imageUrl.startsWith('/') || imageUrl.startsWith('data:')) {
    return imageUrl
  }

  // 如果已经是代理 URL，直接返回
  if (imageUrl.includes('/api/proxy-image')) {
    return imageUrl
  }

  // 通过代理访问外部图片
  return `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`
}

/**
 * 批量转换图片 URL
 */
export function proxyImageUrls(imageUrls: string[]): string[] {
  return imageUrls.map(url => proxyImageUrl(url))
}


