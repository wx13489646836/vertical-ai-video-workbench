import type {
  AccountProfile,
  HistoryInputSnapshot,
  HistoryReplacementMapping,
  HotRankingRecord,
  QuotaUsageRecord,
  VideoHistoryRecord,
} from '../types'

const STORAGE_KEYS = {
  deletedIds: 'framecraft.deleted-video-ids',
} as const

const demoVideoUrl =
  'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'

function createReplacementMapping({
  id,
  originalLabel,
  originalImageUrl,
  replacementLabel,
  replacementImageUrl,
}: {
  id: string
  originalLabel: string
  originalImageUrl: string
  replacementLabel: string
  replacementImageUrl: string
}): HistoryReplacementMapping {
  return {
    id,
    original: { id: `${id}-original`, label: originalLabel, imageUrl: originalImageUrl },
    replacement: { id: `${id}-replacement`, label: replacementLabel, imageUrl: replacementImageUrl },
  }
}

function createDemoInputSnapshot({
  index,
  coverUrl,
  durationSeconds,
  product,
  character,
  scene,
}: {
  index: number
  coverUrl: string
  durationSeconds: number
  product: string
  character: string
  scene: string
}): HistoryInputSnapshot {
  const assetNumber = String(index).padStart(2, '0')
  return {
    sourceVideo: {
      kind: 'link',
      videoUrl: demoVideoUrl,
      coverUrl,
      durationSeconds,
    },
    products: [createReplacementMapping({
      id: `history-product-${index}`,
      originalLabel: '原视频商品',
      originalImageUrl: `/trending/clothing-video-${10 + index}.jpg`,
      replacementLabel: product,
      replacementImageUrl: `/trending/clothing-week-${assetNumber}.jpg`,
    })],
    characters: [
      createReplacementMapping({
        id: `history-character-${index}-1`,
        originalLabel: '原视频出镜人物',
        originalImageUrl: `/trending/clothing-video-${30 + index}.jpg`,
        replacementLabel: character,
        replacementImageUrl: `/trending/clothing-video-${50 + index}.jpg`,
      }),
      ...(index === 1 ? [createReplacementMapping({
        id: `history-character-${index}-2`,
        originalLabel: '原视频同行人物',
        originalImageUrl: '/trending/clothing-video-32.jpg',
        replacementLabel: '夜游男主',
        replacementImageUrl: '/trending/clothing-video-52.jpg',
      })] : []),
    ],
    scenes: [
      createReplacementMapping({
        id: `history-scene-${index}-1`,
        originalLabel: '原视频拍摄场景',
        originalImageUrl: `/trending/clothing-video-${20 + index}.jpg`,
        replacementLabel: scene,
        replacementImageUrl: coverUrl,
      }),
      ...(index === 1 ? [createReplacementMapping({
        id: `history-scene-${index}-2`,
        originalLabel: '原视频室内段落',
        originalImageUrl: '/trending/clothing-video-22.jpg',
        replacementLabel: '城市天台',
        replacementImageUrl: '/trending/clothing-video-42.jpg',
      })] : []),
    ],
  }
}

const videoRecords: VideoHistoryRecord[] = [
  {
    id: 'video-240901-01',
    title: '城市夜游氛围片',
    sourceUrl: 'https://v.douyin.com/i8K2example/',
    videoUrl: demoVideoUrl,
    coverUrl:
      'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=520&q=86',
    generatedAt: '2026-09-01T14:32:00+08:00',
    durationSeconds: 28,
    status: 'completed',
    playbackAvailable: true,
    inputSnapshot: createDemoInputSnapshot({
      index: 1,
      coverUrl: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=520&q=86',
      durationSeconds: 34,
      product: '城市通勤斜挎包',
      character: '夜游女主',
      scene: '霓虹街区',
    }),
  },
  {
    id: 'video-240831-02',
    title: '秋日穿搭口播',
    sourceUrl: 'https://www.xiaohongshu.com/explore/demo83',
    videoUrl: demoVideoUrl,
    coverUrl:
      'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=520&q=86',
    generatedAt: '2026-08-31T20:18:00+08:00',
    durationSeconds: 42,
    status: 'completed',
    playbackAvailable: true,
    inputSnapshot: createDemoInputSnapshot({
      index: 2,
      coverUrl: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=520&q=86',
      durationSeconds: 49,
      product: '焦糖色风衣',
      character: '秋日穿搭模特',
      scene: '银杏街道',
    }),
  },
  {
    id: 'video-240830-03',
    title: '咖啡店探店短片',
    sourceUrl: 'https://v.douyin.com/i9CafeDemo/',
    videoUrl: demoVideoUrl,
    coverUrl:
      'https://images.unsplash.com/photo-1445116572660-236099ec97a0?auto=format&fit=crop&w=520&q=86',
    generatedAt: '2026-08-30T11:06:00+08:00',
    durationSeconds: 35,
    status: 'completed',
    playbackAvailable: true,
    inputSnapshot: createDemoInputSnapshot({
      index: 3,
      coverUrl: 'https://images.unsplash.com/photo-1445116572660-236099ec97a0?auto=format&fit=crop&w=520&q=86',
      durationSeconds: 41,
      product: '手冲咖啡套装',
      character: '探店博主',
      scene: '木质咖啡馆',
    }),
  },
  {
    id: 'video-240902-04',
    title: '居家好物节奏混剪',
    sourceUrl: 'https://v.douyin.com/home-demo/',
    coverUrl:
      'https://images.unsplash.com/photo-1556912167-f556f1f39fdf?auto=format&fit=crop&w=520&q=86',
    generatedAt: '2026-09-02T13:48:00+08:00',
    durationSeconds: 31,
    status: 'processing',
    progress: 68,
    playbackAvailable: false,
    inputSnapshot: createDemoInputSnapshot({
      index: 4,
      coverUrl: 'https://images.unsplash.com/photo-1556912167-f556f1f39fdf?auto=format&fit=crop&w=520&q=86',
      durationSeconds: 38,
      product: '多功能料理锅',
      character: '居家体验官',
      scene: '明亮厨房',
    }),
  },
  {
    id: 'video-240902-05',
    title: '新品口播拆条',
    sourceUrl: 'https://v.douyin.com/queued-demo/',
    coverUrl:
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=520&q=86',
    generatedAt: '2026-09-02T13:56:00+08:00',
    durationSeconds: 24,
    status: 'queued',
    progress: 0,
    playbackAvailable: false,
    inputSnapshot: createDemoInputSnapshot({
      index: 5,
      coverUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=520&q=86',
      durationSeconds: 29,
      product: '轻薄机械腕表',
      character: '新品讲解员',
      scene: '极简直播间',
    }),
  },
  {
    id: 'video-240829-06',
    title: '户外装备测评',
    generatedAt: '2026-08-29T16:22:00+08:00',
    durationSeconds: 54,
    status: 'failed',
    failureReason: '源视频已失效，请更换链接后重试。',
    playbackAvailable: false,
  },
]

