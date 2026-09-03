import type {
  AccountProfile,
  ConsumptionRecord,
  HotRankingRecord,
  RechargeRecord,
  VideoAnalysisLookupResult,
  VideoAnalysisResult,
  VideoHistoryRecord,
  WorkspaceSource,
} from '../types'
import {
  accountProfile,
  consumptionRecords,
  deleteVideoRecord,
  getVideoRecords,
  resetDemoRecords,
  rechargeRecords,
} from './localData'
import { getMockTrendingRankings, trendingIndustries } from './trendingCatalog'
import type { TrendingDuration } from './trendingCatalog'
import {
  DataProviderError,
  type CategoryResult,
  type CursorPage,
  type DataProvider,
  type DownloadTicket,
  type TrendingDurationCode,
  type TrendingVideosQuery,
} from './dataProvider'
import {
  cloneAnalysisResult,
  createMockAnalysis,
  createSeededCachedAnalysis,
  demoCachedSourceUrl,
} from './workspaceAnalysis'

const analysisCacheStorageKey = 'ai-video-workbench-public-analysis-cache-v1'
const memoryAnalysisCache = new Map<string, VideoAnalysisResult>()

function normalizeMockSourceUrl(sourceUrl: string): string {
  const trimmedUrl = sourceUrl.trim()
  try {
    const parsed = new URL(trimmedUrl)
    parsed.hostname = parsed.hostname.toLowerCase()
    parsed.hash = ''
    if (parsed.pathname.length > 1) parsed.pathname = parsed.pathname.replace(/\/+$/, '')
    return parsed.toString()
  } catch {
    return trimmedUrl
  }
}

function isStoredAnalysis(value: unknown): value is VideoAnalysisResult {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return (
    typeof record.analysisId === 'string' &&
    typeof record.analyzedAt === 'string' &&
    typeof record.source === 'object' &&
    Array.isArray(record.segments)
  )
}

function hydrateAnalysisCache(): void {
  const seeded = createSeededCachedAnalysis()
  memoryAnalysisCache.set(normalizeMockSourceUrl(demoCachedSourceUrl), seeded)
  if (typeof localStorage === 'undefined') return
  try {
    const storedValue: unknown = JSON.parse(localStorage.getItem(analysisCacheStorageKey) ?? '[]')
    if (!Array.isArray(storedValue)) return
    storedValue.forEach((entry) => {
      if (!Array.isArray(entry) || entry.length !== 2) return
      const [key, result] = entry as [unknown, unknown]
      if (typeof key === 'string' && isStoredAnalysis(result)) {
        memoryAnalysisCache.set(key, cloneAnalysisResult(result))
      }
    })
  } catch {
    localStorage.removeItem(analysisCacheStorageKey)
  }
}

function persistAnalysisCache(): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(analysisCacheStorageKey, JSON.stringify([...memoryAnalysisCache.entries()]))
}

hydrateAnalysisCache()

const durationByCode: Record<TrendingDurationCode, TrendingDuration> = {
  all: '不限',
  lte_15: '15秒内',
  lte_60: '1分钟内',
  gt_60: '>1分钟',
}

function parseCursor(cursor?: string | null): number {
  if (!cursor) return 0
  const value = Number.parseInt(cursor, 10)
  return Number.isFinite(value) && value >= 0 ? value : 0
}

function paginate<T>(items: T[], cursor?: string | null, limit = 20): CursorPage<T> {
  const offset = parseCursor(cursor)
  const safeLimit = Math.max(1, Math.min(limit, 50))
  const pageItems = items.slice(offset, offset + safeLimit)
  const nextOffset = offset + pageItems.length
  return {
    items: pageItems,
    nextCursor: nextOffset < items.length ? String(nextOffset) : null,
  }
}

function waitForMock(signal?: AbortSignal, delay = 180): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('请求已取消', 'AbortError'))
      return
    }
    const onAbort = () => {
      clearTimeout(timer)
      reject(new DOMException('请求已取消', 'AbortError'))
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, delay)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

