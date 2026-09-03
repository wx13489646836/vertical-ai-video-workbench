import { afterEach, describe, expect, it, vi } from 'vitest'
import { HttpDataProvider } from './httpDataProvider'
import { MockDataProvider } from './mockDataProvider'
import { DataProviderError } from './dataProvider'
import { requestApiData } from './httpClient'
import { demoCachedSourceUrl } from './workspaceAnalysis'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('MockDataProvider', () => {
  it('returns the seeded public analysis without running a new analysis', async () => {
    const provider = new MockDataProvider()
    const lookup = await provider.lookupVideoAnalysis(demoCachedSourceUrl)

    expect(lookup.hit).toBe(true)
    if (lookup.hit) {
      expect(lookup.result.origin).toBe('cached')
      expect(lookup.result.segments).toHaveLength(6)
      expect(lookup.result.product?.label).toBe('复古短外套')
      expect(lookup.result.segments.every((segment) => !('product' in segment))).toBe(true)
      expect(lookup.result.segments.some((segment) => segment.characters.length >= 2)).toBe(true)
      expect(lookup.result.segments.some((segment) => segment.characters.length === 0)).toBe(true)
    }
  })

  it('caches fresh link analysis without persisting user mutations', async () => {
    vi.useFakeTimers()
    const provider = new MockDataProvider()
    const sourceUrl = `https://example.com/video/${Date.now()}`

    const missingLookupPromise = provider.lookupVideoAnalysis(sourceUrl)
    await vi.runAllTimersAsync()
    await expect(missingLookupPromise).resolves.toEqual({ hit: false })
    const analysisPromise = provider.analyzeVideo({ kind: 'link', url: sourceUrl })
    await vi.runAllTimersAsync()
    const fresh = await analysisPromise
    const originalContent = fresh.segments[0]?.content
    const originalCharacterLabel = fresh.segments[1]?.characters[0]?.label
    if (fresh.segments[0]) fresh.segments[0].content = '用户个性化修改'
    if (fresh.segments[1]?.characters[0]) fresh.segments[1].characters[0].label = '用户替换人物'

    const lookupPromise = provider.lookupVideoAnalysis(sourceUrl)
    await vi.runAllTimersAsync()
    const lookup = await lookupPromise

    expect(lookup.hit).toBe(true)
    if (lookup.hit) {
      expect(lookup.result.origin).toBe('cached')
      expect(lookup.result.segments[0]?.content).toBe(originalContent)
      expect(lookup.result.segments[1]?.characters[0]?.label).toBe(originalCharacterLabel)
    }
  })

  it('uses stable cursor pages without duplicate records', async () => {
    const provider = new MockDataProvider()
    const query = {
      industryId: 'home',
      subcategoryId: 'furniture',
      duration: 'all' as const,
      limit: 20,
    }
    const first = await provider.getTrendingVideos(query)
    const second = await provider.getTrendingVideos({ ...query, cursor: first.nextCursor })

    expect(first.items).toHaveLength(20)
    expect(first.nextCursor).toBe('20')
    expect(second.items).toHaveLength(20)
    expect(second.nextCursor).toBeNull()
    expect(new Set([...first.items, ...second.items].map((item) => item.id)).size).toBe(40)
  })

  it('keeps every lte_15 mock video inside the requested range', async () => {
    const provider = new MockDataProvider()
    const page = await provider.getTrendingVideos({
      industryId: 'home',
      subcategoryId: 'furniture',
      duration: 'lte_15',
      limit: 20,
    })
    expect(page.items.every((item) => item.durationSeconds <= 15)).toBe(true)
  })
})