export const accountProfile: AccountProfile = {
  avatarUrl:
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&q=86',
  nickname: '晚风剪片',
  maskedPhone: '138 **** 5628',
  userId: 'FC-2086-0914',
  balanceFen: 8650,
  quotaRemaining: 28,
  quotaUsedThisMonth: 12,
}

export const usageRecords: QuotaUsageRecord[] = [
  {
    id: 'usage-01',
    occurredAt: '2026-09-01T14:32:00+08:00',
    taskTitle: '城市夜游氛围片',
    amount: 4,
    status: 'consumed',
  },
  {
    id: 'usage-02',
    occurredAt: '2026-08-31T20:18:00+08:00',
    taskTitle: '秋日穿搭口播',
    amount: 5,
    status: 'consumed',
  },
  {
    id: 'usage-03',
    occurredAt: '2026-08-30T11:06:00+08:00',
    taskTitle: '咖啡店探店短片',
    amount: 3,
    status: 'consumed',
  },
  {
    id: 'usage-04',
    occurredAt: '2026-08-28T09:42:00+08:00',
    taskTitle: '任务生成失败返还',
    amount: 2,
    status: 'refunded',
  },
]

type ClothingSnapshotInput = Omit<
  HotRankingRecord,
  'platform' | 'productUrl' | 'sourceUrl' | 'creatorAvatarUrl' | 'creatorLevel'
>

function createClothingSnapshotRecord(
  record: ClothingSnapshotInput,
): HotRankingRecord {
  return {
    ...record,
    platform: 'douyin',
    creatorAvatarUrl: `https://i.pravatar.cc/96?img=${record.rank + 20}`,
    creatorLevel: Math.max(1, 6 - Math.floor((record.rank - 1) / 4)),
    productUrl: `https://www.douyin.com/search/${encodeURIComponent(record.productName)}?type=general`,
    sourceUrl: `https://www.douyin.com/search/${encodeURIComponent(record.title)}?type=general`,
  }
}

