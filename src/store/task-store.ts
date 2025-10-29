import { create } from "zustand"
import { persist } from "zustand/middleware"

export type TaskKind = "image" | "video" | "describe"

interface TaskStoreState {
  imageTaskId: string | null
  imageProviderId: string | null
  videoTaskId: string | null
  videoProviderId: string | null
  describeTaskId: string | null
  describeProviderId: string | null
  setTask: (
    kind: TaskKind,
    id: string | null,
    providerId?: string | null
  ) => void
  clearAll: () => void
}

export const useTaskStore = create<TaskStoreState>()(
  persist(
    (set) => ({
      imageTaskId: null,
      imageProviderId: null,
      videoTaskId: null,
      videoProviderId: null,
      describeTaskId: null,
      describeProviderId: null,
      setTask: (kind, id, providerId = null) =>
        set((state) => {
          if (kind === "image")
            return {
              ...state,
              imageTaskId: id,
              imageProviderId: id ? providerId : null,
            }
          if (kind === "video")
            return {
              ...state,
              videoTaskId: id,
              videoProviderId: id ? providerId : null,
            }
          return {
            ...state,
            describeTaskId: id,
            describeProviderId: id ? providerId : null,
          }
        }),
      clearAll: () =>
        set({
          imageTaskId: null,
          imageProviderId: null,
          videoTaskId: null,
          videoProviderId: null,
          describeTaskId: null,
          describeProviderId: null,
        }),
    }),
    {
      name: "pending-tasks",
    }
  )
)
