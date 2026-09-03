import { useCallback, useEffect, useState } from 'react'
import { getErrorMessage } from '../data/dataProvider'

export type ResourceStatus = 'loading' | 'success' | 'error'

export interface AsyncResourceState<T> {
  data: T | null
  status: ResourceStatus
  error: string | null
}

export function useAsyncResource<T>(loader: (signal: AbortSignal) => Promise<T>) {
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState<AsyncResourceState<T>>({
    data: null,
    status: 'loading',
    error: null,
  })

  useEffect(() => {
    const controller = new AbortController()
    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        setState((current) => ({ ...current, status: 'loading', error: null }))
      }
    })
    void loader(controller.signal)
      .then((data) => setState({ data, status: 'success', error: null }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setState((current) => ({ ...current, status: 'error', error: getErrorMessage(error) }))
      })
    return () => controller.abort()
  }, [loader, revision])

  const reload = useCallback(() => setRevision((value) => value + 1), [])
  return { ...state, reload }
}
