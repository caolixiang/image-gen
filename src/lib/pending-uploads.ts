// Simple pending uploads queue persisted in localStorage to guarantee eventual R2 save
// Queue entries are retried on next app launch; pagehide uses sendBeacon as a last resort.

export type PendingUpload =
  | { kind: "image"; imageUrl: string; taskId?: string; addedAt: number }
  | { kind: "video"; videoUrl: string; filename: string; taskId?: string; addedAt: number }

const LS_KEY = "pending-uploads-v1"

function readQueue(): PendingUpload[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as PendingUpload[]
    if (!Array.isArray(list)) return []
    return list
  } catch {
    return []
  }
}

function writeQueue(list: PendingUpload[]) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(list))
  } catch {}
}

export function addPendingImage(imageUrl: string, taskId?: string) {
  if (!imageUrl) return
  const list = readQueue()
  list.push({ kind: "image", imageUrl, taskId, addedAt: Date.now() })
  writeQueue(list)
}

export function addPendingVideo(videoUrl: string, filename: string, taskId?: string) {
  if (!videoUrl || !filename) return
  const list = readQueue()
  list.push({ kind: "video", videoUrl, filename, taskId, addedAt: Date.now() })
  writeQueue(list)
}

export function removePendingImage(imageUrl: string) {
  const list = readQueue().filter((it) => !(it.kind === "image" && it.imageUrl === imageUrl))
  writeQueue(list)
}

export function removePendingVideo(videoUrl: string, filename: string) {
  const list = readQueue().filter(
    (it) => !(it.kind === "video" && it.videoUrl === videoUrl && it.filename === filename)
  )
  writeQueue(list)
}

export function getPendingUploads(): PendingUpload[] {
  return readQueue()
}

// Try to process all pending uploads once (sequentially). On any failure, keep the entry.
export async function processPendingUploads(): Promise<void> {
  const list = readQueue()
  if (list.length === 0) return

  for (const item of list) {
    try {
      if (item.kind === "image") {
        const res = await fetch("/api/save-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // No need for keepalive here; app is active
          body: JSON.stringify({ imageUrl: item.imageUrl, taskId: item.taskId }),
        })
        if (res.ok) {
          removePendingImage(item.imageUrl)
        }
      } else {
        const res = await fetch("/api/video/save-video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videoUrl: item.videoUrl,
            filename: item.filename,
            taskId: item.taskId,
          }),
        })
        if (res.ok) {
          removePendingVideo(item.videoUrl, item.filename)
        }
      }
    } catch {
      // keep in queue for next round
    }
  }
}

// Fire-and-forget using sendBeacon on pagehide/beforeunload
export function sendBeaconsForPendingUploads(): void {
  if (typeof window === "undefined" || typeof navigator === "undefined" || !("sendBeacon" in navigator)) return
  const list = readQueue()
  for (const item of list) {
    try {
      if (item.kind === "image") {
        const payload = JSON.stringify({ imageUrl: item.imageUrl, taskId: item.taskId })
        const blob = new Blob([payload], { type: "application/json" })
        navigator.sendBeacon("/api/save-image", blob)
      } else {
        const payload = JSON.stringify({
          videoUrl: item.videoUrl,
          filename: item.filename,
          taskId: item.taskId,
        })
        const blob = new Blob([payload], { type: "application/json" })
        navigator.sendBeacon("/api/video/save-video", blob)
      }
    } catch {
      // ignore
    }
  }
}

