import { useCallback, useEffect, useRef, useState } from 'react'
import { getErrorMessage, type CursorPage } from '../data/dataProvider'

export type CursorListStatus = 'loading' | 'success' | 'empty' | 'error'

interface CursorListState<T> {
  items: T[]
  nextCursor: string | null
  status: CursorListStatus
  error: string | null
  loadingMore: boolean
  loadMoreError: string | null
}

function mergeUnique<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const seen = new Set(current.map((item) => item.id))
  return [...current, ...incoming.filter((item) => !seen.has(item.id))]
}

export function useCursorList<T extends { id: string }>(
  loader: (cursor: string | null, signal: AbortSignal) => Promise<CursorPage<T>>,
) {
  const [revision, setRevision] = useState(0)
  const loadMoreController = useRef<AbortController | null>(null)
  const [state, setState] = useState<CursorListState<T>>({
    items: [],
    nextCursor: null,
    status: 'loading',
    error: null,
    loadingMore: false,
    loadMoreError: null,
  })

  useEffect(() => {
    const controller = new AbortController()
    loadMoreController.current?.abort()
    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        setState({
          items: [],
          nextCursor: null,
          status: 'loading',
          error: null,
          loadingMore: false,
          loadMoreError: null,
        })
      }
    })
    void loader(null, controller.signal)
      .then((page) => {
        setState({
          items: page.items,
          nextCursor: page.nextCursor,
          status: page.items.length === 0 ? 'empty' : 'success',
          error: null,
          loadingMore: false,
          loadMoreError: null,
        })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setState({
          items: [],
          nextCursor: null,
          status: 'error',
          error: getErrorMessage(error),
          loadingMore: false,
          loadMoreError: null,
        })
      })
    return () => controller.abort()
  }, [loader, revision])

  const reload = useCallback(() => setRevision((value) => value + 1), [])

  const loadMore = useCallback(() => {
    if (!state.nextCursor || state.loadingMore) return
    const controller = new AbortController()
    loadMoreController.current?.abort()
    loadMoreController.current = controller
    setState((current) => ({ ...current, loadingMore: true, loadMoreError: null }))
    void loader(state.nextCursor, controller.signal)
      .then((page) => {
        setState((current) => ({
          ...current,
          items: mergeUnique(current.items, page.items),
          nextCursor: page.nextCursor,
          status: 'success',
          loadingMore: false,
          loadMoreError: null,
        }))
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setState((current) => ({
          ...current,
          loadingMore: false,
          loadMoreError: getErrorMessage(error),
        }))
      })
  }, [loader, state.loadingMore, state.nextCursor])

  const removeItem = useCallback((id: string) => {
    setState((current) => {
      const items = current.items.filter((item) => item.id !== id)
      return {
        ...current,
        items,
        status: items.length === 0 && !current.nextCursor ? 'empty' : current.status,
      }
    })
  }, [])

  return { ...state, reload, loadMore, removeItem }
}