export const clothingWeeklyRankingRecords: HotRankingRecord[] = [
  {
    id: '7676855136555634771',
    platform: 'douyin',
    rank: 1,
    title:
      '必须买啊！买回去看看！这个季节当然是买外套啊！！！轻软的真皮外套！#外套 #极简 #高级感穿搭 #老钱风穿搭',
    creator: '小小辣',
    creatorAvatarUrl: 'https://i.pravatar.cc/96?img=21',
    creatorLevel: 5,
    coverUrl: '/trending/clothing-week-01.jpg',
    productName: '【复古骑士】2026春秋装新款皮衣SSS级反绒新款外套洋气皮衣',
    productUrl:
      'https://haohuo.jinritemai.com/views/product/item2?id=3808142665975988651',
    publishedAt: '2026/08/22 21:58:44',
    durationSeconds: 130,
    playCount: '200万+',
    settlementAmount: '10万-50万',
    likeCount: '5000+',
    sourceUrl: 'https://www.douyin.com/video/7676855136555634771',
    videoUrl: '/trending/clothing-week-01.mp4',
  },
  {
    id: '7674905166621019433',
    platform: 'douyin',
    rank: 2,
    title:
      '蕉新内衣提拉塑形，裸感上身毫无束缚！#内衣分享#显瘦  #舒适内衣 #蕉新 #女生爱用物',
    creator: '杜丽丽(争气版)',
    creatorAvatarUrl: 'https://i.pravatar.cc/96?img=22',
    creatorLevel: 5,
    coverUrl: '/trending/clothing-week-02.jpg',
    productName: '【蕉新】焕新标内衣燕麦格雷山茶花超薄固定杯垫文胸防下垂文胸',
    productUrl:
      'https://haohuo.jinritemai.com/views/product/item2?id=3800172664841175179',
    publishedAt: '2026/08/17 15:51:56',
    durationSeconds: 123,
    playCount: '800万+',
    settlementAmount: '10万-50万',
    likeCount: '5万+',
    sourceUrl: 'https://www.douyin.com/video/7674905166621019433',
    videoUrl: '/trending/clothing-week-02.mp4',
  },
  {
    id: '7676155663289994534',
    platform: 'douyin',
    rank: 3,
    title: '不是吧 咱的内裤现在都这个段位了嘛 真的好好穿哦',
    creator: '斯慕运营一枝花',
    creatorAvatarUrl: 'https://i.pravatar.cc/96?img=23',
    creatorLevel: 4,
    coverUrl: '/trending/clothing-week-03.jpg',
    productName: '素放双C囊袋洞洞凉感内裤透气舒适无痕男士内裤男款四角平角短裤',
    productUrl:
      'https://haohuo.jinritemai.com/views/product/item2?id=3742819273677078844',
    publishedAt: '2026/08/21 00:44:28',
    durationSeconds: 35,
    playCount: '800万+',
    settlementAmount: '10万-50万',
    likeCount: '1万+',
    sourceUrl: 'https://www.douyin.com/video/7676155663289994534',
    videoUrl: '/trending/clothing-week-03.mp4',
  },
  {
    id: '7674674200175589553',
    platform: 'douyin',
    rank: 4,
    title: '#调整型内衣收副乳整型 #内衣好穿不贵 #调整型内衣收副乳 #无痕内衣 #平价内衣',
    creator: '爱笑的娜娜(清仓号)',
    creatorAvatarUrl: 'https://i.pravatar.cc/96?img=24',
    creatorLevel: 4,
    coverUrl: '/trending/clothing-week-04.jpg',
    productName: '黛伊婕【国风雅韵】前扣调整型吊带背心内衣无痕防下垂聚拢遮副乳',
    productUrl:
      'https://haohuo.jinritemai.com/views/product/item2?id=3821859105660862712',
    publishedAt: '2026/08/17 00:55:34',
    durationSeconds: 108,
    playCount: '1000万+',
    settlementAmount: '10万-50万',
    likeCount: '4万+',
    sourceUrl: 'https://www.douyin.com/video/7674674200175589553',
    videoUrl: '/trending/clothing-week-04.mp4',
  },
  {
    id: '7675308700861726193',
    platform: 'douyin',
    rank: 5,
    title:
      '#女孩内裤推荐 秋季开学女儿的内裤也该换新了，试试这款专为发育期女孩设计的成长内裤，原则吃饭了A可好凉感竹纤维面料，柔软细腻又亲肤，透气性好不闷热，贴身穿巨舒服，还都是女儿超喜欢的卡通图案，快给女儿安排一组吧#女童内裤#面料柔软舒适 #女孩内裤推荐 #七夕我主打一个有备而来',
    creator: '小灿麻麻',
    creatorAvatarUrl: 'https://i.pravatar.cc/96?img=25',
    creatorLevel: 3,
    coverUrl: '/trending/clothing-week-05.jpg',
    productName: '【独立包装】凉感竹纤维10A益生菌少女A类透气三角小平角内裤',
    productUrl:
      'https://haohuo.jinritemai.com/views/product/item2?id=3828774524929835503',
    publishedAt: '2026/08/18 17:57:46',
    durationSeconds: 39,
    playCount: '300万+',
    settlementAmount: '10万-50万',
    likeCount: '3000+',
    sourceUrl: 'https://www.douyin.com/video/7675308700861726193',
    videoUrl: '/trending/clothing-week-05.mp4',
  },
  createClothingSnapshotRecord({
    id: 'clothing-week-06', rank: 6,
    title: '#夏日精致穿搭 #一字肩上衣 #龙牙童服饰 #龙牙童 #女装测评',
    creator: '不能没有一点点🤏', coverUrl: '/trending/clothing-week-06.jpg',
    productName: '龙牙童推荐【韩系一字肩】夏季美式黑t恤显瘦修身百搭辣妹上衣基础',
    publishedAt: '2026/08/04 09:29:13', durationSeconds: 38,
    playCount: '600万+', settlementAmount: '10万-50万', likeCount: '2万+',
  }),
  createClothingSnapshotRecord({
    id: 'clothing-week-07', rank: 7,
    title: '#好穿又好搭 #李宁#运动裤#香蕉裤#卫裤',
    creator: '小崔那点事儿🔥', coverUrl: '/trending/clothing-week-07.jpg',
    productName: 'D李宁奶芙运动裤官方新款春季凉感速干直筒女款显瘦香蕉裤AKLV720',
    publishedAt: '2026/08/16 08:45:06', durationSeconds: 54,
    playCount: '100万+', settlementAmount: '10万-50万', likeCount: '2000+',
  }),
  createClothingSnapshotRecord({
    id: 'clothing-week-08', rank: 8,
    title: '慵懒休闲三件套 #韩系温柔风套装 #日常穿搭分享 #松弛慵懒风穿搭套装 #不挑身材的松弛感穿搭 #有效显瘦穿搭',
    creator: '小k学妹', coverUrl: '/trending/clothing-week-08.jpg',
    productName: 'Hey Here｜慵懒风开衫吊带长裤三件套休闲套装松弛遮肉显瘦',
    publishedAt: '2026/08/10 07:32:00', durationSeconds: 36,
    playCount: '100万+', settlementAmount: '10万-50万', likeCount: '6000+',
  }),
  createClothingSnapshotRecord({
    id: 'clothing-week-09', rank: 9,
    title: '飘逸感裙子套装 #女生高级感穿搭指南 #度假神裙 #温柔风穿搭参考 #穿搭分享 #简约高级感穿搭',
    creator: '小k学妹', coverUrl: '/trending/clothing-week-09.jpg',
    productName: '金蘑菇 法式辣妹花苞挂脖系带度假风露背上衣+半裙套装4287',
    publishedAt: '2026/08/03 07:30:00', durationSeconds: 35,
    playCount: '100万+', settlementAmount: '10万-50万', likeCount: '1万+',
  }),
  createClothingSnapshotRecord({
    id: 'clothing-week-10', rank: 10,
    title: '姐妹们！抓紧就这几天了！！ #反季#皮衣#羊皮皮衣#平价外套#秋季穿搭',
    creator: '小泽香菜', coverUrl: '/trending/clothing-week-10.jpg',
    productName: '【复古骑士】2026春秋装新款皮衣SSS级反绒新款外套洋气皮衣',
    publishedAt: '2026/08/13 19:21:19', durationSeconds: 123,
    playCount: '100万+', settlementAmount: '10万-50万', likeCount: '7000+',
  }),
  createClothingSnapshotRecord({
    id: 'clothing-week-11', rank: 11,
    title: '嘎嘎显瘦的无痕花瓣杯低领内衣！穿啥都纤瘦都隐形！#无痕内衣 #显瘦穿搭 #大显小内衣 #提拉聚拢 #cloudkathy',
    creator: '饺公主hahaha', coverUrl: '/trending/clothing-week-11.jpg',
    productName: '【凉感大胸显小】粉底液内衣夏季超薄纸片人无痕裸感提拉防下垂文胸',
    publishedAt: '2026/08/09 21:16:53', durationSeconds: 60,
    playCount: '600万+', settlementAmount: '10万-50万', likeCount: '1万+',
  }),
  createClothingSnapshotRecord({
    id: 'clothing-week-12', rank: 12,
    title: '#内衣推荐 #内衣好穿不贵 #内衣分享 #平价聚拢内衣 #便宜又好穿的美背',
    creator: '爱笑的娜娜(清仓号)', coverUrl: '/trending/clothing-week-12.jpg',
    productName: '黛伊婕【国风雅韵】前扣调整型吊带背心内衣无痕防下垂聚拢遮副乳',
    publishedAt: '2026/08/04 11:20:56', durationSeconds: 90,
    playCount: '900万+', settlementAmount: '10万-50万', likeCount: '2万+',
  }),
  createClothingSnapshotRecord({
    id: 'clothing-week-13', rank: 13,
    title: '复古慵懒氛围感三件套✨ 复古慵懒的氛围感三件套，轻松拿捏松弛感～ #大码显瘦搭配 #大码女孩学穿搭 #大码女孩显瘦穿搭分享',
    creator: '大菜小肥', coverUrl: '/trending/clothing-week-13.jpg',
    productName: '【大菜小肥定制】大码复古长袖开衫吊带内搭阔腿裤三件套',
    publishedAt: '2026/08/05 00:29:24', durationSeconds: 63,
    playCount: '100万+', settlementAmount: '10万-50万', likeCount: '7000+',
  }),
  createClothingSnapshotRecord({
    id: 'clothing-week-14', rank: 14,
    title: '为什么女性每天都要默默忍耐勒、闷、坠、难穿的痛苦？？ #润微随心调#内衣选购#大胸女生#挑选内衣#girlstalk',
    creator: '楠老板Nine', coverUrl: '/trending/clothing-week-14.jpg',
    productName: 'Realwill/润微提拉显小7.0随心调大胸显小双侧调节收副乳防下垂',
    publishedAt: '2026/08/13 17:00:29', durationSeconds: 207,
    playCount: '300万+', settlementAmount: '10万-50万', likeCount: '1万+',
  }),
  createClothingSnapshotRecord({
    id: 'clothing-week-15', rank: 15,
    title: '早秋复古氛围感套装，拿捏住了✨ #大码女孩真实穿搭分享 #大码显瘦穿搭 #微胖显瘦套装 #肉肉女生显瘦又遮肉的穿搭',
    creator: '大菜小肥', coverUrl: '/trending/clothing-week-15.jpg',
    productName: '【大菜小肥定制】大码复古长袖开衫吊带内搭阔腿裤三件套',
    publishedAt: '2026/08/07 00:57:53', durationSeconds: 134,
    playCount: '100万+', settlementAmount: '10万-50万', likeCount: '4000+',
  }),
  createClothingSnapshotRecord({
    id: 'clothing-week-16', rank: 16,
    title: '又到了穿皮衣的季节了 #入秋穿搭#皮衣搭配#一衣多穿#皮衣穿搭#通勤搭配',
    creator: '一一好胖丫（反季刀一刀）', coverUrl: '/trending/clothing-week-16.jpg',
    productName: 'LoveTaste【旷野的风】气质双排扣中长款皮衣女宽松廓形高级感外套',
    publishedAt: '2026/08/05 10:19:51', durationSeconds: 81,
    playCount: '100万+', settlementAmount: '10万-50万', likeCount: '2000+',
  }),
  createClothingSnapshotRecord({
    id: 'clothing-week-17', rank: 17,
    title: '十几块钱的内衣居然兼顾塑形和养胸，也太划算了！#蕉新 #内衣 #显瘦 #塑形',
    creator: '甜久久（冲刺版）', coverUrl: '/trending/clothing-week-17.jpg',
    productName: '【蕉新】焕新标内衣燕麦格雷山茶花超薄固定杯垫文胸防下垂无痕文胸',
    publishedAt: '2026/08/06 17:58:44', durationSeconds: 103,
    playCount: '800万+', settlementAmount: '10万-50万', likeCount: '3万+',
  }),
  createClothingSnapshotRecord({
    id: 'clothing-week-18', rank: 18,
    title: '马上立秋了，该给他准备舒适的纯棉内裤了！面料软糯亲肤，舒适又透气 #男士内裤 #男士纯棉内裤',
    creator: '盐心baby💕', coverUrl: '/trending/clothing-week-18.jpg',
    productName: 'CentreKeyed男士内裤薄款新款纯棉平角裤透气青少年四角裤短裤',
    publishedAt: '2026/08/05 17:28:34', durationSeconds: 40,
    playCount: '8万+', settlementAmount: '10万-50万', likeCount: '50+',
  }),
  createClothingSnapshotRecord({
    id: 'clothing-week-19', rank: 19,
    title: '前后门襟拼接不规则披肩设计，遮肉藏肉，肉肉女生也能穿出显瘦效果 #大码穿搭 #通勤穿搭',
    creator: '瞎穿的小静', coverUrl: '/trending/clothing-week-19.jpg',
    productName: '大码胖mm法式设计感波点衬衫女夏季不规则下摆显瘦休闲氛围感上衣',
    publishedAt: '2026/08/12 23:30:00', durationSeconds: 41,
    playCount: '100万+', settlementAmount: '10万-50万', likeCount: '8000+',
  }),
  createClothingSnapshotRecord({
    id: 'clothing-week-20', rank: 20,
    title: '秋季上学！女儿的贴身内裤该备新啦！A类纯棉面料柔软舒适 #女童内裤 #女孩内裤推荐 #女生必备',
    creator: '晶艺心选', coverUrl: '/trending/clothing-week-20.jpg',
    productName: '碎花设计款少女内裤礼盒装10A抑菌加长裆全棉亲肤包臀平角短裤',
    publishedAt: '2026/08/05 17:08:37', durationSeconds: 38,
    playCount: '200万+', settlementAmount: '10万-50万', likeCount: '1000+',
  }),
]

