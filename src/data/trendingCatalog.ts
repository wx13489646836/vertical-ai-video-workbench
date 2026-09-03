import { clothingRankingRecords } from './clothingRankings'
import { hotRankingRecords } from './localData'
import type { HotRankingRecord } from '../types'

export const trendingDurationFilters = ['不限', '15秒内', '1分钟内', '>1分钟'] as const

export type TrendingDuration = (typeof trendingDurationFilters)[number]

export interface TrendingSubcategory {
  id: string
  name: string
}

export interface TrendingIndustry {
  id: string
  name: string
  children: readonly TrendingSubcategory[]
}

export interface MockTrendingRankingQuery {
  industryId: string
  subcategoryId: string
  duration: TrendingDuration
  limit?: number
}

export interface MockTrendingRankingResult {
  records: HotRankingRecord[]
  total: number
  source: 'snapshot' | 'mock'
  query: Required<MockTrendingRankingQuery>
}

export const trendingIndustries: readonly TrendingIndustry[] = [
  { id: 'clothing', name: '服装', children: [{ id: 'clothing-all', name: '服装' }] },
  {
    id: 'home',
    name: '家居日用',
    children: [
      { id: 'home-daily', name: '居家日用' },
      { id: 'furniture', name: '家具' },
      { id: 'home-cleaning', name: '家清纸品' },
      { id: 'appliances', name: '电器' },
      { id: 'electronics', name: '电子/电工' },
      { id: 'hardware-tools', name: '五金/工具' },
      { id: 'kitchenware', name: '餐饮厨具' },
      { id: 'building-materials', name: '家装建材' },
      { id: 'automotive', name: '汽车用品' },
      { id: 'lighting', name: '家装灯饰光源' },
    ],
  },
  {
    id: 'food',
    name: '食品饮料',
    children: [
      { id: 'frozen-food', name: '冷冻/冷藏制品' },
      { id: 'fresh-catering', name: '现制餐饮美食' },
      { id: 'pantry-food', name: '粮油干货/方便速食' },
      { id: 'beverages', name: '水饮冲调' },
      { id: 'snacks', name: '休闲食品' },
    ],
  },
  { id: 'beauty', name: '美妆', children: [{ id: 'beauty-fragrance', name: '彩妆香水' }] },
  {
    id: 'fresh',
    name: '生鲜',
    children: [
      { id: 'seafood', name: '海鲜水产' },
      { id: 'meat-eggs', name: '肉禽蛋品' },
      { id: 'fruit-vegetables', name: '水果蔬菜' },
    ],
  },
  {
    id: 'jewelry',
    name: '珠宝文玩',
    children: [
      { id: 'collectibles', name: '文玩收藏' },
      { id: 'crafts', name: '工艺品' },
      { id: 'jewelry-gold', name: '黄金珠宝玉石' },
    ],
  },
  {
    id: 'maternal-pet',
    name: '母婴宠物',
    children: [
      { id: 'pet-life', name: '宠物生活' },
      { id: 'maternal-baby', name: '母婴用品' },
    ],
  },
  { id: 'digital', name: '3C数码家电', children: [{ id: 'digital-accessories', name: '3C数码及配件' }] },
  {
    id: 'shoes-bags',
    name: '鞋靴箱包',
    children: [
      { id: 'bags', name: '箱包' },
      { id: 'shoes', name: '鞋靴' },
    ],
  },
  {
    id: 'sports',
    name: '运动户外',
    children: [
      { id: 'sports-leisure', name: '运动休闲用品' },
      { id: 'outdoor-gear', name: '户外装备' },
    ],
  },
  { id: 'liquor', name: '酒类', children: [{ id: 'liquor-all', name: '酒类' }] },
  { id: 'personal-care', name: '个人护理', children: [{ id: 'personal-care-all', name: '个人护理' }] },
  {
    id: 'watches',
    name: '钟表饰品',
    children: [
      { id: 'watches-glasses', name: '钟表眼镜' },
      { id: 'fashion-accessories', name: '时尚饰品' },
    ],
  },
  { id: 'health', name: '滋补保健', children: [{ id: 'traditional-health', name: '传统滋补' }] },
  {
    id: 'toys',
    name: '玩具乐器',
    children: [
      { id: 'musical-instruments', name: '乐器及配件' },
      { id: 'toys-all', name: '玩具' },
    ],
  },
  {
    id: 'books',
    name: '图书教育',
    children: [
      { id: 'office-supplies', name: '办公设备及耗材' },
      { id: 'books-periodicals', name: '书籍/杂志/报纸' },
    ],
  },
  { id: 'flowers', name: '鲜花园艺', children: [{ id: 'gardening', name: '农资园艺' }] },
]