export class MockDataProvider implements DataProvider {
  readonly mode = 'mock' as const

  async lookupVideoAnalysis(
    sourceUrl: string,
    signal?: AbortSignal,
  ): Promise<VideoAnalysisLookupResult> {
    await waitForMock(signal, 520)
    if (sourceUrl.includes('cache-error')) {
      throw new DataProviderError('历史分析查询失败，请重新查询', { code: 'CACHE_LOOKUP_FAILED' })
    }
    const result = memoryAnalysisCache.get(normalizeMockSourceUrl(sourceUrl))
    if (!result) return { hit: false }
    return {
      hit: true,
      result: { ...cloneAnalysisResult(result), origin: 'cached' },
    }
  }

  async analyzeVideo(
    source: WorkspaceSource,
    signal?: AbortSignal,
  ): Promise<VideoAnalysisResult> {
    await waitForMock(signal, 2_800)
    const result = createMockAnalysis(source)
    if (source.kind === 'link') {
      const cacheResult = { ...cloneAnalysisResult(result), origin: 'fresh' as const }
      memoryAnalysisCache.set(normalizeMockSourceUrl(source.url), cacheResult)
      persistAnalysisCache()
    }
    return cloneAnalysisResult(result)
  }

  async getTrendingCategories(signal?: AbortSignal): Promise<CategoryResult> {
    await waitForMock(signal)
    return { items: trendingIndustries, usedFallback: false }
  }

  async getTrendingVideos(
    query: TrendingVideosQuery,
    signal?: AbortSignal,
  ): Promise<CursorPage<HotRankingRecord>> {
    await waitForMock(signal)
    const duration = durationByCode[query.duration]
    const total = query.industryId === 'clothing' ? 20 : 40
    const records = getMockTrendingRankings({
      industryId: query.industryId,
      subcategoryId: query.subcategoryId,
      duration,
      limit: total,
    }).records
    return paginate(records, query.cursor, query.limit)
  }

  async getVideoTasks(
    cursor?: string | null,
    limit = 20,
    signal?: AbortSignal,
  ): Promise<CursorPage<VideoHistoryRecord>> {
    await waitForMock(signal)
    const records = [...getVideoRecords()].sort(
      (left, right) => Date.parse(right.generatedAt) - Date.parse(left.generatedAt),
    )
    return paginate(records, cursor, limit)
  }

  async deleteVideoTask(id: string, signal?: AbortSignal): Promise<void> {
    await waitForMock(signal)
    deleteVideoRecord(id)
  }

  async getDownloadTicket(id: string, signal?: AbortSignal): Promise<DownloadTicket> {
    await waitForMock(signal)
    const record = getVideoRecords().find((item) => item.id === id)
    if (!record?.videoUrl || !record.playbackAvailable) {
      throw new DataProviderError('当前视频暂不可下载', { code: 'MEDIA_NOT_READY' })
    }
    return {
      url: record.videoUrl,
      filename: `${record.title}.mp4`,
      expiresAt: null,
    }
  }

  async getAccountSummary(signal?: AbortSignal): Promise<AccountProfile> {
    await waitForMock(signal)
    return { ...accountProfile }
  }

  async getConsumptionRecords(
    cursor?: string | null,
    limit = 20,
    signal?: AbortSignal,
  ): Promise<CursorPage<ConsumptionRecord>> {
    await waitForMock(signal)
    return paginate([...consumptionRecords], cursor, limit)
  }

  async getRechargeRecords(
    cursor?: string | null,
    limit = 20,
    signal?: AbortSignal,
  ): Promise<CursorPage<RechargeRecord>> {
    await waitForMock(signal)
    return paginate([...rechargeRecords], cursor, limit)
  }

  async resetDemoHistory(): Promise<void> {
    resetDemoRecords()
  }
}