export const clothingShortRankingRecords: HotRankingRecord[] = [
  ['这条波点裤太适合早秋了！好韩🧺A字版型贼显瘦！#波点裤 #牛仔裤', '徐徐穿搭studio', '美式复古深蓝色波点牛仔裤女2026早秋新款松弛设计感高腰阔腿裤子', '2026/08/12 21:25:12', 8, '100万+', '10万-50万', '3000+'],
  ['安德玛的面料是真的绝！柔软又轻薄，还是速干款～现在有国补！#安德玛 #运动穿搭', '曾珠奶茶', '安德玛儿童户外训练透气亲肤长袖速干T恤1133', '2026/08/11 14:36:16', 15, '100万+', '10万-50万', '7000+'],
  ['做不被定义的自己，马卡龙色系三合一冲锋衣 #大小卷童装 #女童冲锋衣', '大小卷儿～', '【大小卷】新品韩版童装休闲三合一连帽亲子冲锋衣亲子外套-52428', '2026/08/04 19:13:33', 10, '50万+', '2万-10万', '1000+'],
  ['早秋过渡老钱风裤子！超爱这个编织腰头🧺天丝亚麻太好穿了！#老钱风穿搭 #阔腿裤', '徐徐穿搭studio', '【亚麻轻纱】老钱风天丝亚麻质感编织纹理牛仔裤女秋季款垂感阔腿裤', '2026/08/24 20:42:48', 8, '100万+', '2万-10万', '2000+'],
  ['原相机拆早秋波点阔腿裤大货细节 #初秋新款 #波点控 #穿搭没有公式', '叮叮猫', '美式复古深蓝色波点牛仔裤女2026早秋新款松弛设计感高腰阔腿裤子', '2026/08/13 19:26:52', 11, '10万+', '5千-2万', '400+'],
  ['#优雅气质 #日常穿搭分享', '大蜜豆mikibaby', '“蓝色木耳卷边系”MIYUFUTURE设计师时尚两件套（裤长107）', '2026/08/03 10:18:01', 12, '9万+', '5千-2万', '200+'],
  ['黑开衫搭配卡其裙裤一套很禅意 #穿搭 #无限回购的宝藏单品', '郭九九呢大卖卖卖', '郭九九呢 显瘦气质百搭针织开衫垂感松紧腰阔腿裤裙G9C346668', '2026/08/06 22:00:00', 12, '6万+', '5千-2万', '100+'],
].map(([title, creator, productName, publishedAt, durationSeconds, playCount, settlementAmount, likeCount], index) =>
  createClothingSnapshotRecord({
    id: `clothing-short-${String(index + 1).padStart(2, '0')}`,
    rank: index + 1,
    title: String(title),
    creator: String(creator),
    coverUrl: `/trending/clothing-short-${String(index + 1).padStart(2, '0')}.jpg`,
    productName: String(productName),
    publishedAt: String(publishedAt),
    durationSeconds: Number(durationSeconds),
    playCount: String(playCount),
    settlementAmount: String(settlementAmount),
    likeCount: String(likeCount),
  }),
)

