import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Trash2, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import type { ProvidersConfig } from "@/lib/constants"

interface ConfigPanelProps {
  config: ProvidersConfig
  onUpdateProviderKey: (providerId: string, apiKey: string) => void
  onSelectProvider: (providerId: string) => void
  onRemoveProviderKey: (providerId: string) => void
  onClearAll: () => void
}

export function ConfigPanel({ 
  config, 
  onUpdateProviderKey, 
  onSelectProvider, 
  onRemoveProviderKey,
  onClearAll 
}: ConfigPanelProps) {
  const hasAnyConfig = config.providers.some(p => p.apiKey)
  const selectedProvider = config.providers.find(p => p.id === config.selectedProviderId)

  return (
    <div className="space-y-6 pt-6 px-1">
      {!hasAnyConfig && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            请至少配置一个服务商的 API Key 以开始使用
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">选择服务商</Label>
          <p className="text-xs text-muted-foreground">
            选择要使用的 AI 服务商
          </p>
        </div>

        <RadioGroup
          value={config.selectedProviderId || ""}
          onValueChange={onSelectProvider}
        >
          {config.providers.map((provider) => (
            <Card key={provider.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <RadioGroupItem
                      value={provider.id}
                      id={provider.id}
                      disabled={!provider.apiKey}
                      className="mt-1"
                    />
                    <img 
                      src={provider.logo} 
                      alt={`${provider.name} logo`}
                      className="w-10 h-10 rounded-lg object-contain"
                    />
                    <div>
                      <CardTitle className="text-base">
                        <label htmlFor={provider.id} className="cursor-pointer">
                          {provider.name}
                        </label>
                      </CardTitle>
                      <CardDescription className="text-xs mt-1">
                        {provider.baseUrl}
                      </CardDescription>
                    </div>
                  </div>
                  {provider.apiKey && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => onRemoveProviderKey(provider.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="space-y-2">
                  <Label htmlFor={`apiKey-${provider.id}`} className="text-xs font-medium">
                    API Key
                  </Label>
                  <Input
                    id={`apiKey-${provider.id}`}
                    type="password"
                    placeholder="请输入 API Key"
                    value={provider.apiKey}
                    onChange={(e) => onUpdateProviderKey(provider.id, e.target.value)}
                    className="h-10"
                  />
                </div>
                {!provider.apiKey && (
                  <p className="text-xs text-muted-foreground">
                    配置 API Key 后即可使用此服务商
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </RadioGroup>
      </div>

      {hasAnyConfig && (
        <div className="pt-4 border-t">
          <Button
            variant="outline"
            className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={onClearAll}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            清除所有配置
          </Button>
        </div>
      )}

      {selectedProvider && (
        <div className="pt-2">
          <Alert>
            <AlertDescription className="text-xs">
              当前使用：<strong>{selectedProvider.name}</strong>
            </AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  )
}
