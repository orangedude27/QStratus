"use client"

import { useEffect, useState, useCallback } from "react"
import { X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { getDownloadStatus } from "@/lib/actions/games"
import { isStaticExport } from "@/lib/static-export"

type DownloadStatusType = {
  downloading: boolean
  appids: number[]
  completed: number[]
  failed: number[]
  progress: number
  error?: string
}

type DownloadProgressProps = {
  games: Record<number, string>
  onClear?: () => void
}

export function DownloadProgress({ games, onClear }: DownloadProgressProps) {
  const [status, setStatus] = useState<DownloadStatusType | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchStatus = useCallback(async () => {
    try {
      const data = await getDownloadStatus()
      if (data) {
        setStatus(data)
        if (!data.downloading && data.appids.length > 0) {
          setLoading(false)
        }
      }
    } catch {
      // Silently fail - will retry
    }
  }, [])

  useEffect(() => {
    if (isStaticExport) return
    fetchStatus()
    const interval = setInterval(fetchStatus, 3000)
    return () => clearInterval(interval)
  }, [fetchStatus])

  if (!status || status.appids.length === 0) return null

  const total = status.appids.length
  const completedCount = status.completed.length
  const failedCount = status.failed.length
  const isComplete = !status.downloading && total > 0
  const hasErrors = failedCount > 0 || status.error

  function getGameName(appid: number): string {
    return games[appid] || `Game ${appid}`
  }

  function getStatusIcon(appid: number) {
    if (!status) return null
    if (status.completed.includes(appid)) {
      return <CheckCircle2 className="h-4 w-4 text-green-500" />
    }
    if (status.failed.includes(appid)) {
      return <AlertCircle className="h-4 w-4 text-red-500" />
    }
    if (status.downloading) {
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
    }
    return null
  }

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Game Downloads</CardTitle>
            <CardDescription>
              {status.downloading
                ? `Downloading ${completedCount} of ${total} games...`
                : isComplete
                  ? hasErrors
                    ? `${completedCount} downloaded, ${failedCount} failed`
                    : `${completedCount} games downloaded`
                  : "Preparing downloads..."}
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              setStatus(null)
              onClear?.()
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={status.progress} className="h-2" />

        {hasErrors && status.error && (
          <p className="text-sm text-red-500">{status.error}</p>
        )}

        <div className="space-y-2">
          {status.appids.map((appid) => (
            <div
              key={appid}
              className="flex items-center justify-between text-sm rounded-md px-3 py-2 bg-muted/30"
            >
              <span className="flex items-center gap-2">
                {getStatusIcon(appid)}
                <span>{getGameName(appid)}</span>
              </span>
              <span className="text-muted-foreground text-xs">
                {status.completed.includes(appid)
                  ? "Complete"
                  : status.failed.includes(appid)
                    ? "Failed"
                    : status.downloading
                      ? "Downloading..."
                      : "Queued"}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
