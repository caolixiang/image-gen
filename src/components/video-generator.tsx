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
} from "lucide-react"
import {
  generateVideo,
  getVideoStatus,
  remixVideo,
  type VideoGenerationParams,
} from "@/lib/api/video-generation"
import {
  uploadVideoToR2,
  listStoredVideos,
  deleteStoredVideo,
  type R2Video,
} from "@/lib/api/video-storage"
import { useToast } from "@/hooks/use-toast"
import { useVideoStore } from "@/store/video-store"
import { useTaskStore } from "@/store/task-store"

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
    currentTaskId,
    setCurrentTaskId,
    storedVideos,
    setStoredVideos,
    loadingStoredVideos,
    setLoadingStoredVideos,
    isPolling,
    setIsPolling,
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

  // 轮询定时器
  const pollingTimerRef = useRef<number | null>(null)
  const pollingErrorCountRef = useRef(0)

  const getPollingConfigForTask = (
    providerId: string | null,
    fallback: { baseUrl: string; apiKey: string }
  ): { baseUrl: string; apiKey: string } => {
    if (!providerId) return fallback
    const cfgAll = loadProvidersConfig()
    const provider = cfgAll.providers.find(
      (p) => p.id === providerId && p.apiKey
    )
    return provider
      ? { baseUrl: provider.baseUrl, apiKey: provider.apiKey }
      : fallback
  }

  // 页面加载时获取已存储的视频
  useEffect(() => {
    // 只在组件首次挂载且没有已加载的视频时才加载
    if (storedVideos.length === 0 && !loadingStoredVideos) {
      loadStoredVideos()
    }

    // 如果有正在进行的任务，恢复轮询（从持久化任务存储恢复，使用提交时的 provider 配置）
    const { videoTaskId, videoProviderId } = useTaskStore.getState()
    if (videoTaskId && !pollingTimerRef.current) {
      console.log(
        "🔄 检测到未完成的视频任务，恢复轮询:",
        videoTaskId,
        "provider:",
        videoProviderId
      )
      setIsGenerating(true)
      setCurrentTaskId(videoTaskId)
      const resumeConfig = getPollingConfigForTask(videoProviderId, config)
      startPollingWithTaskId(videoTaskId, resumeConfig)
    }
  }, [])

  // 清理定时器
  useEffect(() => {
    return () => {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current)
      }
    }
  }, [])

  const loadStoredVideos = async () => {
    try {
      setLoadingStoredVideos(true)
      const videos = await listStoredVideos()
      setStoredVideos(videos)
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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setReferenceImage(reader.result as string)
      }
      reader.readAsDataURL(file)
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
      // 检查文件类型
      if (file.type === "image/jpeg" || file.type === "image/png") {
        setImageFile(file)
        const reader = new FileReader()
        reader.onloadend = () => {
          setReferenceImage(reader.result as string)
        }
        reader.readAsDataURL(file)
      } else {
        toast({
          title: "文件格式错误",
          description: "仅支持 JPG 和 PNG 格式",
          variant: "destructive",
        })
      }
    }
  }

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
      setIsGenerating(true)
      setProgress(0)
      setStatusText("正在提交任务...")
      setCurrentTaskId("")
      setCurrentVideoUrl("")
      pollingErrorCountRef.current = 0

      // 转换参数格式
      const sizeMap: Record<string, string> = {
        "9:16": "720x1280",
        "16:9": "1280x720",
        "16:9 HD": "1920x1080",
      }

      const secondsMap: Record<string, number> = {
        "15s": 15,
        "10s": 10,
      }

      const params: VideoGenerationParams = {
        prompt: description,
        imageFile: imageFile || undefined,
        model: "sora-2",
        size: sizeMap[aspectRatio],
        seconds: secondsMap[duration],
        watermark: false,
      }

      const task = await generateVideo(config.baseUrl, config.apiKey, params)

      console.log("🎬 视频生成任务返回:", task)
      console.log("🎬 Task ID:", task.id)

      setCurrentTaskId(task.id)
      setStatusText("任务已提交，正在生成视频...")

      // 写入持久化任务（记录 providerId）
      const cfgAll = loadProvidersConfig()
      useTaskStore
        .getState()
        .setTask("video", task.id, cfgAll.selectedProviderId)

      // 使用提交时的 provider 配置开始轮询
      startPollingWithTaskId(
        task.id,
        getPollingConfigForTask(cfgAll.selectedProviderId, config)
      )
    } catch (error: any) {
      setIsGenerating(false)
      setProgress(0)
      setStatusText("")

      let errorMessage = "视频生成失败"
      if (error.response) {
        errorMessage =
          error.response?.data?.message ||
          error.response?.data?.error?.message ||
          `请求失败 (${error.response.status})`
      } else if (error.request) {
        errorMessage = "网络请求超时，请检查网络连接"
      } else {
        errorMessage = error.message || "未知错误"
      }

      toast({
        title: "生成失败",
        description: errorMessage,
        variant: "destructive",
      })
    }
  }

  const startPollingWithTaskId = (
    taskId: string,
    overrideConfig?: { baseUrl: string; apiKey: string }
  ) => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current)
    }
    const effectiveConfig = overrideConfig ?? config

    setIsPolling(true) // 标记开始轮询
    pollingTimerRef.current = setInterval(async () => {
      try {
        console.log("🔄 开始轮询，taskId:", taskId)
        const task = await getVideoStatus(
          effectiveConfig.baseUrl,
          effectiveConfig.apiKey,
          taskId
        )

        const taskProgress =
          typeof task.progress === "number" ? task.progress : 0
        setProgress(Math.max(10, Math.min(100, taskProgress)))

        if (task.status === "completed") {
          // 立即清除定时器，停止轮询
          if (pollingTimerRef.current) {
            clearInterval(pollingTimerRef.current)
            pollingTimerRef.current = null
          }
          // 清除持久化任务
          useTaskStore.getState().setTask("video", null)

          setIsPolling(false) // 标记停止轮询
          setIsGenerating(false)
          setProgress(100)
          setStatusText("视频生成完成！")

          // 设置视频 URL 用于预览
          if (task.video_url) {
            console.log("🎬 视频生成完成，URL:", task.video_url)
            setCurrentVideoUrl(task.video_url)

            // 自动保存到 R2
            try {
              const result = await uploadVideoToR2(
                task.video_url,
                `${taskId}.mp4`,
                taskId
              )

              if (result.alreadyExists) {
                toast({
                  title: "视频已存在",
                  description: "该视频已在相册中，无需重复上传",
                })
              } else {
                toast({
                  title: "生成成功",
                  description: "视频生成完成并已保存到相册！",
                })
              }
            } catch (error: any) {
              console.error("保存视频到 R2 失败:", error)
              toast({
                title: "保存失败",
                description: "视频生成成功，但保存到相册失败",
                variant: "destructive",
              })
            }
          } else {
            toast({
              title: "生成成功",
              description: "视频生成完成！",
            })
          }
        } else if (task.status === "failed" || task.status === "error") {
          // 立即清除定时器，停止轮询
          if (pollingTimerRef.current) {
            clearInterval(pollingTimerRef.current)
            pollingTimerRef.current = null
          }
          // 清除持久化任务
          useTaskStore.getState().setTask("video", null)

          setIsPolling(false) // 标记停止轮询
          setIsGenerating(false)
          setProgress(0)
          setStatusText("视频生成失败")

          toast({
            title: "生成失败",
            description: "视频生成失败，请重试",
            variant: "destructive",
          })
        } else {
          const displayProgress = taskProgress > 0 ? taskProgress : 10
          setStatusText(`正在生成视频... ${displayProgress}%`)
        }
      } catch (error: any) {
        pollingErrorCountRef.current++
        if (pollingErrorCountRef.current >= 3) {
          // 重置并延时重试，直到任务成功/失败
          pollingErrorCountRef.current = 0
          if (pollingTimerRef.current) {
            clearInterval(pollingTimerRef.current)
            pollingTimerRef.current = null
          }
          const errorMsg =
            error.response?.data?.message || error.message || "查询视频状态失败"
          console.warn("轮询连续出错，5 秒后重试…", errorMsg)
          setTimeout(
            () => startPollingWithTaskId(taskId, effectiveConfig),
            5000
          )
        }
      }
    }, 5000)
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
          .replace("videos/", "")
          .replace(".mp4", "")
        // 移除时间戳前缀，保留 sora-xxx 部分
        const parts = filename.split("-")
        if (parts.length >= 2) {
          // 移除第一个时间戳部分，重新组合剩余部分
          taskId = parts.slice(1).join("-")
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

      const task = await remixVideo(config.baseUrl, config.apiKey, taskId, {
        prompt: remixPrompt,
      })

      console.log("🎬 Remix 任务返回:", task)
      console.log("🎬 Task ID:", task.id)

      setCurrentTaskId(task.id)
      setStatusText("任务已提交，正在生成视频...")
      // 记录 remix 任务到持久化并按提交时 provider 轮询
      const cfgAll = loadProvidersConfig()
      useTaskStore
        .getState()
        .setTask("video", task.id, cfgAll.selectedProviderId)
      startPollingWithTaskId(
        task.id,
        getPollingConfigForTask(cfgAll.selectedProviderId, config)
      )
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
                accept="image/jpeg,image/png"
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
                        支持 JPG、PNG 格式
                      </p>
                    </div>
                  </>
                )}
              </label>
            </CardContent>
          </Card>

          <div className="space-y-2">
            <Label
              htmlFor="video-description"
              className="text-sm font-medium"
            >
              视频描述
            </Label>
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
            disabled={isGenerating || !description.trim()}
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
          {loadingStoredVideos ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center space-y-3">
                <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  正在从存储加载视频...
                </p>
              </div>
            </div>
          ) : isGenerating && isPolling ? (
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-6">
              {/* 当前生成的视频 */}
              {currentVideoUrl && (
                <Card
                  className="overflow-hidden group hover:shadow-lg transition-all duration-300 p-0 cursor-pointer"
                  onClick={() => {
                    setSelectedVideo({
                      key: `videos/${currentTaskId}.mp4`,
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
                            a.download = `video-${currentTaskId}.mp4`
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
                            // 创建一个临时的 R2Video 对象用于 Remix
                            const tempVideo: R2Video = {
                              key: `videos/${currentTaskId}.mp4`,
                              url: currentVideoUrl,
                              uploaded: new Date().toISOString(),
                              size: 0,
                              metadata: {
                                taskId: currentTaskId,
                              },
                            }
                            handleRemixClick(tempVideo)
                          }}
                          size="sm"
                          className="h-8 w-8 p-0 bg-purple-600 hover:bg-purple-700 text-white shadow-lg"
                        >
                          <Sparkles className="w-4 h-4" />
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
