import type {
  MediaReference,
  StoryboardSegment,
  VideoAnalysisResult,
  WorkspaceSource,
} from '../types'

export const demoCachedSourceUrl = 'https://www.douyin.com/video/7368888888888888888'

const mockProduct: MediaReference = {
  id: 'product-coat',
  label: '复古短外套',
  imageUrl: '/trending/clothing-short-01.jpg',
}

const mockSegments: StoryboardSegment[] = [
  {
    id: 'shot-01',
    number: 1,
    firstFrameUrl: '/trending/clothing-week-01.jpg',
    content: '人物从画面右侧进入，拿起外套并向镜头展示整体版型。',
    characters: [{ id: 'character-host', label: '出镜达人', imageUrl: '/trending/avatars/clothing-author-01.jpg' }],
    scene: { id: 'scene-studio', label: '极简试衣间', imageUrl: '/trending/clothing-week-08.jpg' },
  },
  {
    id: 'shot-02',
    number: 2,
    firstFrameUrl: '/trending/clothing-week-02.jpg',
    content: '中景展示上身效果，人物转身呈现肩线和背部剪裁。',
    characters: [
      { id: 'character-host', label: '出镜达人', imageUrl: '/trending/avatars/clothing-author-01.jpg' },
      { id: 'character-stylist', label: '搭配师', imageUrl: '/trending/avatars/clothing-author-04.jpg' },
    ],
    scene: { id: 'scene-studio', label: '极简试衣间', imageUrl: '/trending/clothing-week-08.jpg' },
  },
  {
    id: 'shot-03',
    number: 3,
    firstFrameUrl: '/trending/clothing-week-03.jpg',
    content: '镜头推进至衣领和纽扣，手部指出面料纹理与细节。',
    characters: [],
    scene: { id: 'scene-detail', label: '产品细节台', imageUrl: '/trending/clothing-week-09.jpg' },
  },
  {
    id: 'shot-04',
    number: 4,
    firstFrameUrl: '/trending/clothing-week-04.jpg',
    content: '切换到街景，人物边走边展示衣摆动态和日常搭配。',
    characters: [
      { id: 'character-host', label: '出镜达人', imageUrl: '/trending/avatars/clothing-author-01.jpg' },
      { id: 'character-companion', label: '同行好友', imageUrl: '/trending/avatars/clothing-author-05.jpg' },
      { id: 'character-stylist', label: '搭配师', imageUrl: '/trending/avatars/clothing-author-04.jpg' },
      { id: 'character-photographer', label: '随行摄影师', imageUrl: '/trending/avatars/clothing-author-07.jpg' },
      { id: 'character-passerby', label: '街景路人', imageUrl: '/trending/avatars/clothing-author-08.jpg' },
    ],
    scene: { id: 'scene-street', label: '城市街角', imageUrl: '/trending/clothing-week-10.jpg' },
  },
  {
    id: 'shot-05',
    number: 5,
    firstFrameUrl: '/trending/clothing-week-05.jpg',
    content: '左右分屏对比不同搭配，字幕强调显高和轻量特点。',
    characters: [
      { id: 'character-model', label: '搭配模特', imageUrl: '/trending/avatars/clothing-author-03.jpg' },
      { id: 'character-assistant', label: '试穿助理', imageUrl: '/trending/avatars/clothing-author-06.jpg' },
    ],
    scene: { id: 'scene-studio', label: '极简试衣间', imageUrl: '/trending/clothing-week-08.jpg' },
  },
  {
    id: 'shot-06',
    number: 6,
    firstFrameUrl: '/trending/clothing-week-06.jpg',
    content: '人物正对镜头完成总结，画面停留在完整穿搭和行动提示。',
    characters: [{ id: 'character-host', label: '出镜达人', imageUrl: '/trending/avatars/clothing-author-01.jpg' }],
    scene: { id: 'scene-street', label: '城市街角', imageUrl: '/trending/clothing-week-10.jpg' },
  },
]

export function cloneAnalysisResult(result: VideoAnalysisResult): VideoAnalysisResult {
  const product = readAnalysisProduct(result)
  return {
    ...result,
    source: { ...result.source },
    product: product ? { ...product } : undefined,
    segments: result.segments.map(cloneSegment),
  }
}

function cloneSegment(segment: StoryboardSegment): StoryboardSegment {
  const cleanSegment = { ...segment } as StoryboardSegment & { product?: MediaReference }
  delete cleanSegment.product
  return {
    ...cleanSegment,
    characters: readSegmentCharacters(segment).map((character) => ({ ...character })),
    scene: segment.scene ? { ...segment.scene } : undefined,
  }
}

function readAnalysisProduct(result: VideoAnalysisResult): MediaReference | undefined {
  if (result.product) return result.product
  const legacySegments = result.segments as Array<StoryboardSegment & { product?: MediaReference }>
  return legacySegments.find((segment) => segment.product)?.product
}

function readSegmentCharacters(segment: StoryboardSegment): MediaReference[] {
  const legacySegment = segment as StoryboardSegment & { character?: MediaReference }
  if (Array.isArray(segment.characters)) return segment.characters
  return legacySegment.character ? [legacySegment.character] : []
}

export function createMockAnalysis(
  source: WorkspaceSource,
  origin: VideoAnalysisResult['origin'] = 'fresh',
): VideoAnalysisResult {
  const sourceUrl = source.kind === 'link' ? source.url : undefined
  return {
    analysisId: `analysis-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    source: { ...source },
    sourceUrl,
    analyzedAt: new Date().toISOString(),
    origin,
    product: { ...mockProduct },
    segments: cloneAnalysisResult({
      analysisId: 'template',
      source,
      sourceUrl,
      analyzedAt: new Date().toISOString(),
      origin,
      product: mockProduct,
      segments: mockSegments,
    }).segments,
  }
}

export function createSeededCachedAnalysis(): VideoAnalysisResult {
  return {
    ...createMockAnalysis({ kind: 'link', url: demoCachedSourceUrl }, 'cached'),
    analysisId: 'analysis-public-demo-01',
    analyzedAt: '2026-08-28T10:24:00+08:00',
  }
}
