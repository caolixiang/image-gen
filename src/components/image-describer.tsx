import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
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
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import {
  submitMidjourneyDescribe,
  pollMidjourneyDescribe,
} from "@/lib/api/image-description"

interface ImageDescriberProps {
  config: {
    baseUrl: string
    apiKey: string
  }
}

export function ImageDescriber({ config }: ImageDescriberProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [description, setDescription] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [taskId, setTaskId] = useState<string | null>(null)
  const [taskStatus, setTaskStatus] = useState<string>("")
  const [progress, setProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 解析描述，分割成 4 段
  const parseDescriptions = (text: string): string[] => {
    const regex = /[1-4]️⃣\s*/g
    const parts = text.split(regex).filter(part => part.trim())
    return parts.length > 0 ? parts : []
  }

  const descriptions = description ? parseDescriptions(description) : []

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setSelectedImage(e.target?.result as string)
        setDescription(null)
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

    if (!selectedImage) {
      setError("请先选择一张图片")
      return
    }

    setLoading(true)
    setError(null)
    setTaskStatus("")
    setProgress(0)
    setDescription(null)

    try {
      // 1. 提交 Describe 任务
      setTaskStatus("SUBMITTING")
      const id = await submitMidjourneyDescribe(config, {
        base64: selectedImage,
      })

      setTaskId(id)
      setTaskStatus("SUBMITTED")
      setProgress(10)

      // 2. 轮询任务状态并获取描述
      const prompt = await pollMidjourneyDescribe(
        config,
        id,
        (status, currentProgress) => {
          setTaskStatus(status)
          setProgress(currentProgress)
        }
      )

      setDescription(prompt)
    } catch (err) {
      setError(err instanceof Error ? err.message : "描述生成失败")
      console.error("Image description error:", err)
    } finally {
      setLoading(false)
      setTaskStatus("")
      setProgress(0)
    }
  }

  const handleCopy = async (text: string, index: number) => {
    await navigator.clipboard.writeText(text)
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex(null), 2000)
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
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>图片</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />

            {selectedImage ? (
              <div className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                <img
                  src={selectedImage || "/placeholder.svg"}
                  alt="Selected"
                  className="w-full h-full object-cover"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  className="absolute bottom-2 right-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  更换图片
                </Button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full aspect-square rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center bg-muted/20 hover:bg-muted/40 transition-colors"
              >
                <Upload className="w-12 h-12 mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">点击上传图片</p>
              </button>
            )}
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* 进度显示 */}
          {loading && taskStatus && (
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
            disabled={loading || !selectedImage}
            className="w-full"
            size="lg"
          >
            {loading ? (
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
        <CardContent>
          {descriptions.length > 0 ? (
            <div className="space-y-4">
              {descriptions.map((desc, index) => (
                <Card key={index} className="border-2">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-semibold text-primary">
                          {index + 1}️⃣
                        </span>
                        <span className="text-sm font-medium text-muted-foreground">
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
                    <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                      {desc.trim()}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="aspect-square rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/20">
              <div className="text-center text-muted-foreground">
                <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">暂无生成的描述</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
