import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ImageGenerator } from "@/components/image-generator"
import { ImageDescriber } from "@/components/image-describer"
import { ConfigPanel } from "@/components/config-panel"
import { Toaster } from "@/components/ui/toaster"
import { Sparkles, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { 
  loadProvidersConfig, 
  updateProviderKey, 
  selectProvider, 
  removeProviderKey,
  clearProvidersConfig,
  getSelectedProvider 
} from "@/lib/storage"
import type { ProvidersConfig } from "@/lib/constants"

export default function App() {
  const [providersConfig, setProvidersConfig] = useState<ProvidersConfig>(() => 
    loadProvidersConfig()
  )

  // 获取当前选中的服务商配置
  const currentConfig = getSelectedProvider(providersConfig) || {
    baseUrl: "",
    apiKey: "",
  }

  // 处理 API Key 更新
  const handleUpdateProviderKey = (providerId: string, apiKey: string) => {
    const newConfig = updateProviderKey(providersConfig, providerId, apiKey)
    setProvidersConfig(newConfig)
  }

  // 处理服务商选择
  const handleSelectProvider = (providerId: string) => {
    const newConfig = selectProvider(providersConfig, providerId)
    setProvidersConfig(newConfig)
  }

  // 处理删除单个服务商 Key
  const handleRemoveProviderKey = (providerId: string) => {
    const newConfig = removeProviderKey(providersConfig, providerId)
    setProvidersConfig(newConfig)
  }

  // 处理清除所有配置
  const handleClearAll = () => {
    const newConfig = clearProvidersConfig()
    setProvidersConfig(newConfig)
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-balance">
                AI Image Studio
              </h1>
              <p className="text-xs text-muted-foreground">
                Generate & Describe
              </p>
            </div>
          </div>

          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
              >
                <Settings className="w-4 h-4" />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Configuration</SheetTitle>
                <SheetDescription>
                  Configure your API settings to get started
                </SheetDescription>
              </SheetHeader>
              <ConfigPanel
                config={providersConfig}
                onUpdateProviderKey={handleUpdateProviderKey}
                onSelectProvider={handleSelectProvider}
                onRemoveProviderKey={handleRemoveProviderKey}
                onClearAll={handleClearAll}
              />
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main className="container mx-auto px-4 py-4">
        <Tabs
          defaultValue="generate"
          className="w-full"
        >
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-4">
            <TabsTrigger value="generate">Generate Image</TabsTrigger>
            <TabsTrigger value="describe">Describe Image</TabsTrigger>
          </TabsList>

          <TabsContent
            value="generate"
            className="mt-0"
          >
            <ImageGenerator config={currentConfig} />
          </TabsContent>

          <TabsContent
            value="describe"
            className="mt-0"
          >
            <ImageDescriber config={currentConfig} />
          </TabsContent>
        </Tabs>
      </main>
      <Toaster />
    </div>
  )
}