describe('HttpDataProvider', () => {
  it('parses multi-character segments and normalizes the legacy character field', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({
        data: {
          hit: true,
          result: {
            analysisId: 'analysis-characters',
            source: { kind: 'link', url: 'https://example.com/video' },
            sourceUrl: 'https://example.com/video',
            analyzedAt: '2026-09-02T16:00:00+08:00',
            origin: 'cached',
            segments: [
              {
                id: 'shot-multi', number: 1, firstFrameUrl: '/frame-1.jpg', content: '双人镜头',
                product: { id: 'legacy-product', label: '旧接口产品', imageUrl: '/product.jpg' },
                characters: [
                  { id: 'person-1', label: '人物一', imageUrl: null },
                  { id: 'person-2', label: '人物二', imageUrl: null },
                ],
              },
              {
                id: 'shot-legacy', number: 2, firstFrameUrl: '/frame-2.jpg', content: '旧接口单人镜头',
                character: { id: 'person-legacy', label: '旧人物', imageUrl: null },
              },
            ],
          },
        },
      }), { status: 200 })),
    )
    const provider = new HttpDataProvider('https://api.example.com/')

    const lookup = await provider.lookupVideoAnalysis('https://example.com/video')

    expect(lookup.hit).toBe(true)
    if (lookup.hit) {
      expect(lookup.result.product).toEqual({ id: 'legacy-product', label: '旧接口产品', imageUrl: '/product.jpg' })
      expect(lookup.result.segments.every((segment) => !('product' in segment))).toBe(true)
      expect(lookup.result.segments[0]?.characters).toHaveLength(2)
      expect(lookup.result.segments[1]?.characters).toEqual([
        { id: 'person-legacy', label: '旧人物', imageUrl: undefined },
      ])
    }
  })

  it('parses successful payloads for trending, history, and account pages', async () => {
    const payloads: Record<string, unknown> = {
      '/api/v1/trending/categories': [
        { id: 'home', name: '家居日用', children: [{ id: 'furniture', name: '家具' }] },
      ],
      '/api/v1/trending/videos': {
        items: [
          {
            id: 'trend-1', platform: 'douyin', rank: 1, title: '标题',
            creator: { name: '作者', avatarUrl: 'https://example.com/avatar.jpg', level: 5 },
            coverUrl: 'https://example.com/cover.jpg',
            product: { name: '商品', url: 'https://example.com/product' },
            publishedAt: '2026-09-02T15:40:20+08:00', durationSeconds: 30,
            metrics: {
              playCount: { value: 1000, label: '1000+' },
              settlementAmount: { minFen: 10000, maxFen: 20000, label: '100-200' },
              likeCount: { value: 100, label: '100+' },
            },
            sourceUrl: 'https://example.com/source', videoUrl: null,
          },
        ],
        nextCursor: null,
      },
      '/api/v1/video-tasks': {
        items: [
          {
            id: 'task-1', title: '任务', sourceUrl: 'https://example.com/source', videoUrl: null,
            coverUrl: 'https://example.com/cover.jpg', generatedAt: '2026-09-02T13:48:00+08:00',
            durationSeconds: 31, status: 'processing', progress: 68, failureReason: null,
            playbackAvailable: false,
            inputSnapshot: {
              sourceVideo: {
                kind: 'link', videoUrl: 'https://example.com/original.mp4',
                coverUrl: 'https://example.com/original.jpg', durationSeconds: 36, fileName: null,
              },
              products: [{
                id: 'product-map-1',
                original: { id: 'product-original-1', label: '原产品', imageUrl: 'https://example.com/original-product.jpg' },
                replacement: { id: 'product-1', label: '产品图', imageUrl: 'https://example.com/product.jpg' },
              }],
              characters: [{ id: 'character-1', label: '替换人物', imageUrl: null }],
              scenes: [],
            },
          },
          {
            id: 'task-failed', title: '失败任务', sourceUrl: null, videoUrl: null,
            coverUrl: null, generatedAt: '2026-09-02T13:58:00+08:00',
            durationSeconds: 0, status: 'failed', failureReason: '生成失败',
            playbackAvailable: false,
          },
        ],
        nextCursor: null,
      },
      '/api/v1/account/summary': {
        avatarUrl: 'https://example.com/avatar.jpg', nickname: '用户', maskedPhone: '138 **** 0000',
        userId: 'user-1', balanceFen: 8650, quotaRemaining: 28, quotaUsedThisMonth: 12,
      },
      '/api/v1/account/quota-usages': {
        items: [
          { id: 'usage-1', occurredAt: '2026-09-01T14:32:00+08:00', taskTitle: '任务', amount: 4, status: 'consumed' },
        ],
        nextCursor: null,
      },
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const path = new URL(String(input)).pathname
        return new Response(JSON.stringify({ data: payloads[path] }), { status: 200 })
      }),
    )
    const provider = new HttpDataProvider('https://api.example.com/')

    const categories = await provider.getTrendingCategories()
    const trending = await provider.getTrendingVideos({
      industryId: 'home', subcategoryId: 'furniture', duration: 'all',
    })
    const history = await provider.getVideoTasks()
    const account = await provider.getAccountSummary()
    const usages = await provider.getQuotaUsages()

    expect(categories.items[0]?.children[0]?.id).toBe('furniture')
    expect(trending.items[0]?.playCount).toBe('1000+')
    expect(history.items[0]?.progress).toBe(68)
    expect(history.items[0]?.inputSnapshot?.products[0]?.original.label).toBe('原产品')
    expect(history.items[0]?.inputSnapshot?.products[0]?.replacement.label).toBe('产品图')
    expect(history.items[0]?.inputSnapshot?.characters[0]).toMatchObject({
      original: { label: '原素材未记录' },
      replacement: { label: '替换人物' },
    })
    expect(history.items[0]?.inputSnapshot?.sourceVideo?.kind).toBe('link')
    expect(history.items[1]).toMatchObject({
      id: 'task-failed',
      sourceUrl: undefined,
      coverUrl: undefined,
    })
    expect(account.balanceFen).toBe(8650)
    expect(usages.items[0]?.status).toBe('consumed')
  })

  it('serializes trending filters and cursor parameters', async () => {
    let requestedUrl = ''
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      requestedUrl = String(input)
      return new Response(JSON.stringify({ data: { items: [], nextCursor: null } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)
    const provider = new HttpDataProvider('https://api.example.com/')

    await provider.getTrendingVideos({
      industryId: 'home',
      subcategoryId: 'furniture',
      duration: 'lte_60',
      cursor: 'cursor-2',
      limit: 20,
    })

    expect(requestedUrl).toContain('/api/v1/trending/videos?')
    expect(requestedUrl).toContain('industryId=home')
    expect(requestedUrl).toContain('subcategoryId=furniture')
    expect(requestedUrl).toContain('duration=lte_60')
    expect(requestedUrl).toContain('cursor=cursor-2')
  })

  it('rejects malformed API data at the runtime boundary', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ data: { nickname: '缺少字段' } }), { status: 200 })),
    )
    const provider = new HttpDataProvider('https://api.example.com/')

    await expect(provider.getAccountSummary()).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    } satisfies Partial<DataProviderError>)
  })

  it('preserves backend error codes and request ids', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({ code: 'TASK_LOCKED', message: '任务正在处理中', requestId: 'req-1' }),
          { status: 409 },
        ),
      ),
    )
    const provider = new HttpDataProvider('https://api.example.com/')

    await expect(provider.deleteVideoTask('task-1')).rejects.toMatchObject({
      code: 'TASK_LOCKED',
      requestId: 'req-1',
      status: 409,
    } satisfies Partial<DataProviderError>)
  })

  it('falls back to local categories when the category endpoint is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline') }))
    const provider = new HttpDataProvider('https://api.example.com/')

    const result = await provider.getTrendingCategories()
    expect(result.usedFallback).toBe(true)
    expect(result.items.length).toBeGreaterThan(0)
  })

  it('turns request timeouts into a stable provider error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
        }),
      ),
    )

    await expect(
      requestApiData({
        baseUrl: 'https://api.example.com/',
        path: '/slow',
        timeoutMs: 5,
        parser: () => true,
      }),
    ).rejects.toMatchObject({ code: 'REQUEST_TIMEOUT' } satisfies Partial<DataProviderError>)
  })
})
