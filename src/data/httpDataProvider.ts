import type {
  AccountProfile,
  GenerationStatus,
  HistoryInputSnapshot,
  HistoryReplacementMapping,
  HistorySourceVideo,
  HotRankingRecord,
  MediaReference,
  QuotaUsageRecord,
  StoryboardSegment,
  UsageStatus,
  VideoAnalysisLookupResult,
  VideoAnalysisResult,
  VideoHistoryRecord,
  WorkspaceSource,
} from '../types'
import type { TrendingIndustry, TrendingSubcategory } from './trendingCatalog'
import { trendingIndustries } from './trendingCatalog'
import {
  type RuntimeParser,
  isObject,
  readBoolean,
  readNullableString,
  readNumber,
  readOptionalNumber,
  readString,
  requestApiData,
  requestApiVoid,
} from './httpClient'
import type {
  CategoryResult,
  CursorPage,
  DataProvider,
  DownloadTicket,
  TrendingVideosQuery,
} from './dataProvider'

function readObject(record: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = record[key]
  if (!isObject(value)) throw new Error(`字段 ${key} 必须是对象`)
  return value
}

function readArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} 必须是数组`)
  return value
}

function assertIsoDate(value: string, key: string): string {
  if (!Number.isFinite(Date.parse(value))) throw new Error(`字段 ${key} 必须是 ISO 8601 时间`)
  return value
}

function parseSubcategory(value: unknown): TrendingSubcategory {
  if (!isObject(value)) throw new Error('子类必须是对象')
  return { id: readString(value, 'id'), name: readString(value, 'name') }
}

const parseCategories: RuntimeParser<readonly TrendingIndustry[]> = (value) =>
  readArray(value, '类目数据').map((item) => {
    if (!isObject(item)) throw new Error('行业类目必须是对象')
    const children = readArray(item.children, 'children').map(parseSubcategory)
    if (children.length === 0) throw new Error('每个行业至少需要一个子类')
    return {
      id: readString(item, 'id'),
      name: readString(item, 'name'),
      children,
    }
  })

function readMetricLabel(metrics: Record<string, unknown>, key: 'playCount' | 'likeCount'): string {
  const metric = readObject(metrics, key)
  readNumber(metric, 'value')
  return readString(metric, 'label')
}

function readSettlementLabel(metrics: Record<string, unknown>): string {
  const metric = readObject(metrics, 'settlementAmount')
  readNumber(metric, 'minFen')
  readNumber(metric, 'maxFen')
  return readString(metric, 'label')
}

function parseTrendingItem(value: unknown): HotRankingRecord {
  if (!isObject(value)) throw new Error('热榜记录必须是对象')
  const creator = readObject(value, 'creator')
  const product = readObject(value, 'product')
  const metrics = readObject(value, 'metrics')
  const platform = readString(value, 'platform')
  if (platform !== 'douyin' && platform !== 'dou_store') {
    throw new Error('字段 platform 只能是 douyin 或 dou_store')
  }

  return {
    id: readString(value, 'id'),
    platform,
    rank: readNumber(value, 'rank'),
    title: readString(value, 'title'),
    creator: readString(creator, 'name'),
    creatorAvatarUrl: readString(creator, 'avatarUrl'),
    creatorLevel: readNumber(creator, 'level'),
    coverUrl: readString(value, 'coverUrl'),
    productName: readString(product, 'name'),
    productUrl: readString(product, 'url'),
    publishedAt: assertIsoDate(readString(value, 'publishedAt'), 'publishedAt'),
    durationSeconds: readNumber(value, 'durationSeconds'),
    playCount: readMetricLabel(metrics, 'playCount'),
    settlementAmount: readSettlementLabel(metrics),
    likeCount: readMetricLabel(metrics, 'likeCount'),
    sourceUrl: readString(value, 'sourceUrl'),
    videoUrl: readNullableString(value, 'videoUrl') ?? undefined,
  }
}

function parseGenerationStatus(value: string): GenerationStatus {
  if (value === 'queued' || value === 'processing' || value === 'completed' || value === 'failed') {
    return value
  }
  throw new Error('字段 status 不是有效任务状态')
}

function parseHistorySourceVideo(value: unknown): HistorySourceVideo {
  if (!isObject(value)) throw new Error('原视频素材必须是对象')
  const kind = readString(value, 'kind')
  if (kind !== 'link' && kind !== 'file') throw new Error('原视频素材 kind 必须是 link 或 file')
  const durationSeconds = readNumber(value, 'durationSeconds')
  if (durationSeconds < 0) throw new Error('原视频素材 durationSeconds 不能小于 0')
  return {
    kind,
    videoUrl: readNullableString(value, 'videoUrl') ?? undefined,
    coverUrl: readNullableString(value, 'coverUrl') ?? undefined,
    durationSeconds,
    fileName: readNullableString(value, 'fileName') ?? undefined,
  }
}

function parseHistoryInputSnapshot(value: unknown): HistoryInputSnapshot | undefined {
  if (value === undefined || value === null) return undefined
  if (!isObject(value)) throw new Error('字段 inputSnapshot 必须是对象或 null')
  const sourceVideo = value.sourceVideo === undefined || value.sourceVideo === null
    ? undefined
    : parseHistorySourceVideo(value.sourceVideo)
  return {
    sourceVideo,
    products: readArray(value.products, 'inputSnapshot.products').map(parseHistoryReplacementMapping),
    characters: readArray(value.characters, 'inputSnapshot.characters').map(parseHistoryReplacementMapping),
    scenes: readArray(value.scenes, 'inputSnapshot.scenes').map(parseHistoryReplacementMapping),
  }
}

function parseHistoryReplacementMapping(value: unknown): HistoryReplacementMapping {
  if (!isObject(value)) throw new Error('替换映射必须是对象')
  if ('original' in value || 'replacement' in value) {
    return {
      id: readString(value, 'id'),
      original: parseMediaReference(value.original),
      replacement: parseMediaReference(value.replacement),
    }
  }

  const legacyReplacement = parseMediaReference(value)
  return {
    id: `legacy-${legacyReplacement.id}`,
    original: {
      id: `legacy-original-${legacyReplacement.id}`,
      label: '原素材未记录',
    },
    replacement: legacyReplacement,
  }
}

function parseVideoTask(value: unknown): VideoHistoryRecord {
  if (!isObject(value)) throw new Error('视频任务必须是对象')
  const status = parseGenerationStatus(readString(value, 'status'))
  const progress = readOptionalNumber(value, 'progress')
  if (progress !== undefined && (progress < 0 || progress > 100)) {
    throw new Error('字段 progress 必须在 0 到 100 之间')
  }
  return {
    id: readString(value, 'id'),
    title: readString(value, 'title'),
    sourceUrl: readNullableString(value, 'sourceUrl') ?? undefined,
    videoUrl: readNullableString(value, 'videoUrl') ?? undefined,
    coverUrl: readNullableString(value, 'coverUrl') ?? undefined,
    generatedAt: assertIsoDate(readString(value, 'generatedAt'), 'generatedAt'),
    durationSeconds: readNumber(value, 'durationSeconds'),
    status,
    progress,
    failureReason: readNullableString(value, 'failureReason') ?? undefined,
    playbackAvailable: readBoolean(value, 'playbackAvailable'),
    inputSnapshot: parseHistoryInputSnapshot(value.inputSnapshot),
  }
}

function parseAccount(value: unknown): AccountProfile {
  if (!isObject(value)) throw new Error('账户汇总必须是对象')
  return {
    avatarUrl: readString(value, 'avatarUrl'),
    nickname: readString(value, 'nickname'),
    maskedPhone: readString(value, 'maskedPhone'),
    userId: readString(value, 'userId'),
    balanceFen: readNumber(value, 'balanceFen'),
    quotaRemaining: readNumber(value, 'quotaRemaining'),
    quotaUsedThisMonth: readNumber(value, 'quotaUsedThisMonth'),
  }
}

function parseUsageStatus(value: string): UsageStatus {
  if (value === 'consumed' || value === 'refunded') return value
  throw new Error('字段 status 不是有效额度状态')
}

function parseQuotaUsage(value: unknown): QuotaUsageRecord {
  if (!isObject(value)) throw new Error('额度记录必须是对象')
  const amount = readNumber(value, 'amount')
  if (!Number.isInteger(amount) || amount < 0) throw new Error('字段 amount 必须是非负整数')
  return {
    id: readString(value, 'id'),
    occurredAt: assertIsoDate(readString(value, 'occurredAt'), 'occurredAt'),
    taskTitle: readString(value, 'taskTitle'),
    amount,
    status: parseUsageStatus(readString(value, 'status')),
  }
}

function parseCursorPage<T>(value: unknown, parseItem: (item: unknown) => T): CursorPage<T> {
  if (!isObject(value)) throw new Error('分页结果必须是对象')
  return {
    items: readArray(value.items, 'items').map(parseItem),
    nextCursor: readNullableString(value, 'nextCursor'),
  }
}

const parseTrendingPage: RuntimeParser<CursorPage<HotRankingRecord>> = (value) =>
  parseCursorPage(value, parseTrendingItem)
const parseHistoryPage: RuntimeParser<CursorPage<VideoHistoryRecord>> = (value) =>
  parseCursorPage(value, parseVideoTask)
const parseUsagePage: RuntimeParser<CursorPage<QuotaUsageRecord>> = (value) =>
  parseCursorPage(value, parseQuotaUsage)

function parseWorkspaceSource(value: unknown): WorkspaceSource {
  if (!isObject(value)) throw new Error('分析来源必须是对象')
  const kind = readString(value, 'kind')
  if (kind === 'link') return { kind, url: readString(value, 'url') }
  if (kind === 'file') {
    return {
      kind,
      name: readString(value, 'name'),
      sizeBytes: readNumber(value, 'sizeBytes'),
      mimeType: readString(value, 'mimeType'),
    }
  }
  throw new Error('分析来源类型无效')
}

function parseMediaReference(value: unknown): MediaReference {
  if (!isObject(value)) throw new Error('关联素材必须是对象')
  return {
    id: readString(value, 'id'),
    label: readString(value, 'label'),
    imageUrl: readNullableString(value, 'imageUrl') ?? undefined,
  }
}

function parseOptionalMedia(
  record: Record<string, unknown>,
  key: 'scene' | 'product',
): MediaReference | undefined {
  const value = record[key]
  return value === undefined || value === null ? undefined : parseMediaReference(value)
}

function parseCharacters(record: Record<string, unknown>): MediaReference[] {
  const characters = record.characters
  if (Array.isArray(characters)) return characters.map(parseMediaReference)
  const legacyCharacter = record.character
  return legacyCharacter === undefined || legacyCharacter === null
    ? []
    : [parseMediaReference(legacyCharacter)]
}

function parseStoryboardSegment(value: unknown): StoryboardSegment {
  if (!isObject(value)) throw new Error('分镜必须是对象')
  return {
    id: readString(value, 'id'),
    number: readNumber(value, 'number'),
    firstFrameUrl: readString(value, 'firstFrameUrl'),
    content: readString(value, 'content'),
    characters: parseCharacters(value),
    scene: parseOptionalMedia(value, 'scene'),
  }
}

function parseAnalysisProduct(
  analysis: Record<string, unknown>,
  rawSegments: unknown[],
): MediaReference | undefined {
  const product = parseOptionalMedia(analysis, 'product')
  if (product) return product
  for (const rawSegment of rawSegments) {
    if (!isObject(rawSegment)) continue
    const legacyProduct = parseOptionalMedia(rawSegment, 'product')
    if (legacyProduct) return legacyProduct
  }
  return undefined
}

function parseVideoAnalysis(value: unknown): VideoAnalysisResult {
  if (!isObject(value)) throw new Error('分析结果必须是对象')
  const origin = readString(value, 'origin')
  if (origin !== 'cached' && origin !== 'fresh') throw new Error('分析来源标记无效')
  const rawSegments = readArray(value.segments, 'segments')
  return {
    analysisId: readString(value, 'analysisId'),
    source: parseWorkspaceSource(value.source),
    sourceUrl: readNullableString(value, 'sourceUrl') ?? undefined,
    analyzedAt: assertIsoDate(readString(value, 'analyzedAt'), 'analyzedAt'),
    origin,
    product: parseAnalysisProduct(value, rawSegments),
    segments: rawSegments.map(parseStoryboardSegment),
  }
}

const parseVideoAnalysisLookup: RuntimeParser<VideoAnalysisLookupResult> = (value) => {
  if (!isObject(value)) throw new Error('历史分析查询结果必须是对象')
  const hit = readBoolean(value, 'hit')
  if (!hit) return { hit: false }
  return { hit: true, result: parseVideoAnalysis(value.result) }
}

const parseVideoAnalysisResult: RuntimeParser<VideoAnalysisResult> = parseVideoAnalysis

const parseDownloadTicket: RuntimeParser<DownloadTicket> = (value) => {
  if (!isObject(value)) throw new Error('下载凭证必须是对象')
  const expiresAt = readNullableString(value, 'expiresAt')
  if (expiresAt) assertIsoDate(expiresAt, 'expiresAt')
  return {
    url: readString(value, 'url'),
    filename: readString(value, 'filename'),
    expiresAt,
  }
}

function buildQuery(entries: Record<string, string | number | null | undefined>): string {
  const params = new URLSearchParams()
  Object.entries(entries).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  })
  const query = params.toString()
  return query ? `?${query}` : ''
}

export class HttpDataProvider implements DataProvider {
  readonly mode = 'api' as const

  constructor(private readonly baseUrl: string) {}

  lookupVideoAnalysis(
    sourceUrl: string,
    signal?: AbortSignal,
  ): Promise<VideoAnalysisLookupResult> {
    return requestApiData({
      baseUrl: this.baseUrl,
      path: `/api/v1/video-analysis/lookup${buildQuery({ sourceUrl })}`,
      signal,
      parser: parseVideoAnalysisLookup,
    })
  }

  analyzeVideo(source: WorkspaceSource, signal?: AbortSignal): Promise<VideoAnalysisResult> {
    return requestApiData({
      baseUrl: this.baseUrl,
      path: '/api/v1/video-analysis',
      method: 'POST',
      body: { source },
      signal,
      parser: parseVideoAnalysisResult,
      timeoutMs: 120_000,
    })
  }

  async getTrendingCategories(signal?: AbortSignal): Promise<CategoryResult> {
    try {
      const items = await requestApiData({
        baseUrl: this.baseUrl,
        path: '/api/v1/trending/categories',
        signal,
        parser: parseCategories,
      })
      return { items, usedFallback: false }
    } catch (error) {
      if (signal?.aborted) throw error
      return { items: trendingIndustries, usedFallback: true }
    }
  }

  getTrendingVideos(
    query: TrendingVideosQuery,
    signal?: AbortSignal,
  ): Promise<CursorPage<HotRankingRecord>> {
    const suffix = buildQuery({
      industryId: query.industryId,
      subcategoryId: query.subcategoryId,
      duration: query.duration,
      cursor: query.cursor,
      limit: query.limit ?? 20,
    })
    return requestApiData({
      baseUrl: this.baseUrl,
      path: `/api/v1/trending/videos${suffix}`,
      signal,
      parser: parseTrendingPage,
    })
  }

  getVideoTasks(
    cursor?: string | null,
    limit = 20,
    signal?: AbortSignal,
  ): Promise<CursorPage<VideoHistoryRecord>> {
    const suffix = buildQuery({ cursor, limit })
    return requestApiData({
      baseUrl: this.baseUrl,
      path: `/api/v1/video-tasks${suffix}`,
      signal,
      parser: parseHistoryPage,
    })
  }

  deleteVideoTask(id: string, signal?: AbortSignal): Promise<void> {
    return requestApiVoid({
      baseUrl: this.baseUrl,
      path: `/api/v1/video-tasks/${encodeURIComponent(id)}`,
      method: 'DELETE',
      signal,
    })
  }

  getDownloadTicket(id: string, signal?: AbortSignal): Promise<DownloadTicket> {
    return requestApiData({
      baseUrl: this.baseUrl,
      path: `/api/v1/video-tasks/${encodeURIComponent(id)}/download-url`,
      method: 'POST',
      signal,
      parser: parseDownloadTicket,
    })
  }

  getAccountSummary(signal?: AbortSignal): Promise<AccountProfile> {
    return requestApiData({
      baseUrl: this.baseUrl,
      path: '/api/v1/account/summary',
      signal,
      parser: parseAccount,
    })
  }

  getQuotaUsages(
    cursor?: string | null,
    limit = 20,
    signal?: AbortSignal,
  ): Promise<CursorPage<QuotaUsageRecord>> {
    const suffix = buildQuery({ cursor, limit })
    return requestApiData({
      baseUrl: this.baseUrl,
      path: `/api/v1/account/quota-usages${suffix}`,
      signal,
      parser: parseUsagePage,
    })
  }
}
