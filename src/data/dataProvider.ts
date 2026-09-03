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
import type { TrendingIndustry } from './trendingCatalog'

export type DataMode = 'mock' | 'api'
export type TrendingDurationCode = 'all' | 'lte_15' | 'lte_60' | 'gt_60'

export interface CursorPage<T> {
  items: T[]
  nextCursor: string | null
}

export interface CategoryResult {
  items: readonly TrendingIndustry[]
  usedFallback: boolean
}

export interface TrendingVideosQuery {
  industryId: string
  subcategoryId: string
  duration: TrendingDurationCode
  cursor?: string | null
  limit?: number
}

export interface DownloadTicket {
  url: string
  filename: string
  expiresAt: string | null
}

export interface DataProvider {
  readonly mode: DataMode
  lookupVideoAnalysis(
    sourceUrl: string,
    signal?: AbortSignal,
  ): Promise<VideoAnalysisLookupResult>
  analyzeVideo(source: WorkspaceSource, signal?: AbortSignal): Promise<VideoAnalysisResult>
  getTrendingCategories(signal?: AbortSignal): Promise<CategoryResult>
  getTrendingVideos(
    query: TrendingVideosQuery,
    signal?: AbortSignal,
  ): Promise<CursorPage<HotRankingRecord>>
  getVideoTasks(
    cursor?: string | null,
    limit?: number,
    signal?: AbortSignal,
  ): Promise<CursorPage<VideoHistoryRecord>>
  deleteVideoTask(id: string, signal?: AbortSignal): Promise<void>
  getDownloadTicket(id: string, signal?: AbortSignal): Promise<DownloadTicket>
  getAccountSummary(signal?: AbortSignal): Promise<AccountProfile>
  getConsumptionRecords(
    cursor?: string | null,
    limit?: number,
    signal?: AbortSignal,
  ): Promise<CursorPage<ConsumptionRecord>>
  getRechargeRecords(
    cursor?: string | null,
    limit?: number,
    signal?: AbortSignal,
  ): Promise<CursorPage<RechargeRecord>>
  resetDemoHistory?(): Promise<void>
}

export class DataProviderError extends Error {
  readonly code: string
  readonly requestId?: string
  readonly status?: number

  constructor(
    message: string,
    options: { code?: string; requestId?: string; status?: number; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause })
    this.name = 'DataProviderError'
    this.code = options.code ?? 'UNKNOWN_ERROR'
    this.requestId = options.requestId
    this.status = options.status
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === 'AbortError') return '请求已取消'
  if (error instanceof Error && error.message) return error.message
  return '请求失败，请稍后重试'
}