const durationRanges: Record<Exclude<TrendingDuration, '不限'>, readonly [number, number]> = {
  '15秒内': [8, 15],
  '1分钟内': [16, 60],
  '>1分钟': [61, 150],
}

const playCounts = ['1800万+', '1500万+', '1200万+', '1000万+', '800万+', '500万+', '300万+', '200万+']
const settlements = ['100万-250万', '50万-100万', '25万-50万', '10万-25万', '5万-10万']
const likeCounts = ['12万+', '8.6万+', '6.2万+', '4.8万+', '3.5万+', '2.1万+', '9800+']

function stableHash(value: string): number {
  return Array.from(value).reduce((hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0, 2166136261)
}

function findSubcategory(query: MockTrendingRankingQuery): TrendingSubcategory | undefined {
  return trendingIndustries
    .find((industry) => industry.id === query.industryId)
    ?.children.find((subcategory) => subcategory.id === query.subcategoryId)
}

function getDuration(duration: TrendingDuration, index: number, seed: number): number {
  if (duration === '不限') {
    const mixedDurations = [12, 24, 35, 48, 59, 68, 83, 101, 123, 145]
    return mixedDurations[(index + seed) % mixedDurations.length]
  }

  const [minimum, maximum] = durationRanges[duration]
  return minimum + ((seed + index * 7) % (maximum - minimum + 1))
}

function createMockRecords(
  query: Required<MockTrendingRankingQuery>,
  subcategory: TrendingSubcategory,
): HotRankingRecord[] {
  const seed = stableHash(`${query.industryId}:${query.subcategoryId}:${query.duration}`)
  const durationKey = query.duration === '不限' ? 'all' : stableHash(query.duration).toString(36)

  return Array.from({ length: query.limit }, (_, index) => {
    const base = hotRankingRecords[(index + seed) % hotRankingRecords.length]
    const serial = index + 1
    const keyword = `${subcategory.name}${base.productName}`
    const encodedKeyword = encodeURIComponent(keyword)

    return {
      ...base,
      id: `mock-${query.industryId}-${query.subcategoryId}-${durationKey}-${serial}`,
      rank: serial,
      title: `${subcategory.name}热榜｜${base.title}${index >= hotRankingRecords.length ? ` · 续榜 ${serial}` : ''}`,
      creator: `${subcategory.name}选品官·${base.creator}`,
      creatorAvatarUrl: `https://i.pravatar.cc/96?img=${((seed + serial) % 70) + 1}`,
      creatorLevel: ((seed + serial) % 7) + 1,
      productName: `${subcategory.name}｜${base.productName}`,
      productUrl: `https://www.douyin.com/search/${encodedKeyword}?type=general`,
      publishedAt: `2026/09/${String(2 - (index % 2)).padStart(2, '0')} ${String(8 + ((seed + index) % 14)).padStart(2, '0')}:${String((seed + index * 11) % 60).padStart(2, '0')}:00`,
      durationSeconds: getDuration(query.duration, index, seed),
      playCount: playCounts[(index + seed) % playCounts.length],
      settlementAmount: settlements[(index + Math.floor(seed / 3)) % settlements.length],
      likeCount: likeCounts[(index + Math.floor(seed / 7)) % likeCounts.length],
      sourceUrl: `https://www.douyin.com/search/${encodedKeyword}?type=video`,
      videoUrl: undefined,
    }
  })
}

/**
 * 仅供 MockDataProvider 生成稳定的本地演示榜单。
 * 真实接口契约由 DataProvider 统一承载。
 */
export function getMockTrendingRankings(query: MockTrendingRankingQuery): MockTrendingRankingResult {
  const limit = Math.max(1, Math.min(query.limit ?? 20, 50))
  const normalizedQuery: Required<MockTrendingRankingQuery> = { ...query, limit }

  if (query.industryId === 'clothing') {
    const records = clothingRankingRecords[query.duration].slice(0, limit)
    return { records, total: records.length, source: 'snapshot', query: normalizedQuery }
  }

  const subcategory = findSubcategory(query)
  if (!subcategory) {
    return { records: [], total: 0, source: 'mock', query: normalizedQuery }
  }

  const records = createMockRecords(normalizedQuery, subcategory)
  return { records, total: records.length, source: 'mock', query: normalizedQuery }
}
