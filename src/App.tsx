import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  CircleUserRound,
  Clock3,
  Coins,
  Copy,
  Download,
  Eye,
  ExternalLink,
  FileVideo,
  Film,
  Flame,
  Heart,
  History,
  PanelsTopLeft,
  Play,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  ShoppingBag,
  Trash2,
  UserRound,
  WalletCards,
  Warehouse,
  X,
} from 'lucide-react'
import {
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import {
  dataMode,
  dataProvider,
} from './data/providerInstance'
import type { TrendingDurationCode } from './data/dataProvider'
import { getErrorMessage } from './data/dataProvider'
import {
  saveRemakeSelection,
} from './data/remakeSession'
import {
  trendingDurationFilters,
  trendingIndustries,
  type TrendingDuration,
} from './data/trendingCatalog'
import { useAsyncResource } from './hooks/useAsyncResource'
import { useCursorList } from './hooks/useCursorList'
import { WorkspacePage } from './workspace/WorkspacePage'
import type {
  AccountProfile,
  GenerationStatus,
  HotRankingRecord,
  HistoryReplacementMapping,
  MediaReference,
  QuotaUsageRecord,
  VideoHistoryRecord,
} from './types'

const navItems = [
  { to: '/workspace', label: '工作台', Icon: PanelsTopLeft },
  { to: '/trending', label: '一周热榜', Icon: Flame },
  { to: '/history', label: '历史记录', Icon: History },
  { to: '/me', label: '我的', Icon: UserRound },
] as const

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(new Date(value))
    .replace('/', '.')
}

function formatHistoryDateTime(value: string): string {
  const date = new Date(value)
  const parts = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const readPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''
  return `${readPart('year')}.${readPart('month')}.${readPart('day')} ${readPart('hour')}:${readPart('minute')}`
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

function AppShell() {
  const location = useLocation()
  const contentRef = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    const content = contentRef.current
    if (!content) return

    content.scrollTop = 0
  }, [location.pathname])

  return (
    <div className="app-shell">
      <main
        className="app-content"
        ref={contentRef}
      >
        <Routes>
          <Route path="/workspace" element={<WorkspacePage />} />
          <Route path="/trending" element={<TrendingPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/me" element={<ProfilePage />} />
          <Route path="*" element={<Navigate to="/workspace" replace />} />
        </Routes>
      </main>
      <nav className="bottom-nav" aria-label="主导航">
        <div className="bottom-nav__inner">
          {navItems.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `bottom-nav__item${isActive ? ' is-active' : ''}`
              }
            >
              <span className="bottom-nav__icon">
                <Icon size={22} strokeWidth={1.9} aria-hidden="true" />
              </span>
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}

function formatMetricDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return minutes > 0 ? `${minutes}分${remainingSeconds}秒` : `${remainingSeconds}秒`
}

function formatRankingDate(value: string): string {
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return value
  const date = new Date(timestamp)
  const parts = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const readPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''
  return `${readPart('year')}/${readPart('month')}/${readPart('day')} ${readPart('hour')}:${readPart('minute')}:${readPart('second')}`
}

const durationCodeByFilter: Record<TrendingDuration, TrendingDurationCode> = {
  '不限': 'all',
  '15秒内': 'lte_15',
  '1分钟内': 'lte_60',
  '>1分钟': 'gt_60',
}

function useHorizontalDrag<T extends HTMLElement>() {
  const drag = useRef({
    active: false,
    startX: 0,
    startScrollLeft: 0,
    moved: false,
    suppressClickUntil: 0,
  })

  const onPointerDown = (event: React.PointerEvent<T>) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return
    drag.current = {
      active: true,
      startX: event.clientX,
      startScrollLeft: event.currentTarget.scrollLeft,
      moved: false,
      suppressClickUntil: 0,
    }
  }

  const onPointerMove = (event: React.PointerEvent<T>) => {
    if (!drag.current.active) return
    const distance = event.clientX - drag.current.startX
    if (Math.abs(distance) <= 4) return
    if (!drag.current.moved) {
      drag.current.moved = true
      event.currentTarget.setPointerCapture(event.pointerId)
      event.currentTarget.classList.add('is-dragging')
    }
    event.currentTarget.scrollLeft = drag.current.startScrollLeft - distance
    event.preventDefault()
  }

  const finishDrag = (event: React.PointerEvent<T>) => {
    if (!drag.current.active) return
    drag.current.active = false
    drag.current.suppressClickUntil = drag.current.moved ? performance.now() + 300 : 0
    if (drag.current.moved) {
      window.setTimeout(() => {
        if (drag.current.active) return
        drag.current.moved = false
        drag.current.suppressClickUntil = 0
      }, 0)
    }
    event.currentTarget.classList.remove('is-dragging')
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const onClickCapture = (event: React.MouseEvent<T>) => {
    if (performance.now() > drag.current.suppressClickUntil) {
      drag.current.moved = false
      drag.current.suppressClickUntil = 0
      return
    }
    event.preventDefault()
    event.stopPropagation()
    drag.current.moved = false
    drag.current.suppressClickUntil = 0
  }

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: finishDrag,
    onPointerCancel: finishDrag,
    onClickCapture,
  }
}

