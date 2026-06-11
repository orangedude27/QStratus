"use client"

import { useState, useCallback } from "react"

type ToastProps = {
  title?: string
  description?: string
  variant?: "default" | "destructive"
}

const toasts = useState<ToastProps[]>([])[1]

export function useToast() {
  const [toastList, setToastList] = useState<ToastProps[]>([])

  const toast = useCallback((props: ToastProps) => {
    setToastList((prev) => [...prev, props])
    setTimeout(() => {
      setToastList((prev) => prev.slice(1))
    }, 3000)
  }, [])

  return { toast, toastList }
}

export function toast(props: ToastProps) {
  // Simple global toast for now
  console.log("Toast:", props)
}
