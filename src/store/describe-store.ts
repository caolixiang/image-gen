import { create } from "zustand"

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

export const useDescribeStore = create<DescribeState>()((set) => ({
  // Initial state
  selectedFile: null,
  previewUrl: "",
  description: "",
  isAnalyzing: false,
  taskId: "",
  isPolling: false,

  // Actions
  setSelectedFile: (file) => set({ selectedFile: file }),
  setPreviewUrl: (url) => set({ previewUrl: url }),
  setDescription: (description) => set({ description }),
  setIsAnalyzing: (isAnalyzing) => set({ isAnalyzing }),
  setTaskId: (taskId) => set({ taskId }),
  setIsPolling: (isPolling) => set({ isPolling }),
  resetDescriber: () =>
    set({
      selectedFile: null,
      previewUrl: "",
      description: "",
      isAnalyzing: false,
      taskId: "",
      isPolling: false,
    }),
}))
