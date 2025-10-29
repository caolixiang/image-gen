import { create } from "zustand"
import { persist } from "zustand/middleware"
import { loadProvidersConfig } from "@/lib/storage"
import {
  submitMidjourneyTask,
  fetchMidjourneyTaskStatus,
  saveImagesToR2,
  type GenerationConfig,
} from "@/lib/api/image-generation"
import { useImageStore } from "@/store/image-store"

// ---- Types ----
export type JobKind = "image" | "video"
export type JobStatus =
  | "queued"
  | "submitting"
  | "processing"
  | "saving"
  | "success"
  | "timeout"

export type ImageService = "midjourney" | "nano-banana"

export interface ImageJobParams {
  service: ImageService
  prompt: string
  referenceImages: string[]
  mjBotType?: string
  mjMode?: string
  aspectRatio?: string
  model?: string
  imageSize?: string
}

export interface BaseJob {
  id: string
  kind: JobKind
  status: JobStatus
  taskId?: string
  providerId: string | null
  progress: number
  createdAt: number
  updatedAt: number
  timeoutAt: number // epoch ms
  error?: string
}

export interface ImageJob extends BaseJob {
  kind: "image"
  params: ImageJobParams
  resultUrls?: string[]
}

export type Job = ImageJob // 暂时只支持图片；视频稍后接入

// ---- Config ----
const DEFAULT_CONCURRENCY: Record<JobKind, number> = {
  image: 6,
  video: 6,
}

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000 // 10 分钟

// ---- Ephemeral runtime state (not persisted) ----
const pollTimers = new Map<string, number>() // jobId -> setInterval id
const TAB_ID = Math.random().toString(36).slice(2)
const MASTER_KEY = "jobs-master-v1"
const MASTER_TTL = 10_000
let bc: BroadcastChannel | null = null

function now() {
  return Date.now()
}

function getEffectiveConfigForProvider(
  providerId: string | null,
  fallback: GenerationConfig
): GenerationConfig {
  const cfgAll = loadProvidersConfig()
  if (!providerId) return fallback
  const p = cfgAll.providers.find((pp) => pp.id === providerId && pp.apiKey)
  return p ? { baseUrl: p.baseUrl, apiKey: p.apiKey } : fallback
}

function buildMidjourneyPrompt(
  prompt: string,
  aspectRatio?: string,
  mjBotType?: string
) {
  let finalPrompt = prompt
  if (mjBotType === "NIJI_JOURNEY" && !finalPrompt.includes("--niji")) {
    finalPrompt = `${finalPrompt} --niji`
  }
  if (aspectRatio && !finalPrompt.includes("--ar")) {
    finalPrompt = `${finalPrompt} --ar ${aspectRatio}`
  }
  return finalPrompt
}

// ---- Store ----
interface JobQueueState {
  jobs: Job[]
  isMaster: boolean
  concurrency: Record<JobKind, number>
  // actions
  init: () => void
  enqueueImageJob: (
    params: ImageJobParams,
    opts?: { providerId?: string | null; configFallback?: GenerationConfig }
  ) => string
  retryTimeoutJob: (jobId: string) => void
  cancelTimeoutJob: (jobId: string) => void
}

