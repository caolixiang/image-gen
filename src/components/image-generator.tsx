import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Loader2,
  Wand2,
  Download,
  AlertCircle,
  Upload,
  X,
  Zap,
  Sparkles,
  Trash2,
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { Slider } from "@/components/ui/slider"
import {
  generateWithNanoBanana,
  submitMidjourneyTask,
  pollMidjourneyTask,
  saveImagesToR2,
} from "@/lib/api/image-generation"
import { proxyImageUrl } from "@/lib/proxy-image"
import { listStoredImages, deleteStoredImage } from "@/lib/api/image-storage"

interface ImageGeneratorProps {
  config: {
    baseUrl: string
    apiKey: string
  }
}

type ServiceType = "nano-banana" | "midjourney"

export function ImageGenerator({ config }: ImageGeneratorProps) {
  // Basic states
  const [prompt, setPrompt] = useState("")
  const [model, setModel] = useState("gemini-2.5-flash-image")
  const [loading, setLoading] = useState(false)
  const [generatedImages, setGeneratedImages] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [referenceImages, setReferenceImages] = useState<string[]>([])
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [loadingStoredImages, setLoadingStoredImages] = useState(true)

  // Service selection
  const [serviceType, setServiceType] = useState<ServiceType>("midjourney")

  // nano-banana specific states
  const [generationCount, setGenerationCount] = useState(1)
  const [imageSize, setImageSize] = useState("1024x1024")

  // Midjourney specific states
  const [taskId, setTaskId] = useState<string | null>(null)
  const [taskStatus, setTaskStatus] = useState<string>("")
  const [progress, setProgress] = useState(0)
  const [mjBotType, setMjBotType] = useState("MID_JOURNEY")
  const [mjMode, setMjMode] = useState<string>("RELAX")
  const [aspectRatio, setAspectRatio] = useState<string>("")

  // 页面加载时从 R2 获取已生成的图片
  useEffect(() => {
    const loadStoredImages = async () => {
      try {
        setLoadingStoredImages(true)
        const images = await listStoredImages(50) // 加载最近 50 张图片
        setGeneratedImages(images)
      } catch (error) {
        console.error('Failed to load stored images:', error)
      } finally {
        setLoadingStoredImages(false)
      }
    }

    loadStoredImages()
  }, []) // 空依赖数组，只在组件挂载时执行一次

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    Array.from(files).forEach((file) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        setReferenceImages((prev) => [...prev, reader.result as string])
      }
      reader.readAsDataURL(file)
    })
  }

  const removeReferenceImage = (index: number) => {
    setReferenceImages((prev) => prev.filter((_, i) => i !== index))
  }

  // nano-banana 生成处理
  const handleNanoBananaGeneration = async () => {
    // 调用 API 生成图片
    const imageUrls = await generateWithNanoBanana(config, {
      model,
      prompt,
      n: generationCount,
      size: imageSize,
    })

    // 保存到 R2
    const savedImages = await saveImagesToR2(imageUrls)
    // 将新图片添加到现有图片列表的前面
    setGeneratedImages(prev => [...savedImages, ...prev])
  }

  // Midjourney 生成处理
  const handleMidjourneyGeneration = async () => {
    setProgress(0)
    setTaskStatus("SUBMITTING")

    // 处理 prompt：添加相关参数
    let finalPrompt = prompt
    
    // 如果是 NIJI bot，添加 --niji 参数
    if (mjBotType === "NIJI_JOURNEY" && !prompt.includes("--niji")) {
      finalPrompt = `${finalPrompt} --niji`
    }
    
    // 如果选择了比例，添加 --ar 参数
    if (aspectRatio && !prompt.includes("--ar")) {
      finalPrompt = `${finalPrompt} --ar ${aspectRatio}`
    }

    // 1. 提交任务
    const id = await submitMidjourneyTask(config, {
      prompt: finalPrompt,
      base64Array: referenceImages,
      botType: mjBotType,
      modes: mjMode ? [mjMode] : undefined,
    })

    setTaskId(id)
    setTaskStatus("SUBMITTED")
    setProgress(10)

    // 2. 轮询任务状态
    // 3. 轮询并获取图片 URLs（4张独立图片）
    const imageUrls = await pollMidjourneyTask(
      config,
      id,
      (status, progress) => {
        setTaskStatus(status)
        setProgress(progress)
      }
    )

    // 4. 保存所有图片到 R2
    const savedImages = await saveImagesToR2(imageUrls)
    // 将新图片添加到现有图片列表的前面
    setGeneratedImages(prev => [...savedImages, ...prev])
  }

  // 主生成处理函数
  const handleGenerate = async () => {
    if (!config.baseUrl || !config.apiKey) {
      setError("请先在设置中配置 API 信息")
      return
    }

    if (!prompt.trim()) {
      setError("请输入提示词")
      return
    }

    setLoading(true)
    setError(null)
    setTaskStatus("")
    setProgress(0)

    try {
      if (serviceType === "nano-banana") {
        await handleNanoBananaGeneration()
      } else {
        await handleMidjourneyGeneration()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成失败")
      console.error("Image generation error:", err)
    } finally {
      setLoading(false)
      setTaskStatus("")
      setProgress(0)
    }
  }

  // 下载图片 - 支持跨域图片下载
  const handleDownload = async (imageUrl: string, index: number) => {
    try {
      // 获取图片数据
      const response = await fetch(imageUrl)
      const blob = await response.blob()

      // 创建本地 blob URL
      const blobUrl = URL.createObjectURL(blob)

      // 创建下载链接
      const link = document.createElement("a")
      link.href = blobUrl
      link.download = `generated-${Date.now()}-${index}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      // 释放 blob URL
      setTimeout(() => URL.revokeObjectURL(blobUrl), 100)
    } catch (error) {
      console.error("下载失败:", error)
      // 降级：尝试直接打开（对于本地图片）
      const link = document.createElement("a")
      link.href = imageUrl
      link.download = `generated-${Date.now()}-${index}.png`
      link.target = "_blank"
      link.click()
    }
  }

  // 删除图片
  const handleDelete = async (imageUrl: string, index: number) => {
    if (!confirm("确定要删除这张图片吗？此操作无法撤销。")) {
      return
    }

    try {
      const success = await deleteStoredImage(imageUrl)
      
      if (success) {
        // 从列表中移除该图片
        setGeneratedImages(prev => prev.filter((_, i) => i !== index))
      } else {
        alert("删除失败，请重试")
      }
    } catch (error) {
      console.error("删除失败:", error)
      alert("删除失败，请重试")
    }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Generate Image</CardTitle>
          <CardDescription>
            Create stunning images from text descriptions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Service Type Selector */}
          <div className="space-y-2">
            <Label htmlFor="service">生成服务</Label>
            <Select
              value={serviceType}
              onValueChange={(value: ServiceType) => setServiceType(value)}
            >
              <SelectTrigger id="service">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="midjourney">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    <span>Midjourney（高质量）</span>
                  </div>
                </SelectItem>
                <SelectItem value="nano-banana">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    <span>nano-banana（快速）</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Model Selector - conditional based on service type */}
          {serviceType === "nano-banana" && (
            <div className="space-y-2">
              <Label htmlFor="model">模型</Label>
              <Select
                value={model}
                onValueChange={setModel}
              >
                <SelectTrigger id="model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gemini-2.5-flash-image">
                    Gemini 2.5 Flash
                  </SelectItem>
                  <SelectItem value="gemini-image">Gemini Image</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* nano-banana specific parameters */}
          {serviceType === "nano-banana" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="count">生成数量：{generationCount}</Label>
                <Slider
                  id="count"
                  value={[generationCount]}
                  onValueChange={([v]) => setGenerationCount(v)}
                  min={1}
                  max={4}
                  step={1}
                  className="py-2"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="size">图片尺寸</Label>
                <Select
                  value={imageSize}
                  onValueChange={setImageSize}
                >
                  <SelectTrigger id="size">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="512x512">512 × 512</SelectItem>
                    <SelectItem value="1024x1024">1024 × 1024</SelectItem>
                    <SelectItem value="1024x1792">1024 × 1792</SelectItem>
                    <SelectItem value="1792x1024">1792 × 1024</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Midjourney specific parameters */}
          {serviceType === "midjourney" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="mjBotType">Bot 类型</Label>
                <Select
                  value={mjBotType}
                  onValueChange={setMjBotType}
                >
                  <SelectTrigger id="mjBotType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MID_JOURNEY">
                      MID_JOURNEY（默认）
                    </SelectItem>
                    <SelectItem value="NIJI_JOURNEY">
                      NIJI_JOURNEY（二次元风格）
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mjMode">生成模式</Label>
                <Select
                  value={mjMode}
                  onValueChange={setMjMode}
                >
                  <SelectTrigger id="mjMode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RELAX">RELAX（省钱模式）</SelectItem>
                    <SelectItem value="FAST">FAST（快速模式）</SelectItem>
                    <SelectItem value="TURBO">TURBO（极速模式）</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label>图片比例</Label>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { ratio: "9:16", label: "9:16" },
                    { ratio: "16:9", label: "16:9" },
                    { ratio: "1:1", label: "1:1" },
                    { ratio: "4:3", label: "4:3" },
                    { ratio: "3:4", label: "3:4" },
                  ].map((item) => (
                    <button
                      key={item.ratio}
                      type="button"
                      onClick={() => setAspectRatio(aspectRatio === item.ratio ? "" : item.ratio)}
                      className={`
                        relative h-14 rounded-lg border-2 transition-all
                        flex flex-col items-center justify-center gap-1
                        ${
                          aspectRatio === item.ratio
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:border-primary/50 hover:bg-muted"
                        }
                      `}
                    >
                      <div
                        className={`
                          rounded border-2
                          ${
                            aspectRatio === item.ratio
                              ? "border-primary"
                              : "border-muted-foreground/30"
                          }
                        `}
                        style={{
                          width: item.ratio === "1:1" ? "20px" : 
                                 item.ratio === "4:3" ? "22px" : 
                                 item.ratio === "3:4" ? "16px" :
                                 item.ratio === "16:9" ? "24px" : "14px",
                          height: item.ratio === "1:1" ? "20px" : 
                                  item.ratio === "4:3" ? "16px" : 
                                  item.ratio === "3:4" ? "22px" :
                                  item.ratio === "16:9" ? "14px" : "24px",
                        }}
                      />
                      <span className="text-xs font-medium">{item.label}</span>
                    </button>
                  ))}
                </div>
                {aspectRatio && (
                  <p className="text-xs text-muted-foreground">
                    已选择 {aspectRatio} 比例
                  </p>
                )}
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Midjourney 生成需要 30-90 秒，请耐心等待。支持上传参考图片。
                </AlertDescription>
              </Alert>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="prompt">提示词</Label>
            <Textarea
              id="prompt"
              placeholder="一只可爱的猫咪，高清，4K..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={6}
              className="resize-none"
            />
          </div>

          {/* Reference Images - Only for Midjourney */}
          {serviceType === "midjourney" && (
            <div className="space-y-2">
              <Label htmlFor="reference">参考图片（可选）</Label>
              <div className="space-y-3">
                <div className="relative">
                  <input
                    id="reference"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full bg-transparent"
                    onClick={() =>
                      document.getElementById("reference")?.click()
                    }
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    上传参考图片
                  </Button>
                </div>

                {referenceImages.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {referenceImages.map((img, index) => (
                      <div
                        key={index}
                        className="relative aspect-square rounded-lg overflow-hidden bg-muted group"
                      >
                        <img
                          src={img || "/placeholder.svg"}
                          alt={`参考图片 ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          onClick={() => removeReferenceImage(index)}
                          className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Progress display for Midjourney */}
          {loading && serviceType === "midjourney" && taskStatus && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">生成进度</span>
                <span className="font-medium">
                  {taskStatus === "SUBMITTING" && "提交中..."}
                  {taskStatus === "SUBMITTED" && "已提交"}
                  {taskStatus === "PROCESSING" && "生成中..."}
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
            onClick={handleGenerate}
            disabled={loading}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {serviceType === "midjourney" ? "生成中..." : "生成中..."}
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4 mr-2" />
                生成图片
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Results</CardTitle>
          <CardDescription>
            {loadingStoredImages
              ? "Loading your images from storage..."
              : generatedImages.length > 0
              ? `${generatedImages.length} image${
                  generatedImages.length > 1 ? "s" : ""
                } stored`
              : "Your generated images will appear here"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingStoredImages ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center space-y-3">
                <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  Loading images from storage...
                </p>
              </div>
            </div>
          ) : generatedImages.length > 0 ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {generatedImages.map((image, index) => (
                <Card
                  key={index}
                  className="overflow-hidden group hover:shadow-lg transition-all duration-300 p-0"
                >
                  <CardContent className="p-0">
                    <div
                      className="relative aspect-square bg-muted cursor-pointer overflow-hidden"
                      onClick={() => setPreviewImage(image)}
                    >
                      <img
                        src={proxyImageUrl(image || "/placeholder.svg")}
                        alt={`Generated ${index + 1}`}
                        className="w-full h-full object-cover rounded-t-lg transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
                    </div>
                    <div className="p-2 flex gap-2">
                      <Button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDownload(image, index)
                        }}
                        variant="outline"
                        size="sm"
                        className="flex-1 h-8 px-2 text-xs hover:bg-primary hover:text-primary-foreground transition-colors"
                      >
                        <Download className="w-3.5 h-3.5 mr-1" />
                        <span>Download</span>
                      </Button>
                      <Button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(image, index)
                        }}
                        variant="outline"
                        size="sm"
                        className="flex-1 h-8 px-2 text-xs hover:bg-destructive hover:text-destructive-foreground border-destructive/50 text-destructive transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" />
                        <span>Delete</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="aspect-square rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/20">
              <div className="text-center text-muted-foreground">
                <Wand2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No images generated yet</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!previewImage}
        onOpenChange={() => setPreviewImage(null)}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Image Preview</DialogTitle>
          </DialogHeader>
          <div className="relative w-full max-h-[70vh] overflow-auto rounded-lg">
            <img
              src={proxyImageUrl(previewImage || "/placeholder.svg")}
              alt="Preview"
              className="w-full h-auto rounded-lg"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
