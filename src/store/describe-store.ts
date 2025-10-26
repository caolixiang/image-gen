import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface DescribeState {
  // Image Describer
  selectedFile: File | null
  previewUrl: string
  description: string
  isAnalyzing: boolean
  taskId: string
  isPolling: boolean
  
  // Actions
  setSelectedFile: (file: File | null) => void
  setPreviewUrl: (url: string) => void
  setDescription: (description: string) => void
  setIsAnalyzing: (isAnalyzing: boolean) => void
  setTaskId: (taskId: string) => void
  setIsPolling: (isPolling: boolean) => void
  resetDescriber: () => void
}

export const useDescribeStore = create<DescribeState>()(
  persist(
    (set) => ({
      // Initial state
      selectedFile: null,
      previewUrl: '',
      description: '',
      isAnalyzing: false,
      taskId: '',
      isPolling: false,
      
      // Actions
      setSelectedFile: (file) => set({ selectedFile: file }),
      setPreviewUrl: (url) => set({ previewUrl: url }),
      setDescription: (description) => set({ description }),
      setIsAnalyzing: (isAnalyzing) => set({ isAnalyzing }),
      setTaskId: (taskId) => set({ taskId }),
      setIsPolling: (isPolling) => set({ isPolling }),
      resetDescriber: () => set({ 
        selectedFile: null, 
        previewUrl: '', 
        description: '', 
        isAnalyzing: false,
        taskId: '',
        isPolling: false
      }),
    }),
    {
      name: 'image-describer-storage',
      partialize: (state) => ({
        // 只持久化描述文本，不持久化文件和 URL（这些无法序列化）
        description: state.description,
      }),
    }
  )
)

