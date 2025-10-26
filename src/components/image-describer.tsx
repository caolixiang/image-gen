import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Loader2,
  Upload,
  ImageIcon,
  AlertCircle,
  Copy,
  Check,
  Trash2,
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import {
  submitMidjourneyDescribe,
  fetchMidjourneyDescribeResult,
} from "@/lib/api/image-description"
import { useDescribeStore } from "@/store/describe-store"

interface ImageDescriberProps {
  config: {
    baseUrl: string
    apiKey: string
  }
}

export function ImageDescriber({ config }: ImageDescriberProps) {
  // Zustand store - 持久化状态
  const {
    previewUrl, setPreviewUrl,
    description, setDescription,
    isAnalyzing, setIsAnalyzing,
    taskId, setTaskId,
    setIsPolling,
  } = useDescribeStore()
  
  // Local UI state - 不需要持久化
  const [error, setError] = useState<string | null>(null)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [taskStatus, setTaskStatus] = useState<string>("")
  const [progress, setProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // 轮询定时器
  const pollingTimerRef = useRef<number | null>(null)
  const pollingErrorCountRef = useRef(0)

  // 解析描述，分割成 4 段
  const parseDescriptions = (text: string): string[] => {
    const regex = /[1-4]️⃣\s*/g
    const parts = text.split(regex).filter(part => part.trim())
    return parts.length > 0 ? parts : []
  }

  const descriptions = description ? parseDescriptions(description) : []

  // 恢复轮询
  useEffect(() => {
    if (taskId && isAnalyzing && !pollingTimerRef.current) {
      console.log('🔄 检测到未完成的描述任务，恢复轮询:', taskId)
      startPollingWithTaskId(taskId)
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

  // 轮询函数
  const startPollingWithTaskId = (taskId: string) => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current)
    }

    setIsPolling(true)
    pollingErrorCountRef.current = 0

    pollingTimerRef.current = setInterval(async () => {
      try {
        console.log('🔄 轮询描述任务状态，taskId:', taskId)
        const result = await fetchMidjourneyDescribeResult(config, taskId)

        // 更新进度
        if (result.progress !== undefined) {
          setProgress(result.progress)
        }
        setTaskStatus(result.status)

        // 成功
        if (result.status === "SUCCESS") {
          if (pollingTimerRef.current) {
            clearInterval(pollingTimerRef.current)
            pollingTimerRef.current = null
          }
          setIsPolling(false)
          setIsAnalyzing(false)
          setProgress(100)
          
          if (result.prompt) {
            console.log('✅ 图片描述完成')
            setDescription(result.prompt)
          } else {
            setError("未能获取到描述内容")
          }
        }
        // 失败
        else if (result.status === "FAILURE" || result.status === "FAILED") {
          if (pollingTimerRef.current) {
            clearInterval(pollingTimerRef.current)
            pollingTimerRef.current = null
          }
          setIsPolling(false)
          setIsAnalyzing(false)
          setProgress(0)
          setError("描述生成失败")
        }
      } catch (error: any) {
        pollingErrorCountRef.current++
        console.error('❌ 轮询错误:', error)
        
        if (pollingErrorCountRef.current >= 3) {
          if (pollingTimerRef.current) {
            clearInterval(pollingTimerRef.current)
            pollingTimerRef.current = null
          }
          setIsPolling(false)
          setIsAnalyzing(false)
          setError(error.message || "查询任务状态失败")
        }
      }
    }, 3000) // 每 3 秒轮询一次
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string)
        setDescription('')
        setError(null)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleDescribe = async () => {
    if (!config.baseUrl || !config.apiKey) {
      setError("请先在设置中配置 API 信息")
      return
    }

    if (!previewUrl) {
      setError("请先选择一张图片")
      return
    }

    setIsAnalyzing(true)
    setError(null)
    setTaskStatus("")
    setProgress(0)
    setDescription('')

    try {
      // 1. 提交 Describe 任务
      setTaskStatus("SUBMITTING")
      const id = await submitMidjourneyDescribe(config, {
        base64: previewUrl,
      })

      setTaskId(id)
      setTaskStatus("SUBMITTED")
      setProgress(10)

      // 2. 使用新的轮询方式（setInterval）
      console.log('🎬 开始轮询图片描述，taskId:', id)
      startPollingWithTaskId(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "描述生成失败")
      console.error("Image description error:", err)
      setIsAnalyzing(false)
      setTaskStatus("")
      setProgress(0)
    }
  }

  const handleCopy = async (text: string, index: number) => {
    await navigator.clipboard.writeText(text)
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  // 处理拖拽上传
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      const file = files[0]
      // 检查是否为图片
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onloadend = () => {
          setPreviewUrl(reader.result as string)
          setDescription('')
          setError(null)
        }
        reader.readAsDataURL(file)
      } else {
        setError("请上传图片文件")
      }
    }
  }

  const removeImage = () => {
    setPreviewUrl('')
    setDescription('')
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>上传图片</CardTitle>
          <CardDescription>
            上传图片，AI 将为您生成详细的提示词描述
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Card className="border-2 border-dashed border-muted-foreground/25 bg-muted/30 hover:border-primary/50 transition-colors">
            <CardContent className="p-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />

              {previewUrl ? (
                <div className="flex justify-center">
                  <div className="relative">
                    <img
                      src={previewUrl || "/placeholder.svg"}
                      alt="Selected"
                      className="w-48 h-48 object-cover rounded-lg cursor-pointer"
                      onClick={() => fileInputRef.current?.click()}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="absolute top-1 right-1 h-7 w-7 bg-black/70 hover:bg-black/90 text-white"
                      onClick={removeImage}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className="w-full h-48 rounded-lg flex flex-col items-center justify-center cursor-pointer"
                >
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                    <Upload className="w-8 h-8 text-primary" />
                  </div>
                  <p className="text-sm font-medium text-foreground">点击或拖拽图片到此处</p>
                  <p className="text-xs text-muted-foreground mt-1">支持 JPG、PNG 格式</p>
                </div>
              )}
            </CardContent>
          </Card>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* 进度显示 */}
          {isAnalyzing && taskStatus && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">分析进度</span>
                <span className="font-medium">
                  {taskStatus === "SUBMITTING" && "提交中..."}
                  {taskStatus === "SUBMITTED" && "已提交"}
                  {taskStatus === "PROCESSING" && "分析中..."}
                  {taskStatus === "SUCCESS" && "完成"}
                  {![
                    "SUBMITTING",
                    "SUBMITTED",
                    "PROCESSING",
                    "SUCCESS",
                  ].includes(taskStatus) && taskStatus}
                </span>
              </div>
              <Progress
                value={progress}
                className="h-2"
              />
              {taskId && (
                <p className="text-xs text-muted-foreground">
                  任务 ID: {taskId}
                </p>
              )}
            </div>
          )}

          <Button
            onClick={handleDescribe}
            disabled={isAnalyzing || !previewUrl}
            className="w-full"
            size="lg"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                分析中...
              </>
            ) : (
              <>
                <ImageIcon className="w-4 h-4 mr-2" />
                描述图片
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>生成的提示词</CardTitle>
          <CardDescription>AI 为您的图片生成的 {descriptions.length} 个详细描述</CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          {descriptions.length > 0 ? (
            <div className="space-y-3">
              {descriptions.map((desc, index) => (
                <Card key={index} className="border-2">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-semibold text-primary">
                          {index + 1}️⃣
                        </span>
                        <span className="text-xs font-medium text-muted-foreground">
                          描述 {index + 1}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopy(desc.trim(), index)}
                      >
                        {copiedIndex === index ? (
                          <>
                            <Check className="w-4 h-4 mr-1" />
                            已复制
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4 mr-1" />
                            复制
                          </>
                        )}
                      </Button>
                    </div>
                    <p className="text-xs leading-relaxed text-foreground whitespace-pre-wrap">
                      {desc.trim()}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="h-32 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/20">
              <div className="text-center text-muted-foreground">
                <ImageIcon className="w-8 h-8 mx-auto mb-1 opacity-50" />
                <p className="text-xs">暂无生成的描述</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