export const useJobQueue = create<JobQueueState>()(
  persist(
    (set, get) => ({
      jobs: [],
      isMaster: true,
      concurrency: DEFAULT_CONCURRENCY,

      init: () => {
        // BroadcastChannel
        if (typeof window !== "undefined" && "BroadcastChannel" in window) {
          bc = new BroadcastChannel("jobs-channel")
          bc.onmessage = (ev) => {
            const msg = ev.data as { type: string; payload?: any }
            if (!msg || !msg.type) return
            if (msg.type === "jobs:update") {
              // 接收主页面的最新作业状态
              set({ jobs: msg.payload })
            } else if (msg.type === "master:ping") {
              // 可用于调试
            }
          }
        }

        // 选主（简化）
        try {
          const raw = localStorage.getItem(MASTER_KEY)
          const rec = raw
            ? (JSON.parse(raw) as { tabId: string; ts: number })
            : null
          const nowTs = now()
          if (!rec || nowTs - rec.ts > MASTER_TTL) {
            localStorage.setItem(
              MASTER_KEY,
              JSON.stringify({ tabId: TAB_ID, ts: nowTs })
            )
            set({ isMaster: true })
          } else {
            set({ isMaster: rec.tabId === TAB_ID })
          }
        } catch {}

        // 心跳
        setInterval(() => {
          const { isMaster } = get()
          if (isMaster) {
            try {
              localStorage.setItem(
                MASTER_KEY,
                JSON.stringify({ tabId: TAB_ID, ts: now() })
              )
              // 主页面负责推进队列
              promoteQueuedIfAvailable()
              // 恢复需要的轮询
              resumeActivePollers()
              // 广播最新状态
              bc?.postMessage({ type: "jobs:update", payload: get().jobs })
            } catch {}
          } else {
            try {
              const raw = localStorage.getItem(MASTER_KEY)
              const rec = raw
                ? (JSON.parse(raw) as { tabId: string; ts: number })
                : null
              if (!rec || now() - rec.ts > MASTER_TTL) {
                // 抢主
                localStorage.setItem(
                  MASTER_KEY,
                  JSON.stringify({ tabId: TAB_ID, ts: now() })
                )
                set({ isMaster: true })
              }
            } catch {}
          }
        }, 3000)

        // 启动时恢复 processing/submitting 的轮询（仅主）
        setTimeout(() => {
          if (get().isMaster) {
            resumeActivePollers()
            promoteQueuedIfAvailable()
          }
        }, 0)
      },

      enqueueImageJob: (params, opts) => {
        const cfgAll = loadProvidersConfig()
        const providerId = opts?.providerId ?? cfgAll.selectedProviderId ?? null
        const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        const job: ImageJob = {
          id,
          kind: "image",
          status: "queued",
          providerId,
          taskId: undefined,
          progress: 0,
          createdAt: now(),
          updatedAt: now(),
          timeoutAt: now() + DEFAULT_TIMEOUT_MS,
          params,
        }
        set((s) => ({ jobs: [...s.jobs, job] }))
        // 主页面尝试推进
        setTimeout(() => {
          if (get().isMaster) {
            promoteQueuedIfAvailable()
          } else {
            // 通知主页面
            bc?.postMessage({ type: "jobs:update", payload: get().jobs })
          }
        }, 0)
        return id
      },

      retryTimeoutJob: (jobId) => {
        const { jobs, concurrency, isMaster } = get()
        const job = jobs.find(
          (j) => j.id === jobId && j.status === "timeout"
        ) as ImageJob | undefined
        if (!job) return
        // 重置超时，并尝试恢复轮询
        job.timeoutAt = now() + DEFAULT_TIMEOUT_MS
        job.updatedAt = now()
        // 若活跃 < 并发，则直接恢复；否则排队
        const activeCount = jobs.filter(
          (j) =>
            j.kind === job.kind &&
            (j.status === "submitting" || j.status === "processing")
        ).length
        if (activeCount < (concurrency[job.kind] || 6)) {
          job.status = "processing"
          startImagePolling(
            job,
            getEffectiveConfigForProvider(
              job.providerId,
              getFallbackFromProvider(job.providerId)
            )
          )
        } else {
          job.status = "queued"
        }
        set({ jobs: [...jobs] })
        if (!isMaster)
          bc?.postMessage({ type: "jobs:update", payload: get().jobs })
      },

      cancelTimeoutJob: (jobId) => {
        const { jobs, isMaster } = get()
        // 清理轮询器
        const timer = pollTimers.get(jobId)
        if (timer) {
          clearInterval(timer)
          pollTimers.delete(jobId)
        }
        set({ jobs: jobs.filter((j) => j.id !== jobId) })
        if (!isMaster)
          bc?.postMessage({ type: "jobs:update", payload: get().jobs })
      },
    }),
    { name: "jobs-v1" }
  )
)

// ---- Helpers (use store via closures) ----
function getFallbackFromProvider(_providerId: string | null): GenerationConfig {
  // fallback = 当前选中的 provider 配置；若没有，则空，调用前应校验
  const cfgAll = loadProvidersConfig()
  const sel = cfgAll.selectedProviderId
  const p = sel
    ? cfgAll.providers.find((x) => x.id === sel && x.apiKey)
    : undefined
  return p
    ? { baseUrl: p.baseUrl, apiKey: p.apiKey }
    : { baseUrl: "", apiKey: "" }
}

function promoteQueuedIfAvailable() {
  const { jobs, concurrency } = useJobQueue.getState()
  const activeImage = jobs.filter(
    (j) =>
      j.kind === "image" &&
      (j.status === "submitting" || j.status === "processing")
  ).length
  const capImage = concurrency.image || 6
  if (activeImage >= capImage) return

  // 取一个 queued 的 image 任务
  const idx = jobs.findIndex((j) => j.kind === "image" && j.status === "queued")
  if (idx >= 0) {
    const job = jobs[idx] as ImageJob
    // 启动提交
    startImageSubmission(job)
  }
}

function resumeActivePollers() {
  const { jobs } = useJobQueue.getState()
  for (const job of jobs) {
    if (job.kind === "image") {
      if (
        (job.status === "processing" || job.status === "submitting") &&
        !pollTimers.get(job.id)
      ) {
        // 若未持有 taskId，则当作重新提交（很少见，除非中断在 submitting）
        if (!job.taskId) {
          startImageSubmission(job as ImageJob)
        } else {
          const effective = getEffectiveConfigForProvider(
            job.providerId,
            getFallbackFromProvider(job.providerId)
          )
          startImagePolling(job as ImageJob, effective)
        }
      }
    }
  }
}