function TrendingPage() {
  const navigate = useNavigate()
  const industryDrag = useHorizontalDrag<HTMLDivElement>()
  const [playing, setPlaying] = useState<HotRankingRecord | null>(null)
  const [industryId, setIndustryId] = useState<string>(trendingIndustries[0].id)
  const [subcategoryId, setSubcategoryId] = useState<string>(trendingIndustries[0].children[0].id)
  const [duration, setDuration] = useState<TrendingDuration>(trendingDurationFilters[0])
  const loadCategories = useCallback(
    (signal: AbortSignal) => dataProvider.getTrendingCategories(signal),
    [],
  )
  const categoryResource = useAsyncResource(loadCategories)
  const industries = categoryResource.data?.items ?? trendingIndustries
  const selectedIndustry = industries.find((item) => item.id === industryId) ?? industries[0] ?? trendingIndustries[0]
  const selectedSubcategory =
    selectedIndustry.children.find((item) => item.id === subcategoryId) ?? selectedIndustry.children[0]
  const loadTrendingPage = useCallback(
    (cursor: string | null, signal: AbortSignal) =>
      dataProvider.getTrendingVideos(
        {
          industryId: selectedIndustry.id,
          subcategoryId: selectedSubcategory.id,
          duration: durationCodeByFilter[duration],
          cursor,
          limit: 20,
        },
        signal,
      ),
    [duration, selectedIndustry.id, selectedSubcategory.id],
  )
  const ranking = useCursorList(loadTrendingPage)

  const handleIndustrySelect = (id: string, event: React.MouseEvent<HTMLButtonElement>) => {
    const nextIndustry = industries.find((item) => item.id === id) ?? industries[0] ?? trendingIndustries[0]
    setIndustryId(id)
    setSubcategoryId(nextIndustry.children[0].id)
    event.currentTarget.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    })
  }

  const handleRemake = (record: HotRankingRecord) => {
    saveRemakeSelection({
      sourceType: 'trending',
      businessId: record.id,
      title: record.title,
      sourceUrl: record.sourceUrl,
    })
    navigate('/workspace')
  }

  return (
    <section className="page trending-page">
      <section className="trend-filters reveal" aria-label="热榜筛选">
        <div className="trend-filters__title">
          <div>
            <SlidersHorizontal size={14} aria-hidden="true" />
            <strong>行业类目</strong>
          </div>
          <span>左右滑动查看更多</span>
        </div>

        {categoryResource.data?.usedFallback && (
          <div className="data-notice" role="status">
            类目接口暂不可用，当前使用本地类目配置
          </div>
        )}

        <div
          className="industry-rail"
          role="tablist"
          aria-label="行业类目"
          {...industryDrag}
        >
          {industries.map((item, index) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={industryId === item.id}
              aria-expanded={industryId === item.id}
              className={industryId === item.id ? 'is-active' : ''}
              onClick={(event) => handleIndustrySelect(item.id, event)}
            >
              <small>{String(index + 1).padStart(2, '0')}</small>
              <strong>{item.name}</strong>
              <ChevronDown size={12} aria-hidden="true" />
            </button>
          ))}
        </div>

        <div className="subcategory-panel" aria-label={`${selectedIndustry.name}子类`}>
          <div className="subcategory-panel__meta">
            <span>SUBCATEGORY</span>
            <strong>{selectedIndustry.name}</strong>
          </div>
          <div className="subcategory-panel__options">
            {selectedIndustry.children.map((item) => (
              <button
                key={item.id}
                type="button"
                className={selectedSubcategory.id === item.id ? 'is-active' : ''}
                aria-pressed={selectedSubcategory.id === item.id}
                onClick={() => setSubcategoryId(item.id)}
              >
                {item.name}
              </button>
            ))}
          </div>
        </div>

        <FilterRail
          label="视频时长"
          note="按新增结算金额排序"
          options={trendingDurationFilters}
          value={duration}
          onChange={setDuration}
        />
      </section>

      {ranking.status === 'loading' && <ListSkeleton variant="trend" count={4} />}
      {ranking.status === 'error' && (
        <DataState
          title="热榜加载失败"
          message={ranking.error ?? '请稍后重试'}
          onRetry={ranking.reload}
        />
      )}
      {ranking.status === 'empty' && (
        <DataState title="暂无热榜视频" message="当前筛选条件下还没有可展示的视频。" />
      )}
      {ranking.status === 'success' && (
        <>
          <div className="trend-list">
            {ranking.items.map((record, index) => (
              <TrendListItem
                key={record.id}
                record={record}
                delay={85 + Math.min(index, 8) * 65}
                onPlay={setPlaying}
                onRemake={handleRemake}
              />
            ))}
          </div>
          <PaginationControl
            hasMore={Boolean(ranking.nextCursor)}
            loading={ranking.loadingMore}
            error={ranking.loadMoreError}
            onLoadMore={ranking.loadMore}
          />
        </>
      )}

      {playing && (
        <VideoPlayer
          title={playing.title}
          videoUrl={playing.videoUrl}
          coverUrl={playing.coverUrl}
          onClose={() => setPlaying(null)}
        />
      )}
    </section>
  )
}