const hotRankingSeedRecords: Omit<
  HotRankingRecord,
  'creatorAvatarUrl' | 'creatorLevel'
>[] = [
  {
    id: 'trend-dy-01',
    platform: 'douyin',
    rank: 1,
    title: '一擦就亮，厨房油污终于有救了',
    creator: '好物研究所',
    coverUrl:
      'https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=720&q=86',
    productName: '厨房重油污清洁泡沫',
    productUrl: 'https://www.douyin.com/search/厨房重油污清洁泡沫?type=general',
    price: 29.9,
    publishedAt: '2026/09/02 14:48:16',
    durationSeconds: 36,
    playCount: '1200万+',
    settlementAmount: '100万-250万',
    likeCount: '6.8万+',
    sourceUrl: 'https://www.douyin.com/',
  },
  {
    id: 'trend-dy-02',
    platform: 'douyin',
    rank: 2,
    title: '通勤一周不重样，这条裤子太显腿长',
    creator: '小鹿穿搭日记',
    coverUrl:
      'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=520&q=86',
    productName: '高腰垂感阔腿裤',
    productUrl: 'https://www.douyin.com/search/高腰垂感阔腿裤?type=general',
    price: 79,
    publishedAt: '2026/08/14 15:40:20',
    durationSeconds: 101,
    playCount: '1000万+',
    settlementAmount: '50万-100万',
    likeCount: '3万+',
    sourceUrl: 'https://www.douyin.com/',
  },
  {
    id: 'trend-dy-03',
    platform: 'douyin',
    rank: 3,
    title: '早餐只要三分钟，外脆里嫩不翻车',
    creator: '阿哲厨房',
    coverUrl:
      'https://images.unsplash.com/photo-1551218808-94e220e084d2?auto=format&fit=crop&w=520&q=86',
    productName: '多功能早餐机',
    productUrl: 'https://www.douyin.com/search/多功能早餐机?type=general',
    price: 129,
    publishedAt: '2026/09/02 11:08:05',
    durationSeconds: 58,
    playCount: '750万+',
    settlementAmount: '25万-50万',
    likeCount: '2.4万+',
    sourceUrl: 'https://www.douyin.com/',
  },
  {
    id: 'trend-dy-04',
    platform: 'douyin',
    rank: 4,
    title: '小户型也能拥有的松弛感客厅',
    creator: '住进理想家',
    coverUrl:
      'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=520&q=86',
    productName: '云朵豆腐块沙发',
    productUrl: 'https://www.douyin.com/search/云朵豆腐块沙发?type=general',
    price: 899,
    publishedAt: '2026/09/02 09:34:27',
    durationSeconds: 64,
    playCount: '500万+',
    settlementAmount: '10万-25万',
    likeCount: '1.8万+',
    sourceUrl: 'https://www.douyin.com/',
  },
  {
    id: 'trend-dy-05',
    platform: 'douyin',
    rank: 5,
    title: '头发毛躁的，洗完一定要试试这一步',
    creator: '成分派小安',
    coverUrl:
      'https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?auto=format&fit=crop&w=520&q=86',
    productName: '修护精油发膜套装',
    productUrl: 'https://www.douyin.com/search/修护精油发膜套装?type=general',
    price: 59.9,
    publishedAt: '2026/09/02 08:17:53',
    durationSeconds: 31,
    playCount: '300万+',
    settlementAmount: '10万-25万',
    likeCount: '1.2万+',
    sourceUrl: 'https://www.douyin.com/',
  },
  {
    id: 'trend-ds-01',
    platform: 'dou_store',
    rank: 6,
    title: '直播间都在问的轻量保温杯实测',
    creator: '生活家居旗舰店',
    coverUrl:
      'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=720&q=86',
    productName: '316L 轻量保温杯',
    productUrl: 'https://www.douyin.com/search/316L轻量保温杯?type=general',
    price: 49.9,
    publishedAt: '2026/09/02 15:12:08',
    durationSeconds: 45,
    playCount: '1600万+',
    settlementAmount: '100万-250万',
    likeCount: '8.2万+',
    sourceUrl: 'https://fxg.jinritemai.com/',
  },
  {
    id: 'trend-ds-02',
    platform: 'dou_store',
    rank: 7,
    title: '一片顶一顿，办公室囤货清单',
    creator: '轻食补给站',
    coverUrl:
      'https://images.unsplash.com/photo-1586444248902-2f64eddc13df?auto=format&fit=crop&w=520&q=86',
    productName: '高纤全麦面包组合',
    productUrl: 'https://www.douyin.com/search/高纤全麦面包组合?type=general',
    price: 36.8,
    publishedAt: '2026/09/02 13:52:34',
    durationSeconds: 39,
    playCount: '900万+',
    settlementAmount: '50万-100万',
    likeCount: '4.6万+',
    sourceUrl: 'https://fxg.jinritemai.com/',
  },
  {
    id: 'trend-ds-03',
    platform: 'dou_store',
    rank: 8,
    title: '没有噪音的桌面风扇到底有多舒服',
    creator: '数码优选仓',
    coverUrl:
      'https://images.unsplash.com/photo-1585157603827-3010f95e6093?auto=format&fit=crop&w=520&q=86',
    productName: '静音循环桌面风扇',
    productUrl: 'https://www.douyin.com/search/静音循环桌面风扇?type=general',
    price: 69,
    publishedAt: '2026/09/02 12:06:19',
    durationSeconds: 52,
    playCount: '650万+',
    settlementAmount: '25万-50万',
    likeCount: '2.9万+',
    sourceUrl: 'https://fxg.jinritemai.com/',
  },
  {
    id: 'trend-ds-04',
    platform: 'dou_store',
    rank: 9,
    title: '拖地不用弯腰，边角也能一次带走',
    creator: '洁净生活馆',
    coverUrl:
      'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=520&q=86',
    productName: '免手洗平板拖把',
    productUrl: 'https://www.douyin.com/search/免手洗平板拖把?type=general',
    price: 45.9,
    publishedAt: '2026/09/02 10:28:41',
    durationSeconds: 47,
    playCount: '420万+',
    settlementAmount: '10万-25万',
    likeCount: '1.7万+',
    sourceUrl: 'https://fxg.jinritemai.com/',
  },
  {
    id: 'trend-ds-05',
    platform: 'dou_store',
    rank: 10,
    title: '小个子也能穿出的利落风衣感',
    creator: '白昼女装店',
    coverUrl:
      'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=520&q=86',
    productName: '短款收腰风衣外套',
    productUrl: 'https://www.douyin.com/search/短款收腰风衣外套?type=general',
    price: 159,
    publishedAt: '2026/09/02 08:43:12',
    durationSeconds: 34,
    playCount: '260万+',
    settlementAmount: '10万-25万',
    likeCount: '9800+',
    sourceUrl: 'https://fxg.jinritemai.com/',
  },
  {
    id: 'trend-dy-11',
    platform: 'douyin',
    rank: 11,
    title: '衣柜空间翻倍，换季收纳终于不乱了',
    creator: '收纳实验室',
    coverUrl:
      'https://images.unsplash.com/photo-1558997519-83ea9252edf8?auto=format&fit=crop&w=520&q=86',
    productName: '透明可视折叠收纳箱',
    productUrl: 'https://www.douyin.com/search/透明可视折叠收纳箱?type=general',
    price: 39.9,
    publishedAt: '2026/09/01 22:16:08',
    durationSeconds: 42,
    playCount: '230万+',
    settlementAmount: '5万-10万',
    likeCount: '9200+',
    sourceUrl: 'https://www.douyin.com/',
  },
  {
    id: 'trend-dy-12',
    platform: 'douyin',
    rank: 12,
    title: '暴晒半小时，轻薄防晒衣实测不闷汗',
    creator: '户外装备局',
    coverUrl:
      'https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=520&q=86',
    productName: '冰感轻薄防晒衣',
    productUrl: 'https://www.douyin.com/search/冰感轻薄防晒衣?type=general',
    price: 89,
    publishedAt: '2026/09/01 20:35:44',
    durationSeconds: 55,
    playCount: '210万+',
    settlementAmount: '5万-10万',
    likeCount: '8700+',
    sourceUrl: 'https://www.douyin.com/',
  },
  {
    id: 'trend-dy-13',
    platform: 'douyin',
    rank: 13,
    title: '百元耳机通勤降噪，地铁里听歌够不够用',
    creator: '数码开箱社',
    coverUrl:
      'https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?auto=format&fit=crop&w=520&q=86',
    productName: '主动降噪蓝牙耳机',
    productUrl: 'https://www.douyin.com/search/主动降噪蓝牙耳机?type=general',
    price: 129,
    publishedAt: '2026/09/01 18:42:31',
    durationSeconds: 73,
    playCount: '190万+',
    settlementAmount: '5万-10万',
    likeCount: '8100+',
    sourceUrl: 'https://www.douyin.com/',
  },
  {
    id: 'trend-dy-14',
    platform: 'douyin',
    rank: 14,
    title: '养猫家庭实测，落砂和异味一次解决',
    creator: '猫咪生活指南',
    coverUrl:
      'https://images.unsplash.com/photo-1573865526739-10659fec78a5?auto=format&fit=crop&w=520&q=86',
    productName: '低尘除臭混合猫砂',
    productUrl: 'https://www.douyin.com/search/低尘除臭混合猫砂?type=general',
    price: 46.8,
    publishedAt: '2026/09/01 17:26:19',
    durationSeconds: 48,
    playCount: '175万+',
    settlementAmount: '5万-10万',
    likeCount: '7600+',
    sourceUrl: 'https://www.douyin.com/',
  },
  {
    id: 'trend-dy-15',
    platform: 'douyin',
    rank: 15,
    title: '追剧嘴馋也不怕，这袋解馋小零食太上头',
    creator: '办公室吃货',
    coverUrl:
      'https://images.unsplash.com/photo-1599490659213-e2b9527bd087?auto=format&fit=crop&w=520&q=86',
    productName: '低脂香脆零食组合',
    productUrl: 'https://www.douyin.com/search/低脂香脆零食组合?type=general',
    price: 29.8,
    publishedAt: '2026/09/01 15:53:02',
    durationSeconds: 29,
    playCount: '160万+',
    settlementAmount: '2.5万-5万',
    likeCount: '6900+',
    sourceUrl: 'https://www.douyin.com/',
  },
  {
    id: 'trend-dy-16',
    platform: 'douyin',
    rank: 16,
    title: '走一万步脚底不酸，通勤鞋真实体验',
    creator: '鞋柜测评员',
    coverUrl:
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=520&q=86',
    productName: '轻量缓震运动鞋',
    productUrl: 'https://www.douyin.com/search/轻量缓震运动鞋?type=general',
    price: 139,
    publishedAt: '2026/09/01 14:18:47',
    durationSeconds: 61,
    playCount: '145万+',
    settlementAmount: '2.5万-5万',
    likeCount: '6100+',
    sourceUrl: 'https://www.douyin.com/',
  },
  {
    id: 'trend-dy-17',
    platform: 'douyin',
    rank: 17,
    title: '桌面多一束花，普通出租屋也有氛围感',
    creator: '一周花房',
    coverUrl:
      'https://images.unsplash.com/photo-1523438885200-e635ba2c371e?auto=format&fit=crop&w=520&q=86',
    productName: '当季鲜花混合花束',
    productUrl: 'https://www.douyin.com/search/当季鲜花混合花束?type=general',
    price: 39.9,
    publishedAt: '2026/09/01 12:36:15',
    durationSeconds: 33,
    playCount: '130万+',
    settlementAmount: '2.5万-5万',
    likeCount: '5700+',
    sourceUrl: 'https://www.douyin.com/',
  },
  {
    id: 'trend-dy-18',
    platform: 'douyin',
    rank: 18,
    title: '出门一包装下全部，宝妈短途出行清单',
    creator: '新手妈妈研究所',
    coverUrl:
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=520&q=86',
    productName: '大容量母婴出行包',
    productUrl: 'https://www.douyin.com/search/大容量母婴出行包?type=general',
    price: 119,
    publishedAt: '2026/09/01 10:24:39',
    durationSeconds: 67,
    playCount: '118万+',
    settlementAmount: '1万-2.5万',
    likeCount: '4900+',
    sourceUrl: 'https://www.douyin.com/',
  },
  {
    id: 'trend-dy-19',
    platform: 'douyin',
    rank: 19,
    title: '日常叠戴不夸张，这条细链显得脖子很修长',
    creator: '首饰搭配课',
    coverUrl:
      'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=520&q=86',
    productName: '简约锁骨项链',
    productUrl: 'https://www.douyin.com/search/简约锁骨项链?type=general',
    price: 99,
    publishedAt: '2026/09/01 09:05:26',
    durationSeconds: 38,
    playCount: '105万+',
    settlementAmount: '1万-2.5万',
    likeCount: '4200+',
    sourceUrl: 'https://www.douyin.com/',
  },
  {
    id: 'trend-dy-20',
    platform: 'douyin',
    rank: 20,
    title: '十分钟讲透一本书，碎片时间也能读完',
    creator: '纸上放映室',
    coverUrl:
      'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=520&q=86',
    productName: '年度成长书单套装',
    productUrl: 'https://www.douyin.com/search/年度成长书单套装?type=general',
    price: 88,
    publishedAt: '2026/09/01 08:12:54',
    durationSeconds: 96,
    playCount: '98万+',
    settlementAmount: '1万-2.5万',
    likeCount: '3800+',
    sourceUrl: 'https://www.douyin.com/',
  },
]

export const hotRankingRecords: HotRankingRecord[] = hotRankingSeedRecords.map(
  (record) => ({
    ...record,
    creatorAvatarUrl: `https://i.pravatar.cc/96?img=${record.rank + 10}`,
    creatorLevel: Math.max(1, 6 - Math.floor((record.rank - 1) / 4)),
  }),
)

function readDeletedIds(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.deletedIds)
    if (!raw) return []
    const value: unknown = JSON.parse(raw)
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : []
  } catch {
    return []
  }
}

export function getVideoRecords(): VideoHistoryRecord[] {
  const deletedIds = new Set(readDeletedIds())
  return videoRecords.filter((record) => !deletedIds.has(record.id))
}

export function deleteVideoRecord(recordId: string): void {
  const ids = new Set(readDeletedIds())
  ids.add(recordId)
  window.localStorage.setItem(STORAGE_KEYS.deletedIds, JSON.stringify([...ids]))
}

export function resetDemoRecords(): VideoHistoryRecord[] {
  window.localStorage.removeItem(STORAGE_KEYS.deletedIds)
  return [...videoRecords]
}