async function startImageSubmission(job: ImageJob) {
  const { jobs } = useJobQueue.getState()
  const effective = getEffectiveConfigForProvider(
    job.providerId,
    getFallbackFromProvider(job.providerId)
  )
  if (!effective.baseUrl || !effective.apiKey) {
    // 无配置，丢弃该任务
    useJobQueue.setState({ jobs: jobs.filter((j) => j.id !== job.id) })
    return
  }

  job.status = "submitting"
  job.updatedAt = now()
  useJobQueue.setState({ jobs: [...jobs] })

  try {
    if (job.params.service !== "midjourney") {
      // 目前仅支持 Midjourney 的异步流程；其他方式可直接同步生成再入库
      throw new Error("Only midjourney service is supported in queue v1")
    }
    const finalPrompt = buildMidjourneyPrompt(
      job.params.prompt,
      job.params.aspectRatio,
      job.params.mjBotType
    )

    const taskId = await submitMidjourneyTask(effective, {
      prompt: finalPrompt,
      base64Array: job.params.referenceImages,
      botType: job.params.mjBotType,
      modes: job.params.mjMode ? [job.params.mjMode] : undefined,
    })

    job.taskId = taskId
    job.status = "processing"
    job.progress = 10
    job.updatedAt = now()
    useJobQueue.setState({ jobs: [...useJobQueue.getState().jobs] })

    startImagePolling(job, effective)
  } catch (err: any) {
    console.error("Image job submission failed:", err?.message || err)
    // 失败直接丢弃
    useJobQueue.setState({
      jobs: useJobQueue.getState().jobs.filter((j) => j.id !== job.id),
    })
  }
}

function startImagePolling(job: ImageJob, effective: GenerationConfig) {
  // 若已有轮询先清理
  const existing = pollTimers.get(job.id)
  if (existing) clearInterval(existing)

  pollTimers.set(
    job.id,
    setInterval(async () => {
      try {
        // 超时检查
        if (now() > job.timeoutAt) {
          clearInterval(pollTimers.get(job.id)!)
          pollTimers.delete(job.id)
          job.status = "timeout"
          job.updatedAt = now()
          useJobQueue.setState({ jobs: [...useJobQueue.getState().jobs] })
          return
        }

        if (!job.taskId) return
        const result = await fetchMidjourneyTaskStatus(effective, job.taskId)
        if (typeof result.progress === "number") {
          job.progress = Math.max(job.progress, result.progress)
        }
        job.updatedAt = now()

        if (result.status === "SUCCESS") {
          // 完成
          clearInterval(pollTimers.get(job.id)!)
          pollTimers.delete(job.id)
          job.status = "saving"
          useJobQueue.setState({ jobs: [...useJobQueue.getState().jobs] })

          // 收集图片 URL
          let imgs: string[] = []
          if (result.imageUrls && result.imageUrls.length > 0) {
            imgs = result.imageUrls.map((i) => i.url)
          } else if (result.imageUrl) {
            imgs = [result.imageUrl]
          }

          try {
            const saved = await saveImagesToR2(imgs)
            job.resultUrls = saved
            job.status = "success"
            job.progress = 100
            job.updatedAt = now()
            // 将新图片推入 UI 列表（前置）
            const { generatedImages, setGeneratedImages } =
              useImageStore.getState()
            setGeneratedImages([...saved, ...generatedImages])
          } catch (e) {
            console.error("Save images to R2 failed:", e)
            // 即使保存失败，认为完成（后续通过保存队列兜底）
            job.resultUrls = imgs
            job.status = "success"
            job.progress = 100
            job.updatedAt = now()
          }

          // 完成后从队列移除
          useJobQueue.setState({
            jobs: useJobQueue.getState().jobs.filter((j) => j.id !== job.id),
          })
          // 推进下一个
          promoteQueuedIfAvailable()
          return
        }

        if (result.status === "FAILURE" || result.status === "FAILED") {
          // 失败直接丢弃
          clearInterval(pollTimers.get(job.id)!)
          pollTimers.delete(job.id)
          useJobQueue.setState({
            jobs: useJobQueue.getState().jobs.filter((j) => j.id !== job.id),
          })
          promoteQueuedIfAvailable()
          return
        }

        // 正常处理中
        useJobQueue.setState({ jobs: [...useJobQueue.getState().jobs] })
      } catch (e) {
        // 网络错误等：忽略，等待下次轮询（或由心跳恢复）
      }
    }, 5000) as unknown as number
  )
}
