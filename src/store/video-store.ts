import { create } from "zustand"

export interface R2Video {
  key: string
  url: string
  uploaded: string
  size: number
  metadata?: {
    taskId?: string
  }
}

interface VideoState {
  // Video Generator
  description: string
  aspectRatio: string
  duration: string
  isGenerating: boolean
  progress: number
  statusText: string
  currentVideoUrl: string
  currentTaskId: string
  storedVideos: R2Video[]
  loadingStoredVideos: boolean
  isPolling: boolean // 新增：标记是否正在轮询

  // Actions
  setDescription: (description: string) => void
  setAspectRatio: (aspectRatio: string) => void
  setDuration: (duration: string) => void
  setIsGenerating: (isGenerating: boolean) => void
  setProgress: (progress: number) => void
  setStatusText: (statusText: string) => void
  setCurrentVideoUrl: (url: string) => void
  setCurrentTaskId: (taskId: string) => void
  setStoredVideos: (videos: R2Video[]) => void
  setLoadingStoredVideos: (loading: boolean) => void
  setIsPolling: (isPolling: boolean) => void
  resetCurrentVideo: () => void
}

export const useVideoStore = create<VideoState>()((set) => ({
  // Initial state
  description: "",
  aspectRatio: "9:16",
  duration: "15s",
  isGenerating: false,
  progress: 0,
  statusText: "",
  currentVideoUrl: "",
  currentTaskId: "",
  storedVideos: [],
  loadingStoredVideos: false,
  isPolling: false,

  // Actions
  setDescription: (description) => set({ description }),
  setAspectRatio: (aspectRatio) => set({ aspectRatio }),
  setDuration: (duration) => set({ duration }),
  setIsGenerating: (isGenerating) => set({ isGenerating }),
  setProgress: (progress) => set({ progress }),
  setStatusText: (statusText) => set({ statusText }),
  setCurrentVideoUrl: (url) => set({ currentVideoUrl: url }),
  setCurrentTaskId: (taskId) => set({ currentTaskId: taskId }),
  setStoredVideos: (videos) => set({ storedVideos: videos }),
  setLoadingStoredVideos: (loading) => set({ loadingStoredVideos: loading }),
  setIsPolling: (isPolling) => set({ isPolling }),
  resetCurrentVideo: () =>
    set({
      currentVideoUrl: "",
      currentTaskId: "",
      progress: 0,
      statusText: "",
      isPolling: false,
    }),
}))