function FilterRail<T extends string>({
  label,
  note,
  options,
  value,
  onChange,
}: {
  label: string
  note?: string
  options: readonly T[]
  value: T
  onChange: (value: T) => void
}) {
  const filterDrag = useHorizontalDrag<HTMLDivElement>()

  return (
    <div className="filter-rail">
      <span className="filter-rail__label">{label}</span>
      <div role="group" aria-label={label} {...filterDrag}>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className={value === option ? 'is-active' : ''}
            aria-pressed={value === option}
            onClick={() => onChange(option)}
          >
            {option}
          </button>
        ))}
      </div>
      {note && <span className="filter-rail__note">{note}</span>}
    </div>
  )
}

function DataState({
  title,
  message,
  onRetry,
}: {
  title: string
  message: string
  onRetry?: () => void
}) {
  return (
    <div className="data-state reveal" role={onRetry ? 'alert' : 'status'}>
      <span className="data-state__index">DATA / STATE</span>
      <strong>{title}</strong>
      <p>{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry}>
          <RotateCcw size={14} />重新加载
        </button>
      )}
    </div>
  )
}

function ListSkeleton({ variant, count }: { variant: 'trend' | 'history' | 'usage'; count: number }) {
  return (
    <div className={`data-skeleton data-skeleton--${variant}`} data-state="loading" aria-label="正在加载">
      {Array.from({ length: count }, (_, index) => (
        <div className="data-skeleton__row" key={index}>
          <i />
          <div><span /><span /><span /></div>
        </div>
      ))}
    </div>
  )
}

function PaginationControl({
  hasMore,
  loading,
  error,
  onLoadMore,
}: {
  hasMore: boolean
  loading: boolean
  error: string | null
  onLoadMore: () => void
}) {
  if (!hasMore && !error) return <div className="pagination-end">— 已加载全部 —</div>
  return (
    <div className="pagination-control">
      {error && <p role="alert">{error}</p>}
      <button type="button" disabled={loading} onClick={onLoadMore}>
        {loading ? '加载中…' : error ? '重试加载更多' : '加载更多'}
        {!loading && <ChevronDown size={14} aria-hidden="true" />}
      </button>
    </div>
  )
}

