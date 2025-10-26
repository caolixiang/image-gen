/**
 * localStorage 管理工具函数
 */

import { STORAGE_KEY, PROVIDERS, type ProvidersConfig } from './constants'

/**
 * 从 localStorage 加载配置
 */
export function loadProvidersConfig(): ProvidersConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      return initializeConfig()
    }
    
    const config = JSON.parse(stored) as ProvidersConfig
    
    // 验证配置结构
    if (!config.providers || !Array.isArray(config.providers)) {
      return initializeConfig()
    }
    
    return config
  } catch (error) {
    console.error('Failed to load providers config:', error)
    return initializeConfig()
  }
}

/**
 * 保存配置到 localStorage
 */
export function saveProvidersConfig(config: ProvidersConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  } catch (error) {
    console.error('Failed to save providers config:', error)
  }
}

/**
 * 清除所有配置
 */
export function clearProvidersConfig(): ProvidersConfig {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.error('Failed to clear providers config:', error)
  }
  return initializeConfig()
}

/**
 * 删除单个服务商的 API Key
 */
export function removeProviderKey(config: ProvidersConfig, providerId: string): ProvidersConfig {
  const updatedProviders = config.providers.map(provider => 
    provider.id === providerId 
      ? { ...provider, apiKey: '' }
      : provider
  )
  
  // 如果删除的是当前选中的服务商，尝试切换到另一个已配置的服务商
  let newSelectedId = config.selectedProviderId
  if (config.selectedProviderId === providerId) {
    const otherConfiguredProvider = updatedProviders.find(
      p => p.id !== providerId && p.apiKey
    )
    newSelectedId = otherConfiguredProvider?.id || null
  }
  
  const newConfig = {
    providers: updatedProviders,
    selectedProviderId: newSelectedId,
  }
  
  saveProvidersConfig(newConfig)
  return newConfig
}

/**
 * 更新服务商的 API Key
 */
export function updateProviderKey(
  config: ProvidersConfig, 
  providerId: string, 
  apiKey: string
): ProvidersConfig {
  const updatedProviders = config.providers.map(provider =>
    provider.id === providerId
      ? { ...provider, apiKey }
      : provider
  )
  
  // 如果是第一个配置的服务商，自动选中它
  let newSelectedId = config.selectedProviderId
  if (!newSelectedId && apiKey) {
    newSelectedId = providerId
  }
  
  const newConfig = {
    providers: updatedProviders,
    selectedProviderId: newSelectedId,
  }
  
  saveProvidersConfig(newConfig)
  return newConfig
}

/**
 * 选择服务商
 */
export function selectProvider(config: ProvidersConfig, providerId: string): ProvidersConfig {
  // 检查该服务商是否已配置 API Key
  const provider = config.providers.find(p => p.id === providerId)
  if (!provider || !provider.apiKey) {
    console.warn(`Cannot select provider ${providerId}: no API key configured`)
    return config
  }
  
  const newConfig = {
    ...config,
    selectedProviderId: providerId,
  }
  
  saveProvidersConfig(newConfig)
  return newConfig
}

/**
 * 初始化配置
 */
function initializeConfig(): ProvidersConfig {
  return {
    providers: PROVIDERS.map(p => ({ ...p, apiKey: '' })),
    selectedProviderId: null,
  }
}

/**
 * 获取当前选中的服务商配置
 */
export function getSelectedProvider(config: ProvidersConfig): { baseUrl: string; apiKey: string } | null {
  if (!config.selectedProviderId) {
    return null
  }
  
  const provider = config.providers.find(p => p.id === config.selectedProviderId)
  if (!provider || !provider.apiKey) {
    return null
  }
  
  return {
    baseUrl: provider.baseUrl,
    apiKey: provider.apiKey,
  }
}

