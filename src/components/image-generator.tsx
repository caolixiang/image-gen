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
  RotateCcw,
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Slider } from "@/components/ui/slider"
import {
  generateWithNanoBanana,
  saveImagesToR2,
} from "@/lib/api/image-generation"
import { proxyImageUrl } from "@/lib/proxy-image"
import {
  listStoredImagesPage,
  deleteStoredImage,
} from "@/lib/api/image-storage"
import { useImageStore } from "@/store/image-store"

import { useJobQueue } from "@/store/job-queue"

interface ImageGeneratorProps {
  config: {
    baseUrl: string
    apiKey: string
  }
}

type ServiceType = "nano-banana" | "midjourney"

export function ImageGenerator({ config }: ImageGeneratorProps) {
  // Zustand store - 持久化状态
  const {
    prompt,
    setPrompt,
    model,
    setModel,
    loading,
    setLoading,
    generatedImages,
    setGeneratedImages,
    error,
    setError,
    referenceImages,
    addReferenceImage,
    removeReferenceImage,
    loadingStoredImages,
    setLoadingStoredImages,
    serviceType,
    setServiceType,
    generationCount,
    setGenerationCount,
    imageSize,
    setImageSize,
    mjBotType,
    setMjBotType,
    mjMode,
    setMjMode,
    aspectRatio,
    setAspectRatio,
  } = useImageStore()

  // Job queue hooks (v1: image only)
  const { jobs, enqueueImageJob, retryTimeoutJob, cancelTimeoutJob, init } =
    useJobQueue()
  useEffect(() => {
    init()
  }, [])

  const inProgressImageJobs = jobs.filter(
    (j) =>
      j.kind === "image" &&
      ["queued", "submitting", "processing", "saving", "timeout"].includes(
        j.status
      )
  ) as any[]

  // Local UI state - 不需要持久化
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [deletingImage, setDeletingImage] = useState<{
    imageUrl: string
    index: number
  } | null>(null)

  // 分页状态（仅组件内）
  const [imageNextCursor, setImageNextCursor] = useState<string | undefined>(
    undefined
  )
  const [imageHasMore, setImageHasMore] = useState(false)
  const [loadingMoreImages, setLoadingMoreImages] = useState(false)

  // 页面加载时从 R2 获取已生成的图片
  useEffect(() => {
    const loadStoredImages = async () => {
      try {
        setLoadingStoredImages(true)
        const page = await listStoredImagesPage(50) // 首次加载 50 张
        setGeneratedImages(page.images.map((img) => img.url))
        setImageHasMore(page.truncated)
        setImageNextCursor(page.cursor)
      } catch (error) {
        console.error("Failed to load stored images:", error)
      } finally {
        setLoadingStoredImages(false)
      }
    }

    // 只在组件首次挂载且没有已加载的图片时才加载
    if (generatedImages.length === 0 && !loadingStoredImages) {
      loadStoredImages()
    }
  }, []) // 空依赖数组，只在组件挂载时执行一次

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    Array.from(files).forEach((file) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        addReferenceImage(reader.result as string)
      }
      reader.readAsDataURL(file)
    })
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
    setGeneratedImages([...savedImages, ...generatedImages])
  }

  // Midjourney 生成处理（改为入队，占位 + 调度）
  const handleMidjourneyGeneration = async () => {
    enqueueImageJob({
      service: "midjourney",
      prompt,
      referenceImages,
      mjBotType,
      mjMode,
      aspectRatio,
    })
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

    // 清理错误提示
    setError(null)

    try {
      if (serviceType === "nano-banana") {
        // 同步生成，仍保留原有 loading 态
        setLoading(true)
        await handleNanoBananaGeneration()
      } else {
        // Midjourney 走队列，不再阻塞 UI
        await handleMidjourneyGeneration()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成失败")
      console.error("Image generation error:", err)
    } finally {
      if (serviceType === "nano-banana") {
        setLoading(false)
      }
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

  // 点击删除按钮
  const handleDeleteClick = (imageUrl: string, index: number) => {
    setDeletingImage({ imageUrl, index })
    setIsDeleteDialogOpen(true)
  }

  // 确认删除图片
  const handleDeleteConfirm = async () => {
    if (!deletingImage) return

    try {
      const success = await deleteStoredImage(deletingImage.imageUrl)

      if (success) {
        // 从列表中移除该图片
        setGeneratedImages(
          generatedImages.filter((_, i) => i !== deletingImage.index)
        )
        setIsDeleteDialogOpen(false)
        setDeletingImage(null)
      } else {
        alert("删除失败，请重试")
      }
    } catch (error) {
      console.error("删除失败:", error)
      alert("删除失败，请重试")
    }
  }

  // 加载更多（分页）
  const handleLoadMoreImages = async () => {
    if (!imageHasMore || loadingMoreImages) return
    try {
      setLoadingMoreImages(true)
      const page = await listStoredImagesPage(50, imageNextCursor)
      setGeneratedImages([
        ...generatedImages,
        ...page.images.map((img) => img.url),
      ])
      setImageHasMore(page.truncated)
      setImageNextCursor(page.cursor)
    } catch (error) {
      console.error("Failed to load more images:", error)
    } finally {
      setLoadingMoreImages(false)
    }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>图片生成</CardTitle>
          <CardDescription>从文本描述创建精美图片</CardDescription>
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
            <div className="space-y-1">
              <Label
                htmlFor="model"
                className="text-sm"
              >
                模型
              </Label>
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
                      onClick={() =>
                        setAspectRatio(
                          aspectRatio === item.ratio ? "" : item.ratio
                        )
                      }
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
                          width:
                            item.ratio === "1:1"
                              ? "20px"
                              : item.ratio === "4:3"
                              ? "22px"
                              : item.ratio === "3:4"
                              ? "16px"
                              : item.ratio === "16:9"
                              ? "24px"
                              : "14px",
                          height:
                            item.ratio === "1:1"
                              ? "20px"
                              : item.ratio === "4:3"
                              ? "16px"
                              : item.ratio === "3:4"
                              ? "22px"
                              : item.ratio === "16:9"
                              ? "14px"
                              : "24px",
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

          <Button
            onClick={handleGenerate}
            disabled={serviceType === "nano-banana" && loading}
            className="w-full"
            size="lg"
          >
            {serviceType === "nano-banana" && loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                生成中...
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
          <CardTitle>生成结果</CardTitle>
          <CardDescription>
            {loadingStoredImages
              ? "正在从存储加载图片..."
              : generatedImages.length > 0
              ? `已保存 ${generatedImages.length} 张图片`
              : "你生成的图片将显示在这里"}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          {inProgressImageJobs.length > 0 && (
            <div className="mb-4 space-y-3">
              <div className="text-sm text-muted-foreground">
                进行中的任务（占位）
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {inProgressImageJobs.map((job) => (
                  <div
                    key={job.id}
                    className="border rounded-lg p-3 bg-muted/30"
                  >
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="font-medium">
                        {job.status === "queued" && "排队中"}
                        {job.status === "submitting" && "提交中"}
                        {job.status === "processing" && "生成中"}
                        {job.status === "saving" && "保存中"}
                        {job.status === "timeout" && "超时"}
                      </span>
                      {job.status === "timeout" && (
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            title="重试轮询"
                            onClick={() => retryTimeoutJob(job.id)}
                          >
                            <RotateCcw className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            title="取消并移除"
                            onClick={() => cancelTimeoutJob(job.id)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="h-2 w-full rounded bg-muted overflow-hidden">
                      <div
                        className="h-2 bg-primary transition-all"
                        style={{
                          width: `${Math.min(100, job.progress || 0)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {loadingStoredImages ? (
            <div className="flex items-center justify-center py-6">
              <div className="text-center space-y-2">
                <Loader2 className="w-6 h-6 mx-auto animate-spin text-primary" />
                <p className="text-xs text-muted-foreground">
                  正在从存储加载图片...
                </p>
              </div>
            </div>
          ) : generatedImages.length > 0 ? (
            <>
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
                        {/* 右上角按钮组 - 鼠标悬停时显示 */}
                        <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <Button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDownload(image, index)
                            }}
                            size="sm"
                            className="h-8 w-8 p-0 bg-blue-600 hover:bg-blue-700 text-white shadow-lg"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteClick(image, index)
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
              {imageHasMore && (
                <div className="flex justify-center mt-4">
                  <Button
                    onClick={handleLoadMoreImages}
                    disabled={loadingMoreImages}
                    variant="outline"
                  >
                    {loadingMoreImages ? (
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
                <Wand2 className="w-8 h-8 mx-auto mb-1 opacity-50" />
                <p className="text-xs">还没有生成图片</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!previewImage}
        onOpenChange={() => setPreviewImage(null)}
      >
        <DialogContent className="max-w-4xl p-0 [&>button]:hidden">
          <img
            src={proxyImageUrl(previewImage || "/placeholder.svg")}
            alt="Preview"
            className="w-full h-auto rounded-lg"
          />
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
              确认删除图片
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">
              确定要删除这张图片吗？此操作无法撤销。
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