function TrendListItem({
  record,
  delay,
  onPlay,
  onRemake,
}: {
  record: HotRankingRecord
  delay: number
  onPlay: (record: HotRankingRecord) => void
  onRemake: (record: HotRankingRecord) => void
}) {
  return (
    <article className="trend-row reveal" style={{ animationDelay: `${delay}ms` }}>
      <div className={`trend-row__rank${record.rank <= 3 ? ' is-top' : ''}`}>
        <span>{String(record.rank).padStart(2, '0')}</span>
        <i aria-hidden="true" />
      </div>
      <div className="trend-row__thumb">
        <img src={record.coverUrl} alt="" />
        <button
          type="button"
          className="trend-row__play"
          onClick={() => record.videoUrl && onPlay(record)}
          aria-label={record.videoUrl ? `播放${record.title}` : `${record.title}暂无视频`}
          disabled={!record.videoUrl}
        >
          <Play size={18} fill="currentColor" aria-hidden="true" />
        </button>
        {!record.videoUrl && <span className="trend-row__unavailable">暂无视频</span>}
        <span className="trend-row__plays" aria-label={`总播放量 ${record.playCount}`}>
          <Play size={10} fill="currentColor" aria-hidden="true" />
          <strong>{record.playCount}</strong>
        </span>
        <span className="trend-row__duration">{formatMetricDuration(record.durationSeconds)}</span>
      </div>
      <div className="trend-row__body">
        <div className="trend-row__creator">
          <img
            src={record.creatorAvatarUrl}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
          />
          <strong>{record.creator}</strong>
          <span>LV{record.creatorLevel}</span>
        </div>
        <h2>{record.title}</h2>
        <a
          className="trend-row__product"
          href={record.productUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`打开商品：${record.productName}`}
        >
          <ShoppingBag size={12} />
          <span>{record.productName}</span>
          <ExternalLink size={10} aria-hidden="true" />
        </a>
        <div className="trend-row__published">
          <strong>{formatRankingDate(record.publishedAt)}</strong>
        </div>
        <div className="trend-row__footer">
          <div className="trend-row__metrics">
            <span className="metric-settlement">
              <Coins size={13} aria-hidden="true" />
              <small className="visually-hidden">已选类目结算金额</small>
              <strong>{record.settlementAmount}</strong>
            </span>
            <span>
              <Heart size={13} aria-hidden="true" />
              <small className="visually-hidden">总点赞量</small>
              <strong>{record.likeCount}</strong>
            </span>
          </div>
          <button
            type="button"
            className="trend-row__remake"
            onClick={() => onRemake(record)}
            aria-label={`用${record.title}做同款`}
          >
            <RefreshCw size={11} />做同款
          </button>
        </div>
      </div>
    </article>
  )
}

const taskStatusMeta: Record<GenerationStatus, { label: string; className: string }> = {
  queued: { label: '排队中', className: 'queued' },
  processing: { label: '处理中', className: 'processing' },
  completed: { label: '已完成', className: 'completed' },
  failed: { label: '生成失败', className: 'failed' },
}

