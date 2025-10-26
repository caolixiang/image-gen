import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type ServiceType = "nano-banana" | "midjourney"

interface ImageState {
  // Basic states
  prompt: string
  model: string
  loading: boolean
  generatedImages: string[]
  error: string | null
  referenceImages: string[]
  loadingStoredImages: boolean
  
  // Service selection
  serviceType: ServiceType
  
  // nano-banana specific states
  generationCount: number
  imageSize: string
  
  // Midjourney specific states
  taskId: string | null
  taskStatus: string
  progress: number
  mjBotType: string
  mjMode: string
  aspectRatio: string
  isPolling: boolean  // 标记是否正在轮询
  
  // Actions
  setPrompt: (prompt: string) => void
  setModel: (model: string) => void
  setLoading: (loading: boolean) => void
  setGeneratedImages: (images: string[]) => void
  setError: (error: string | null) => void
  setReferenceImages: (images: string[]) => void
  setLoadingStoredImages: (loading: boolean) => void
  setServiceType: (serviceType: ServiceType) => void
  setGenerationCount: (count: number) => void
  setImageSize: (size: string) => void
  setTaskId: (taskId: string | null) => void
  setTaskStatus: (status: string) => void
  setProgress: (progress: number) => void
  setMjBotType: (botType: string) => void
  setMjMode: (mode: string) => void
  setAspectRatio: (aspectRatio: string) => void
  setIsPolling: (isPolling: boolean) => void
  resetGeneratedImages: () => void
  addReferenceImage: (image: string) => void
  removeReferenceImage: (index: number) => void
}

export const useImageStore = create<ImageState>()(
  persist(
    (set) => ({
      // Initial state
      prompt: '',
      model: 'gemini-2.5-flash-image',
      loading: false,
      generatedImages: [],
      error: null,
      referenceImages: [],
      loadingStoredImages: false,
      
      serviceType: 'midjourney',
      
      generationCount: 1,
      imageSize: '1024x1024',
      
      taskId: null,
      taskStatus: '',
      progress: 0,
      mjBotType: 'MID_JOURNEY',
      mjMode: 'RELAX',
      aspectRatio: '',
      isPolling: false,
      
      // Actions
      setPrompt: (prompt) => set({ prompt }),
      setModel: (model) => set({ model }),
      setLoading: (loading) => set({ loading }),
      setGeneratedImages: (images) => set({ generatedImages: images }),
      setError: (error) => set({ error }),
      setReferenceImages: (images) => set({ referenceImages: images }),
      setLoadingStoredImages: (loading) => set({ loadingStoredImages: loading }),
      setServiceType: (serviceType) => set({ serviceType }),
      setGenerationCount: (count) => set({ generationCount: count }),
      setImageSize: (size) => set({ imageSize: size }),
      setTaskId: (taskId) => set({ taskId }),
      setTaskStatus: (status) => set({ taskStatus: status }),
      setProgress: (progress) => set({ progress }),
      setMjBotType: (botType) => set({ mjBotType: botType }),
      setMjMode: (mode) => set({ mjMode: mode }),
      setAspectRatio: (aspectRatio) => set({ aspectRatio }),
      setIsPolling: (isPolling) => set({ isPolling }),
      resetGeneratedImages: () => set({ generatedImages: [] }),
      addReferenceImage: (image) => set((state) => ({ 
        referenceImages: [...state.referenceImages, image] 
      })),
      removeReferenceImage: (index) => set((state) => ({ 
        referenceImages: state.referenceImages.filter((_, i) => i !== index) 
      })),
    }),
    {
      name: 'image-generator-storage',
      partialize: (state) => ({
        // 只持久化用户输入和配置，不持久化临时状态
        prompt: state.prompt,
        model: state.model,
        serviceType: state.serviceType,
        generationCount: state.generationCount,
        imageSize: state.imageSize,
        mjBotType: state.mjBotType,
        mjMode: state.mjMode,
        aspectRatio: state.aspectRatio,
        generatedImages: state.generatedImages,
      }),
    }
  )
)

