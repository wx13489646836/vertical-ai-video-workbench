export type GenerationStatus = 'queued' | 'processing' | 'completed' | 'failed'

export interface HistorySourceVideo {
  kind: 'link' | 'file'
  videoUrl?: string
  coverUrl?: string
  durationSeconds: number
  fileName?: string
}

export interface HistoryInputSnapshot {
  sourceVideo?: HistorySourceVideo
  products: HistoryReplacementMapping[]
  characters: HistoryReplacementMapping[]
  scenes: HistoryReplacementMapping[]
}

export interface HistoryReplacementMapping {
  id: string
  original: MediaReference
  replacement: MediaReference
}

export interface VideoHistoryRecord {
  id: string
  title: string
  sourceUrl?: string
  videoUrl?: string
  coverUrl?: string
  generatedAt: string
  durationSeconds: number
  status: GenerationStatus
  progress?: number
  failureReason?: string
  playbackAvailable: boolean
  inputSnapshot?: HistoryInputSnapshot
}

export interface AccountProfile {
  avatarUrl: string
  nickname: string
  maskedPhone: string
  userId: string
  balanceFen: number
  quotaRemaining: number
  quotaUsedThisMonth: number
}

export type UsageStatus = 'consumed' | 'refunded'

export interface QuotaUsageRecord {
  id: string
  occurredAt: string
  taskTitle: string
  amount: number
  status: UsageStatus
}

export interface RemakeSource {
  sourceType: 'history' | 'trending'
  businessId: string
  title: string
  sourceUrl: string
}

export type WorkspacePhase =
  | 'source'
  | 'checking-cache'
  | 'analyzing'
  | 'result'
  | 'generating'
  | 'generated'
  | 'error'

export type WorkspaceSource =
  | { kind: 'link'; url: string }
  | { kind: 'file'; name: string; sizeBytes: number; mimeType: string }

export type AnalysisOrigin = 'cached' | 'fresh'

export interface AnalysisStage {
  id: 'frames' | 'entities' | 'relations'
  label: string
  progress: number
}

export interface MediaReference {
  id: string
  label: string
  imageUrl?: string
}

export interface StoryboardSegment {
  id: string
  number: number
  firstFrameUrl: string
  content: string
  characters: MediaReference[]
  scene?: MediaReference
}

export interface VideoAnalysisResult {
  analysisId: string
  source: WorkspaceSource
  sourceUrl?: string
  analyzedAt: string
  origin: AnalysisOrigin
  product?: MediaReference
  segments: StoryboardSegment[]
}

export type VideoAnalysisLookupResult =
  | { hit: true; result: VideoAnalysisResult }
  | { hit: false }

export interface ProductReferenceImage {
  id: string
  fileName: string
  imageUrl: string
}

export interface ReplacementRequest {
  type: 'character' | 'scene'
  originalId: string
  replacement: MediaReference
}

export type CommercePlatform = 'douyin' | 'dou_store'

export interface HotRankingRecord {
  id: string
  platform: CommercePlatform
  rank: number
  title: string
  creator: string
  creatorAvatarUrl: string
  creatorLevel: number
  coverUrl: string
  productName: string
  productUrl: string
  price?: number
  publishedAt: string
  durationSeconds: number
  playCount: string
  settlementAmount: string
  likeCount: string
  sourceUrl: string
  videoUrl?: string
}
