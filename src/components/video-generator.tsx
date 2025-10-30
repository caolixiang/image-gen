"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Upload,
  Video,
  X,
  Loader2,
  Download,
  Trash2,
  Sparkles,
  RotateCcw,
} from "lucide-react"
import {
  listStoredVideosPage,
  deleteStoredVideo,
  type R2Video,
} from "@/lib/api/video-storage"
import { useToast } from "@/hooks/use-toast"
import { useVideoStore } from "@/store/video-store"
import { useJobQueue } from "@/store/job-queue"

interface VideoGeneratorProps {
  config: {
    baseUrl: string
    apiKey: string
  }
}

import { loadProvidersConfig } from "@/lib/storage"

export function VideoGenerator({ config }: VideoGeneratorProps) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Zustand store - 持久化状态
  const {
    description,
    setDescription,
    aspectRatio,
    setAspectRatio,
    duration,
    setDuration,
    isGenerating,
    setIsGenerating,
    progress,
    setProgress,
    statusText,
    setStatusText,
    currentVideoUrl,
    setCurrentVideoUrl,
    storedVideos,
    setStoredVideos,
    loadingStoredVideos,
    setLoadingStoredVideos,
  } = useVideoStore()

  // Local UI state - 不需要持久化
  const [referenceImage, setReferenceImage] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [selectedVideo, setSelectedVideo] = useState<R2Video | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isRemixDialogOpen, setIsRemixDialogOpen] = useState(false)
  const [remixPrompt, setRemixPrompt] = useState("")
  const [remixingVideo, setRemixingVideo] = useState<R2Video | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [deletingVideo, setDeletingVideo] = useState<{
    video: R2Video
    index: number
  } | null>(null)

  // 分页状态（仅组件内）
  const [videoNextCursor, setVideoNextCursor] = useState<string | undefined>(
    undefined
  )
  // avoid unused warning for imageFile (only used to preview referenceImage)
  void imageFile

  const [videoHasMore, setVideoHasMore] = useState(false)
  const [loadingMoreVideos, setLoadingMoreVideos] = useState(false)

  // Job queue hooks (video)
  const { jobs, enqueueVideoJob, retryTimeoutJob, cancelTimeoutJob, init } =
    useJobQueue()
  useEffect(() => {
    init()
  }, [])

  const inProgressVideoJobs = jobs.filter(
    (j) =>
      j.kind === "video" &&
      ["queued", "submitting", "processing", "saving", "timeout"].includes(
        j.status
      )
  )

  // 页面加载时获取已存储的视频
  useEffect(() => {
    // 只在组件首次挂载且没有已加载的视频时才加载
    if (storedVideos.length === 0 && !loadingStoredVideos) {
      loadStoredVideos()
    }
  }, [])

  const loadStoredVideos = async () => {
    try {
      setLoadingStoredVideos(true)
      const page = await listStoredVideosPage(100)
      setStoredVideos(page.videos)
      setVideoHasMore(page.truncated)
      setVideoNextCursor(page.cursor)
    } catch (error) {
      console.error("Failed to load stored videos:", error)
      toast({
        title: "加载失败",
        description: "无法加载已保存的视频",
        variant: "destructive",
      })
    } finally {
      setLoadingStoredVideos(false)
    }
  }

  // 统一加载图片到参考图（支持 JPG/PNG/WEBP）
  const loadFileToReference = (file: File) => {
    const type = (file.type || "").toLowerCase()
    const ok =
      type === "image/jpeg" || type === "image/png" || type === "image/webp"
    if (!ok) {
      toast({
        title: "文件格式错误",
        description: "仅支持 JPG、PNG、WEBP 格式",
        variant: "destructive",
      })
      return
    }
    setImageFile(file)
    const reader = new FileReader()
    reader.onloadend = () => {
      setReferenceImage(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      loadFileToReference(file)
    }
  }

  const removeImage = () => {
    setImageFile(null)
    setReferenceImage(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  // 处理拖拽上传
  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDragEnter = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    e.stopPropagation()

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      const file = files[0]
      loadFileToReference(file)
    }
  }

  // 支持直接粘贴图片（全局监听 paste）
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items || items.length === 0) return
      for (const item of Array.from(items)) {
        if (item.type && item.type.startsWith("image/")) {
          const file = item.getAsFile()
          if (file) {
            e.preventDefault()
            loadFileToReference(file)
            toast({ title: "已粘贴图片", description: "已作为参考图添加" })
            break
          }
        }
      }
    }
    window.addEventListener("paste", onPaste as any)
    return () => window.removeEventListener("paste", onPaste as any)
  }, [])

  const handleGenerate = async () => {
    if (!config.baseUrl || !config.apiKey) {
      toast({
        title: "配置错误",
        description: "请先配置 API 设置",
        variant: "destructive",
      })
      return
    }

    if (!description.trim()) {
      toast({
        title: "输入错误",
        description: "请输入视频生成提示词",
        variant: "destructive",
      })
      return
    }

    try {
      const cfgAll = loadProvidersConfig()
      enqueueVideoJob(
        {
          prompt: description,
          referenceImageBase64: referenceImage || undefined,
          aspectRatio,
          duration,
          model: "sora-2",
        },
        { providerId: cfgAll.selectedProviderId, configFallback: config }
      )
      toast({
        title: "已加入队列",
        description: "占位已显示，完成后自动保存到相册",
      })
    } catch (error: any) {
      const errorMessage =
        (error?.message && typeof error.message === "string"
          ? error.message
          : "视频生成任务提交失败") || "视频生成任务提交失败"
      toast({
        title: "出错了",
        description: errorMessage,
        variant: "destructive",
      })
    }
  }

  const handleDeleteClick = (video: R2Video, index: number) => {
    setDeletingVideo({ video, index })
    setIsDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!deletingVideo) return

    try {
      await deleteStoredVideo(deletingVideo.video.key)
      setStoredVideos(storedVideos.filter((_, i) => i !== deletingVideo.index))
      setIsDeleteDialogOpen(false)
      setDeletingVideo(null)
      toast({
        title: "删除成功",
        description: "视频已从相册中删除",
      })
    } catch (error: any) {
      toast({
        title: "删除失败",
        description: error.message || "未知错误",
        variant: "destructive",
      })
    }
  }

  // 加载更多（分页）
  const handleLoadMoreVideos = async () => {
    if (!videoHasMore || loadingMoreVideos) return
    try {
      setLoadingMoreVideos(true)
      const page = await listStoredVideosPage(100, videoNextCursor)
      setStoredVideos([...storedVideos, ...page.videos])
      setVideoHasMore(page.truncated)
      setVideoNextCursor(page.cursor)
    } catch (error) {
      console.error("Failed to load more videos:", error)
      toast({
        title: "加载失败",
        description: "无法加载更多视频",
        variant: "destructive",
      })
    } finally {
      setLoadingMoreVideos(false)
    }
  }

  const handleVideoClick = (video: R2Video) => {
    setSelectedVideo(video)
    setIsModalOpen(true)
  }

  const handleRemixClick = (video: R2Video) => {
    setRemixingVideo(video)
    setRemixPrompt("")
    setIsRemixDialogOpen(true)
  }

  const handleRemixSubmit = async () => {
    if (!remixingVideo || !remixPrompt.trim()) {
      toast({
        title: "请输入描述",
        description: "Remix 需要输入新的描述",
        variant: "destructive",
      })
      return
    }

    try {
      setIsRemixDialogOpen(false)
      setIsGenerating(true)
      setProgress(0)
      setStatusText("提交 Remix 任务...")

      // 从 R2Video 的 metadata 中获取 taskId，如果没有则从文件名提取
      let taskId = remixingVideo.metadata?.taskId

      if (!taskId) {
        // 从文件名提取：videos/1761507295048-sora-2:task_01k8gzyem5e3fbt38yvtpkta6g.mp4
        const filename = remixingVideo.key
          .replace(/^videos\//, "")
          .replace(/\.mp4$/i, "")
        // 仅当存在时间戳(纯数字)前缀时才移除；否则保留完整 taskId（如 sora-2:task_xxx）
        const parts = filename.split("-")
        if (parts.length >= 2 && /^\d{10,}$/.test(parts[0])) {
          taskId = parts.slice(1).join("-")
        } else {
          taskId = filename
        }
      }

      console.log("🎬 Remix 调试信息:", {
        videoKey: remixingVideo.key,
        metadata: remixingVideo.metadata,
        extractedTaskId: taskId,
      })

      if (!taskId) {
        throw new Error("无法获取视频的原始任务 ID")
      }

      console.log("🎬 使用 taskId 进行 Remix:", taskId)

      const cfgAll = loadProvidersConfig()
      enqueueVideoJob(
        {
          prompt: remixPrompt,
          remixOfTaskId: taskId,
          model: "sora-2",
        },
        { providerId: cfgAll.selectedProviderId, configFallback: config }
      )

      setIsGenerating(false)
      setStatusText("Remix 任务已加入队列")
      toast({
        title: "已加入队列",
        description: "完成后会自动保存到相册",
      })
    } catch (error: any) {
      setIsGenerating(false)
      toast({
        title: "Remix 失败",
        description: error.message || "未知错误",
        variant: "destructive",
      })
    }
  }

  const aspectRatios = [
    { label: "9:16", value: "9:16" },
    { label: "16:9", value: "16:9" },
    { label: "16:9 HD", value: "16:9 HD" },
  ]

  const durations = [
    { label: "15s", value: "15s" },
    { label: "10s", value: "10s" },
  ]

  return (
    <div className="grid lg:grid-cols-2 gap-6 max-w-7xl mx-auto">
      {/* Left Panel - Input */}
      <Card>
        <CardHeader>
          <CardTitle>视频生成</CardTitle>
          <CardDescription>使用 AI 生成视频，可选参考图片</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Card className="border-2 border-dashed border-muted-foreground/25 bg-muted/30 hover:border-primary/50 transition-colors">
            <CardContent className="p-4">
              <input
                type="file"
                id="video-image-upload"
                ref={fileInputRef}
                className="hidden"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleImageUpload}
              />
              <label
                htmlFor="video-image-upload"
                className="flex flex-col items-center justify-center cursor-pointer h-48"
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {referenceImage ? (
                  <div className="flex justify-center">
                    <div className="relative">
                      <img
                        src={referenceImage}
                        alt="Reference"
                        className="w-48 h-48 object-cover rounded-lg"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="absolute top-1 right-1 h-7 w-7 bg-black/70 hover:bg-black/90 text-white"
                        onClick={(e) => {
                          e.preventDefault()
                          removeImage()
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <Upload className="w-8 h-8 text-primary" />
                    </div>
                    <div className="text-center space-y-1 mt-3">
                      <p className="text-sm font-medium">
                        点击或拖拽图片到此处
                      </p>
                      <p className="text-xs text-muted-foreground">
                        支持 JPG、PNG、WEBP（可直接粘贴/拖拽）
                      </p>
                    </div>
                  </>
                )}
              </label>
            </CardContent>
          </Card>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="video-description"
                className="text-sm font-medium"
              >
                视频描述
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDescription("")}
                disabled={!description.trim()}
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> 清空
              </Button>
            </div>
            <Textarea
              id="video-description"
              placeholder="请描述你想要生成的视频内容..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-20 resize-none"
              maxLength={6000}
            />
            <div className="text-xs text-muted-foreground text-right">
              {description.length}/6000 字符
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-sm font-medium">宽高比</Label>
              <div className="flex gap-2">
                {aspectRatios.map((ratio) => (
                  <Button
                    key={ratio.value}
                    variant={
                      aspectRatio === ratio.value ? "default" : "outline"
                    }
                    size="sm"
                    onClick={() => setAspectRatio(ratio.value)}
                    className="flex-1 h-8 text-xs"
                  >
                    {ratio.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-sm font-medium">时长</Label>
              <div className="flex gap-2">
                {durations.map((dur) => (
                  <Button
                    key={dur.value}
                    variant={duration === dur.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDuration(dur.value)}
                    className="flex-1 h-8 text-xs"
                  >
                    {dur.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={!description.trim()}
            className="w-full h-10 text-sm"
            size="lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Video className="w-5 h-5 mr-2" />
                生成视频
              </>
            )}
          </Button>

          {/* Progress Bar */}
          {isGenerating && (
            <div className="space-y-1">
              <div className="w-full bg-secondary rounded-full h-1">
                <div
                  className="bg-primary h-1 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                {statusText}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Right Panel - Results */}
      <Card>
        <CardHeader>
          <CardTitle>生成结果</CardTitle>
          <CardDescription>
            {loadingStoredVideos
              ? "正在从存储加载视频..."
              : storedVideos.length > 0
              ? `已保存 ${storedVideos.length} 个视频`
              : "你生成的视频将显示在这里"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {inProgressVideoJobs.length > 0 && (
            <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
              {inProgressVideoJobs.map((job) => (
                <Card
                  key={job.id}
                  className="overflow-hidden p-0"
                >
                  <CardContent className="p-0">
                    <div className="bg-muted relative h-64 w-full">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <div className="w-full bg-secondary rounded-full h-1">
                          <div
                            className="bg-primary h-1 rounded-full transition-all duration-300"
                            style={{
                              width: `${Math.round(job.progress ?? 0)}%`,
                            }}
                          />
                        </div>
                        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                          <span>
                            {job.status === "queued"
                              ? "排队中"
                              : job.status === "submitting"
                              ? "提交中"
                              : job.status === "processing"
                              ? "生成中"
                              : job.status === "saving"
                              ? "保存中"
                              : job.status === "timeout"
                              ? "已超时"
                              : job.status}
                          </span>
                          <span>{Math.round(job.progress ?? 0)}%</span>
                        </div>
                      </div>
                      {job.status === "timeout" && (
                        <div className="absolute top-2 right-2 flex gap-2">
                          <Button
                            onClick={(e) => {
                              e.stopPropagation()
                              retryTimeoutJob(job.id)
                            }}
                            size="sm"
                            className="h-8 w-8 p-0"
                            variant="secondary"
                            title="重试"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </Button>
                          <Button
                            onClick={(e) => {
                              e.stopPropagation()
                              cancelTimeoutJob(job.id)
                            }}
                            size="sm"
                            className="h-8 w-8 p-0"
                            variant="destructive"
                            title="取消"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          {loadingStoredVideos ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center space-y-3">
                <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  正在从存储加载视频...
                </p>
              </div>
            </div>
          ) : isGenerating ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center space-y-3">
                <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
                <p className="text-sm font-medium">{statusText}</p>
                <p className="text-xs text-muted-foreground">
                  切换标签后，视频会继续在后台生成
                </p>
              </div>
            </div>
          ) : currentVideoUrl || storedVideos.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
                {/* 当前生成的视频 */}
                {currentVideoUrl && (
                  <Card
                    className="overflow-hidden group hover:shadow-lg transition-all duration-300 p-0 cursor-pointer"
                    onClick={() => {
                      setSelectedVideo({
                        key: `videos/current.mp4`,
                        url: currentVideoUrl,
                        uploaded: new Date().toISOString(),
                        size: 0,
                      })
                      setIsModalOpen(true)
                    }}
                  >
                    <CardContent className="p-0">
                      <div className="bg-muted relative h-64 w-full">
                        <video
                          className="w-full h-full object-cover"
                          src={currentVideoUrl}
                          muted
                        />
                        {/* 右上角按钮组 - 鼠标悬停时显示 */}
                        <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <Button
                            onClick={(e) => {
                              e.stopPropagation()
                              const a = document.createElement("a")
                              a.href = currentVideoUrl
                              a.download = `video.mp4`
                              a.click()
                            }}
                            size="sm"
                            className="h-8 w-8 p-0 bg-blue-600 hover:bg-blue-700 text-white shadow-lg"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button
                            onClick={(e) => {
                              e.stopPropagation()
                              setCurrentVideoUrl("")
                            }}
                            size="sm"
                            className="h-8 w-8 p-0 bg-gray-600 hover:bg-gray-700 text-white shadow-lg"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* 已保存的视频 */}
                {storedVideos.map((video, index) => (
                  <Card
                    key={video.key}
                    className="overflow-hidden group hover:shadow-lg transition-all duration-300 p-0 cursor-pointer"
                    onClick={() => handleVideoClick(video)}
                  >
                    <CardContent className="p-0">
                      <div className="bg-muted relative h-64 w-full">
                        <video
                          className="w-full h-full object-cover"
                          src={video.url}
                          muted
                        />
                        {/* 右上角按钮组 - 鼠标悬停时显示 */}
                        <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <Button
                            onClick={(e) => {
                              e.stopPropagation()
                              const a = document.createElement("a")
                              a.href = video.url
                              a.download =
                                video.key.split("/").pop() || "video.mp4"
                              a.click()
                            }}
                            size="sm"
                            className="h-8 w-8 p-0 bg-blue-600 hover:bg-blue-700 text-white shadow-lg"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRemixClick(video)
                            }}
                            size="sm"
                            className="h-8 w-8 p-0 bg-purple-600 hover:bg-purple-700 text-white shadow-lg"
                          >
                            <Sparkles className="w-4 h-4" />
                          </Button>
                          <Button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteClick(video, index)
                            }}
                            size="sm"
                            className="h-8 w-8 p-0 bg-red-600 hover:bg-red-700 text-white shadow-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {videoHasMore && (
                <div className="flex justify-center mt-4">
                  <Button
                    onClick={handleLoadMoreVideos}
                    disabled={loadingMoreVideos}
                    variant="outline"
                  >
                    {loadingMoreVideos ? (
                      <span className="flex items-center">
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        加载中...
                      </span>
                    ) : (
                      <>加载更多</>
                    )}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="h-32 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/20">
              <div className="text-center text-muted-foreground">
                <Video className="w-8 h-8 mx-auto mb-1 opacity-50" />
                <p className="text-xs">还没有生成视频</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 视频播放模态框 */}
      <Dialog
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
      >
        <DialogContent className="max-w-3xl p-0 gap-0 border-0 bg-black [&>button]:hidden">
          {selectedVideo && (
            <video
              className="w-full h-full max-h-[80vh] object-contain rounded-lg"
              src={selectedVideo.url}
              controls
              autoPlay
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Remix 对话框 */}
      <Dialog
        open={isRemixDialogOpen}
        onOpenChange={setIsRemixDialogOpen}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              Remix 视频
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="remix-prompt">新的描述</Label>
              <Textarea
                id="remix-prompt"
                value={remixPrompt}
                onChange={(e) => setRemixPrompt(e.target.value)}
                placeholder="输入新的描述来重新生成视频..."
                className="min-h-24"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleRemixSubmit}
                className="flex-1 bg-purple-600 hover:bg-purple-700"
                disabled={!remixPrompt.trim()}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                开始 Remix
              </Button>
              <Button
                onClick={() => setIsRemixDialogOpen(false)}
                variant="outline"
                className="flex-1"
              >
                取消
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              确认删除视频
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">
              确定要删除这个视频吗？此操作无法撤销。
            </p>
            <div className="flex gap-2">
              <Button
                onClick={handleDeleteConfirm}
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                确认删除
              </Button>
              <Button
                onClick={() => setIsDeleteDialogOpen(false)}
                variant="outline"
                className="flex-1"
              >
                取消
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