function HistoryPage() {
  const navigate = useNavigate()
  const [playing, setPlaying] = useState<VideoHistoryRecord | null>(null)
  const [inspecting, setInspecting] = useState<VideoHistoryRecord | null>(null)
  const [deleting, setDeleting] = useState<VideoHistoryRecord | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const loadHistoryPage = useCallback(
    (cursor: string | null, signal: AbortSignal) => dataProvider.getVideoTasks(cursor, 20, signal),
    [],
  )
  const history = useCursorList(loadHistoryPage)

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 2600)
    return () => window.clearTimeout(timer)
  }, [toast])

  const handleDownload = async (record: VideoHistoryRecord) => {
    if (!record.playbackAvailable || downloadingId) return
    setDownloadingId(record.id)
    try {
      const ticket = await dataProvider.getDownloadTicket(record.id)
      const anchor = document.createElement('a')
      anchor.href = ticket.url
      anchor.download = ticket.filename
      anchor.target = '_blank'
      anchor.rel = 'noopener noreferrer'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      const isWeChat = /MicroMessenger/i.test(navigator.userAgent)
      setToast(isWeChat ? '如未下载，请在浏览器打开或长按保存' : '已获取下载地址')
    } catch (error) {
      setToast(getErrorMessage(error))
    } finally {
      setDownloadingId(null)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleting || deletingId) return
    const target = deleting
    setDeletingId(target.id)
    try {
      await dataProvider.deleteVideoTask(target.id)
      history.removeItem(target.id)
      setDeleting(null)
      setToast('记录已删除')
    } catch (error) {
      setToast(getErrorMessage(error))
    } finally {
      setDeletingId(null)
    }
  }

  const handleRemake = (record: VideoHistoryRecord) => {
    if (!record.sourceUrl) return
    saveRemakeSelection({
      sourceType: 'history',
      businessId: record.id,
      title: record.title,
      sourceUrl: record.sourceUrl,
    })
    navigate('/workspace')
  }

  const handleReset = async () => {
    await dataProvider.resetDemoHistory?.()
    history.reload()
    setToast('示例记录已恢复')
  }

  return (
    <section className="page history-page">
      {history.status === 'loading' && <ListSkeleton variant="history" count={3} />}
      {history.status === 'error' && (
        <DataState title="历史记录加载失败" message={history.error ?? '请稍后重试'} onRetry={history.reload} />
      )}
      {history.status === 'empty' && (
        <div className="empty-history reveal">
          <div className="empty-history__icon"><Film size={30} /></div>
          <h2>还没有生成记录</h2>
          <p>完成的视频会按时间保存在这里。</p>
          <button type="button" onClick={() => navigate('/workspace')}>
            返回工作台<ChevronRight size={16} />
          </button>
          {dataMode === 'mock' && (
            <button type="button" className="text-button" onClick={() => void handleReset()}>
              <RotateCcw size={14} />恢复示例记录
            </button>
          )}
        </div>
      )}
      {history.status === 'success' && (
        <>
          <div className="history-list">
            {history.items.map((record, index) => {
              const status = taskStatusMeta[record.status]
              const playable = record.playbackAvailable && Boolean(record.videoUrl)
              const inspectable = Boolean(record.inputSnapshot)
              const sourceUrl = record.sourceUrl
              const remakeable = Boolean(sourceUrl)
              return (
                <article
                  className={`history-card history-card--${status.className} reveal`}
                  style={{ animationDelay: `${80 + Math.min(index, 8) * 70}ms` }}
                  key={record.id}
                >
                  {record.coverUrl ? (
                    <button
                      type="button"
                      className="video-thumb"
                      onClick={() => playable && setPlaying(record)}
                      aria-label={playable ? `播放${record.title}` : `${record.title}暂不可播放`}
                      disabled={!playable}
                    >
                      <img src={record.coverUrl} alt="" />
                      <span className="video-thumb__wash" />
                      {playable && <span className="video-thumb__play"><Play size={19} fill="currentColor" /></span>}
                      <span className="video-thumb__duration">{formatDuration(record.durationSeconds)}</span>
                      <span className="video-thumb__rail" aria-hidden="true" />
                    </button>
                  ) : (
                    <div className="video-thumb video-thumb--empty" aria-label="生成失败，无视频封面">
                      <FileVideo size={25} aria-hidden="true" />
                      <span>未生成视频</span>
                      <span className="video-thumb__rail" aria-hidden="true" />
                    </div>
                  )}

                  <div className="history-card__body">
                    <div className="history-card__title-row">
                      <div>
                        <span className={`status-pill status-pill--${status.className}`}><i />{status.label}</span>
                        <h2>{record.title}</h2>
                      </div>
                      <button
                        type="button"
                        className="icon-button icon-button--danger"
                        onClick={() => setDeleting(record)}
                        aria-label={`删除${record.title}`}
                        disabled={deletingId === record.id}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>

                    <div className="record-time">
                      <Clock3 size={13} aria-hidden="true" />
                      <span>{formatHistoryDateTime(record.generatedAt)}</span>
                    </div>

                    {record.status === 'failed' && record.failureReason && (
                      <p className="task-failure" role="status">{record.failureReason}</p>
                    )}

                    <div className="record-actions">
                      <button
                        type="button"
                        disabled={!playable || downloadingId === record.id}
                        onClick={() => void handleDownload(record)}
                      >
                        <Download size={15} />{downloadingId === record.id ? '获取中' : '下载'}
                      </button>
                      <button
                        type="button"
                        disabled={!inspectable}
                        onClick={() => inspectable && setInspecting(record)}
                      >
                        <Eye size={15} />查看
                      </button>
                      <button
                        type="button"
                        className="primary-action"
                        disabled={!remakeable}
                        onClick={() => remakeable && handleRemake(record)}
                      >
                        <RefreshCw size={15} />做同款
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
          <PaginationControl
            hasMore={Boolean(history.nextCursor)}
            loading={history.loadingMore}
            error={history.loadMoreError}
            onLoadMore={history.loadMore}
          />
        </>
      )}

      {playing && (
        <VideoPlayer
          title={playing.title}
          videoUrl={playing.videoUrl}
          coverUrl={playing.coverUrl}
          onClose={() => setPlaying(null)}
        />
      )}
      {inspecting && (
        <HistoryInputsSheet record={inspecting} onClose={() => setInspecting(null)} />
      )}
      {deleting && (
        <DeleteSheet
          record={deleting}
          pending={deletingId === deleting.id}
          onCancel={() => !deletingId && setDeleting(null)}
          onConfirm={() => void handleConfirmDelete()}
        />
      )}
      {toast && <Toast message={toast} />}
    </section>
  )
}

function HistoryInputsSheet({ record, onClose }: { record: VideoHistoryRecord; onClose: () => void }) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const sourceVideoRef = useRef<HTMLVideoElement>(null)
  const [sourcePlaying, setSourcePlaying] = useState(false)
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null)
  const snapshot = record.inputSnapshot
  const sourceVideo = snapshot?.sourceVideo

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const sourceVideoElement = sourceVideoRef.current
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      sourceVideoElement?.pause()
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  useEffect(() => {
    if (!copyFeedback) return
    const timer = window.setTimeout(() => setCopyFeedback(null), 1800)
    return () => window.clearTimeout(timer)
  }, [copyFeedback])

  if (!snapshot) return null

  const toggleSourceVideo = () => {
    const video = sourceVideoRef.current
    if (!video) return
    if (video.paused) {
      void video.play().catch(() => setSourcePlaying(false))
    } else {
      video.pause()
    }
  }

  const copySourceUrl = async () => {
    if (!record.sourceUrl) return

    try {
      await navigator.clipboard.writeText(record.sourceUrl)
      setCopyFeedback('原视频链接已复制')
    } catch {
      const textArea = document.createElement('textarea')
      textArea.value = record.sourceUrl
      textArea.setAttribute('readonly', '')
      textArea.style.position = 'fixed'
      textArea.style.opacity = '0'
      document.body.appendChild(textArea)
      textArea.select()
      const copied = document.execCommand('copy')
      textArea.remove()
      setCopyFeedback(copied ? '原视频链接已复制' : '复制失败，请长按链接')
    }
  }

  return (
    <div className="sheet-backdrop input-inspector-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="bottom-sheet input-inspector-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="input-inspector-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <span className="bottom-sheet__handle" />
        <header className="input-inspector__header">
          <div>
            <span>INPUT ARCHIVE</span>
            <h2 id="input-inspector-title">生成素材详情</h2>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="关闭生成素材详情">
            <X size={19} />
          </button>
        </header>

        <div className="input-inspector__source">
          <div className="input-source-preview">
            {sourceVideo?.videoUrl ? (
              <video
                ref={sourceVideoRef}
                src={sourceVideo.videoUrl}
                poster={sourceVideo.coverUrl}
                playsInline
                preload="metadata"
                onClick={toggleSourceVideo}
                onPlay={() => setSourcePlaying(true)}
                onPause={() => setSourcePlaying(false)}
                onEnded={() => setSourcePlaying(false)}
                aria-label="洗稿前原视频，轻触暂停或继续播放"
              />
            ) : sourceVideo?.coverUrl ? (
              <img src={sourceVideo.coverUrl} alt="洗稿前原视频封面" />
            ) : (
              <span className="input-source-preview__empty"><FileVideo size={25} /></span>
            )}
            {sourceVideo?.videoUrl && !sourcePlaying && (
              <button type="button" onClick={toggleSourceVideo} aria-label="播放洗稿前原视频">
                <Play size={21} fill="currentColor" />
              </button>
            )}
          </div>
          <div className="input-source-meta">
            <span><Film size={14} />ORIGINAL</span>
            <h3>洗稿前原视频</h3>
            <p>{sourceVideo?.kind === 'file' ? sourceVideo.fileName ?? '本地上传视频' : '链接视频'}</p>
            {record.sourceUrl && (
              <div className="input-source-link">
                <a
                  href={record.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={record.sourceUrl}
                  aria-label="打开原视频链接"
                >
                  <span>{record.sourceUrl.replace(/^https?:\/\//, '')}</span>
                  <ExternalLink size={13} aria-hidden="true" />
                </a>
                <button type="button" onClick={() => void copySourceUrl()} aria-label="复制原视频链接">
                  <Copy size={15} aria-hidden="true" />
                </button>
              </div>
            )}
            {copyFeedback && <small className="input-source-link__feedback" role="status">{copyFeedback}</small>}
            <strong>{sourceVideo ? formatDuration(sourceVideo.durationSeconds) : '素材不可用'}</strong>
          </div>
        </div>

        <div className="input-material-tracks">
          <HistoryMaterialTrack title="替换产品" code="PRODUCT" icon={<ShoppingBag size={17} />} items={snapshot.products} />
          <HistoryMaterialTrack title="替换人物" code="CHARACTER" icon={<UserRound size={17} />} items={snapshot.characters} />
          <HistoryMaterialTrack title="替换场景" code="SCENE" icon={<Warehouse size={17} />} items={snapshot.scenes} />
        </div>
      </section>
    </div>
  )
}

function HistoryMaterialTrack({
  title,
  code,
  icon,
  items,
}: {
  title: string
  code: string
  icon: React.ReactNode
  items: HistoryReplacementMapping[]
}) {
  return (
    <section className="input-material-track" aria-label={title}>
      <div className="input-material-track__label">
        {icon}
        <div><span>{code}</span><h3>{title}</h3><small>{items.length} 组</small></div>
      </div>
      <div className="input-material-track__items">
        {items.length > 0 ? items.map((item, index) => (
          <article key={item.id} className="input-material-map" aria-label={`${item.original.label}替换为${item.replacement.label}`}>
            <span className="input-material-map__index">{String(index + 1).padStart(2, '0')}</span>
            <HistoryMaterialAsset item={item.original} />
            <span className="input-material-map__arrow" aria-hidden="true"><ArrowRight size={15} /></span>
            <HistoryMaterialAsset item={item.replacement} />
          </article>
        )) : <p>未指定</p>}
      </div>
    </section>
  )
}

function HistoryMaterialAsset({ item }: { item: MediaReference }) {
  return (
    <div className="input-material-map__asset">
      <div className="input-material-map__thumb">
        {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <span><FileVideo size={17} /></span>}
      </div>
      <strong title={item.label}>{item.label}</strong>
    </div>
  )
}

function VideoPlayer({
  title,
  videoUrl,
  coverUrl,
  onClose,
}: {
  title: string
  videoUrl?: string
  coverUrl?: string
  onClose: () => void
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  useEffect(() => {
    if (!videoUrl) return
    const video = videoRef.current
    if (!video) return

    video.setAttribute('webkit-playsinline', 'true')
    video.setAttribute('x5-playsinline', 'true')
    video.setAttribute('x5-video-player-type', 'h5-page')
    video.setAttribute('x5-video-player-fullscreen', 'false')

    const startPlayback = () => {
      const playback = video.play()
      if (playback) {
        void playback.catch(() => {
          video.setAttribute('aria-label', '自动播放被浏览器限制，轻触开始播放')
        })
      }
    }

    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      startPlayback()
    } else {
      video.addEventListener('loadeddata', startPlayback, { once: true })
    }

    return () => video.removeEventListener('loadeddata', startPlayback)
  }, [videoUrl])

  const togglePlayback = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      void video.play()
    } else {
      video.pause()
    }
  }

  return (
    <div className="player-modal" role="dialog" aria-modal="true" aria-label={`${title}播放器`}>
      <div className="player-modal__topbar">
        <div>
          <span>PLAYBACK</span>
          <strong>{title}</strong>
        </div>
        <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="关闭播放器">
          <X size={22} />
        </button>
      </div>
      <div className="player-modal__stage">
        {videoUrl ? (
          <>
            <video
              ref={videoRef}
              src={videoUrl}
              poster={coverUrl}
              autoPlay
              playsInline
              disablePictureInPicture
              preload="metadata"
              onClick={togglePlayback}
              aria-label="轻触暂停或继续播放"
            />
          </>
        ) : (
          <div className="player-modal__empty" aria-label="暂无视频素材" />
        )}
      </div>
      <p className="player-modal__hint">
        {videoUrl ? '轻触画面暂停或继续播放' : '暂无视频素材'}
      </p>
    </div>
  )
}

function DeleteSheet({
  record,
  pending,
  onCancel,
  onConfirm,
}: {
  record: VideoHistoryRecord
  pending: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="sheet-backdrop" role="presentation" onMouseDown={onCancel}>
      <div
        className="bottom-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <span className="bottom-sheet__handle" />
        <div className="bottom-sheet__icon"><Trash2 size={21} /></div>
        <h2 id="delete-title">删除这条记录？</h2>
        <p>“{record.title}”将从历史记录中移除，此操作无法撤销。</p>
        <div className="bottom-sheet__actions">
          <button type="button" disabled={pending} onClick={onCancel}>取消</button>
          <button type="button" disabled={pending} className="danger-action" onClick={onConfirm}>
            {pending ? '删除中…' : '确认删除'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Toast({ message }: { message: string }) {
  return (
    <div className="toast" role="status">
      <Check size={16} />
      <span>{message}</span>
    </div>
  )
}

function ProfileAvatar({ profile }: { profile: AccountProfile }) {
  const [failed, setFailed] = useState(false)
  return (
    <div className="avatar-wrap">
      {failed ? (
        <CircleUserRound size={36} aria-label="默认头像" />
      ) : (
        <img src={profile.avatarUrl} alt="微信头像" onError={() => setFailed(true)} />
      )}
      <span><Check size={11} strokeWidth={3} /></span>
    </div>
  )
}

function ProfilePage() {
  const loadAccount = useCallback((signal: AbortSignal) => dataProvider.getAccountSummary(signal), [])
  const account = useAsyncResource(loadAccount)
  const loadUsagePage = useCallback(
    (cursor: string | null, signal: AbortSignal) => dataProvider.getQuotaUsages(cursor, 20, signal),
    [],
  )
  const usage = useCursorList(loadUsagePage)
  const usageGroups = useMemo(() => {
    const groups = new Map<string, QuotaUsageRecord[]>()
    usage.items.forEach((record) => {
      const key = new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric',
        month: 'long',
      }).format(new Date(record.occurredAt))
      groups.set(key, [...(groups.get(key) ?? []), record])
    })
    return [...groups.entries()]
  }, [usage.items])
  const profile = account.data
  const totalQuota = profile ? profile.quotaRemaining + profile.quotaUsedThisMonth : 0
  const usedPercentage = profile && totalQuota > 0
    ? Math.round((profile.quotaUsedThisMonth / totalQuota) * 100)
    : 0

  return (
    <section className="page profile-page">
      {account.status === 'loading' && <ListSkeleton variant="usage" count={2} />}
      {account.status === 'error' && (
        <DataState title="账户信息加载失败" message={account.error ?? '请稍后重试'} onRetry={account.reload} />
      )}
      {profile && (
        <>
          <article className="profile-card reveal">
            <ProfileAvatar profile={profile} />
            <div className="profile-card__identity">
              <h2>{profile.nickname}</h2>
              <p>{profile.maskedPhone}</p>
              <span>ID&nbsp; {profile.userId}</span>
            </div>
            <CircleUserRound size={21} className="profile-card__mark" aria-hidden="true" />
          </article>

          <article className="balance-panel reveal reveal-delay">
            <div className="balance-panel__top">
              <div>
                <span><WalletCards size={15} />账户余额</span>
                <strong><small>¥</small>{(profile.balanceFen / 100).toFixed(2)}</strong>
              </div>
              <div className="quota-dial" style={{ '--quota': `${usedPercentage * 3.6}deg` } as React.CSSProperties}>
                <span>{usedPercentage}<small>%</small></span>
              </div>
            </div>
            <div className="balance-panel__divider" />
            <div className="quota-stats">
              <div>
                <span>剩余额度</span>
                <strong>{profile.quotaRemaining}<small> 次</small></strong>
              </div>
              <div>
                <span>本月已用</span>
                <strong>{profile.quotaUsedThisMonth}<small> 次</small></strong>
              </div>
              <div>
                <span>总额度</span>
                <strong>{totalQuota}<small> 次</small></strong>
              </div>
            </div>
          </article>
        </>
      )}

      <section className="usage-section reveal reveal-delay-2">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">USAGE LOG</p>
            <h2>额度消耗记录</h2>
          </div>
          <span>最近 30 天</span>
        </div>

        {usage.status === 'loading' && <ListSkeleton variant="usage" count={4} />}
        {usage.status === 'error' && (
          <DataState title="额度记录加载失败" message={usage.error ?? '请稍后重试'} onRetry={usage.reload} />
        )}
        {usage.status === 'empty' && (
          <DataState title="暂无额度记录" message="发生额度消耗或返还后会显示在这里。" />
        )}
        {usage.status === 'success' && (
          <>
            {usageGroups.map(([month, records]) => (
              <div className="usage-group" key={month}>
                <p className="usage-group__month">{month}</p>
                <div className="usage-list">
                  {records.map((record) => (
                    <div className="usage-row" key={record.id}>
                      <div className={`usage-row__marker ${record.status}`}>
                        {record.status === 'refunded' ? <RotateCcw size={15} /> : <Film size={15} />}
                      </div>
                      <div className="usage-row__info">
                        <strong>{record.taskTitle}</strong>
                        <span>{formatDateTime(record.occurredAt)}</span>
                      </div>
                      <div className={`usage-row__amount ${record.status}`}>
                        <strong>{record.status === 'refunded' ? '+' : '−'}{record.amount}</strong>
                        <span>{record.status === 'refunded' ? '已返还' : '已消耗'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <PaginationControl
              hasMore={Boolean(usage.nextCursor)}
              loading={usage.loadingMore}
              error={usage.loadMoreError}
              onLoadMore={usage.loadMore}
            />
          </>
        )}
      </section>
    </section>
  )
}

export default function App() {
  return <AppShell />
}
