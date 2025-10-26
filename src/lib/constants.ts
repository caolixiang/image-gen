/**
 * 服务商配置常量和类型定义
 */

export interface Provider {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  logo: string
}

export interface ProvidersConfig {
  providers: Provider[]
  selectedProviderId: string | null
}

/**
 * 预定义的服务商列表
 */
export const PROVIDERS: Omit<Provider, 'apiKey'>[] = [
  {
    id: 'tuzi',
    name: '兔子API',
    baseUrl: 'https://api.tu-zi.com',
    logo: '/logo-tuzi.png',
  },
  {
    id: 'bltcy',
    name: '柏拉图AI',
    baseUrl: 'https://api.bltcy.ai',
    logo: '/logo-bltcy.png',
  },
]

/**
 * localStorage 键名
 */
export const STORAGE_KEY = 'image-gen-providers-config'

