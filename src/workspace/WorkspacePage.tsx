import {
  ArrowRight,
  ChevronDown,
  Check,
  Database,
  FileVideo,
  ImagePlus,
  Link2,
  LoaderCircle,
  PencilLine,
  Plus,
  RefreshCw,
  ScanLine,
  SendHorizontal,
  Trash2,
  Upload,
  UserRound,
  Warehouse,
  X,
} from 'lucide-react'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { dataProvider } from '../data/providerInstance'
import { getErrorMessage } from '../data/dataProvider'
import {
  clearRemakeSelection,
  readRemakeSelection,
} from '../data/remakeSession'
import type {
  AnalysisStage,
  MediaReference,
  ProductReferenceImage,
  StoryboardSegment,
  VideoAnalysisResult,
  WorkspacePhase,
  WorkspaceSource,
} from '../types'

const workspaceSessionKey = 'ai-video-workbench-workspace-session-v1'
const minimumProductImages = 1
const maximumProductImages = 5

const analysisStages: AnalysisStage[] = [
  { id: 'frames', label: '提取视频帧', progress: 24 },
  { id: 'entities', label: '识别人物与场景', progress: 62 },
  { id: 'relations', label: '建立分镜关联', progress: 91 },
]

interface ReplacementMappingDraft {
  id: string
  originalId: string
  replacement: MediaReference | null
}

function createReplacementRow(): ReplacementMappingDraft {
  return {
    id: `replacement-row-${crypto.randomUUID()}`,
    originalId: '',
    replacement: null,
  }
}

function uniqueMedia(
  segments: StoryboardSegment[],
  key: 'characters' | 'scene',
): MediaReference[] {
  const media = new Map<string, MediaReference>()
  segments.forEach((segment) => {
    if (key === 'characters') {
      segment.characters.forEach((item) => media.set(item.id, item))
      return
    }
    const scene = segment.scene
    if (scene) media.set(scene.id, scene)
  })
  return [...media.values()]
}

function WorkspaceHeader() {
  return (
    <header className="page-header reveal">
      <div>
        <p className="eyebrow">AI VIDEO LAB</p>
        <h1>工作台</h1>
      </div>
    </header>
  )
}

export function WorkspacePage() {
  const [remake, setRemake] = useState(() => readRemakeSelection())
  const [sourceUrl, setSourceUrl] = useState(() => remake?.sourceUrl ?? '')
  const [phase, setPhase] = useState<WorkspacePhase>('source')
  const [source, setSource] = useState<WorkspaceSource | null>(null)
  const [result, setResult] = useState<VideoAnalysisResult | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  const [analysisStageIndex, setAnalysisStageIndex] = useState(0)
  const [generationProgress, setGenerationProgress] = useState(0)
  const [errorMessage, setErrorMessage] = useState('')
  const [errorKind, setErrorKind] = useState<'cache' | 'analysis'>('analysis')
  const [products, setProducts] = useState<ProductReferenceImage[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const [replacementOpen, setReplacementOpen] = useState(false)
  const [replacementType, setReplacementType] = useState<'character' | 'scene'>('character')
  const [replacementRows, setReplacementRows] = useState<ReplacementMappingDraft[]>(
    () => [createReplacementRow()],
  )
  const [previewProduct, setPreviewProduct] = useState<ProductReferenceImage | null>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const productInputRef = useRef<HTMLInputElement>(null)
  const replacementInputRef = useRef<HTMLInputElement>(null)
  const activeReplacementRowRef = useRef<string | null>(null)
  const requestControllerRef = useRef<AbortController | null>(null)
  const stageTimersRef = useRef<number[]>([])
  const generationTimersRef = useRef<number[]>([])
  const productUrlsRef = useRef(new Set<string>())
  const customMediaUrlsRef = useRef(new Set<string>())

  const characterMedia = useMemo(
    () => uniqueMedia(result?.segments ?? [], 'characters'),
    [result],
  )
  const sceneMedia = useMemo(
    () => uniqueMedia(result?.segments ?? [], 'scene'),
    [result],
  )
  const currentMedia = replacementType === 'character' ? characterMedia : sceneMedia

  useEffect(() => {
    sessionStorage.removeItem(workspaceSessionKey)
    clearRemakeSelection()
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 2600)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (previewProduct) setPreviewProduct(null)
      else if (replacementOpen) closeReplacementSheet()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  })

  useEffect(() => () => {
    requestControllerRef.current?.abort()
    stageTimersRef.current.forEach(window.clearTimeout)
    generationTimersRef.current.forEach(window.clearTimeout)
    productUrlsRef.current.forEach(URL.revokeObjectURL)
    customMediaUrlsRef.current.forEach(URL.revokeObjectURL)
  }, [])

  const clearAnalysisTimers = () => {
    stageTimersRef.current.forEach(window.clearTimeout)
    stageTimersRef.current = []
  }

  const clearGenerationTimers = () => {
    generationTimersRef.current.forEach(window.clearTimeout)
    generationTimersRef.current = []
  }

  const beginRequest = () => {
    requestControllerRef.current?.abort()
    const controller = new AbortController()
    requestControllerRef.current = controller
    return controller
  }

  const finishWithResult = (nextResult: VideoAnalysisResult) => {
    clearAnalysisTimers()
    setResult(nextResult)
    setSource(nextResult.source)
    setExpandedIds(new Set())
    setPhase('result')
    setErrorMessage('')
  }

  const runAnalysis = async (nextSource: WorkspaceSource) => {
    const controller = beginRequest()
    setSource(nextSource)
    setPhase('analyzing')
    setAnalysisStageIndex(0)
    setErrorMessage('')
    clearAnalysisTimers()
    stageTimersRef.current = [
      window.setTimeout(() => setAnalysisStageIndex(1), 850),
      window.setTimeout(() => setAnalysisStageIndex(2), 1_750),
    ]
    try {
      const nextResult = await dataProvider.analyzeVideo(nextSource, controller.signal)
      if (!controller.signal.aborted) finishWithResult(nextResult)
    } catch (error) {
      if (controller.signal.aborted) return
      clearAnalysisTimers()
      setErrorKind('analysis')
      setErrorMessage(getErrorMessage(error))
      setPhase('error')
    }
  }

  const lookupThenAnalyze = async (linkSource: Extract<WorkspaceSource, { kind: 'link' }>) => {
    const controller = beginRequest()
    setSource(linkSource)
    setPhase('checking-cache')
    setErrorMessage('')
    try {
      const lookup = await dataProvider.lookupVideoAnalysis(linkSource.url, controller.signal)
      if (controller.signal.aborted) return
      if (lookup.hit) {
        finishWithResult({ ...lookup.result, origin: 'cached' })
        return
      }
      await runAnalysis(linkSource)
    } catch (error) {
      if (controller.signal.aborted) return
      setErrorKind('cache')
      setErrorMessage(getErrorMessage(error))
      setPhase('error')
    }
  }

  const handleLinkSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedUrl = sourceUrl.trim()
    if (!trimmedUrl) return
    setRemake(null)
    void lookupThenAnalyze({ kind: 'link', url: trimmedUrl })
  }

  const handleVideoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setRemake(null)
    setSourceUrl('')
    void runAnalysis({
      kind: 'file',
      name: file.name,
      sizeBytes: file.size,
      mimeType: file.type || 'video/mp4',
    })
  }

  const resetWorkspace = () => {
    requestControllerRef.current?.abort()
    clearAnalysisTimers()
    clearGenerationTimers()
    products.forEach((product) => {
      URL.revokeObjectURL(product.imageUrl)
      productUrlsRef.current.delete(product.imageUrl)
    })
    customMediaUrlsRef.current.forEach(URL.revokeObjectURL)
    customMediaUrlsRef.current.clear()
    sessionStorage.removeItem(workspaceSessionKey)
    setProducts([])
    setResult(null)
    setSource(null)
    setSourceUrl('')
    setExpandedIds(new Set())
    setGenerationProgress(0)
    setPhase('source')
    setErrorMessage('')
  }

  const cancelAnalysis = () => {
    requestControllerRef.current?.abort()
    clearAnalysisTimers()
    setPhase('source')
    setSource(null)
    setErrorMessage('')
    setToast('已取消分析')
  }

  const retryCurrentStep = () => {
    if (!source) return
    if (errorKind === 'cache' && source.kind === 'link') void lookupThenAnalyze(source)
    else void runAnalysis(source)
  }

  const toggleSegment = (segmentId: string) => {
    setExpandedIds((current) => {
      const next = new Set(current)
      if (next.has(segmentId)) next.delete(segmentId)
      else next.add(segmentId)
      return next
    })
  }

  const handleProductChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])]
    event.target.value = ''
    if (files.length === 0) return
    const availableCount = maximumProductImages - products.length
    const accepted = files.filter((file) => file.type.startsWith('image/')).slice(0, availableCount)
    const nextProducts = accepted.map((file) => {
      const imageUrl = URL.createObjectURL(file)
      productUrlsRef.current.add(imageUrl)
      return {
        id: `product-reference-${crypto.randomUUID()}`,
        fileName: file.name,
        imageUrl,
      }
    })
    setProducts((current) => [...current, ...nextProducts])
    if (accepted.length < files.length) setToast(`最多上传${maximumProductImages}张产品图`)
    else setToast(`已添加${accepted.length}张产品图`)
  }

  const removeProduct = (product: ProductReferenceImage) => {
    URL.revokeObjectURL(product.imageUrl)
    productUrlsRef.current.delete(product.imageUrl)
    setProducts((current) => current.filter((item) => item.id !== product.id))
    setPreviewProduct((current) => current?.id === product.id ? null : current)
  }

  const resetReplacementForm = () => {
    replacementRows.forEach((row) => {
      if (row.replacement?.imageUrl && customMediaUrlsRef.current.has(row.replacement.imageUrl)) {
        URL.revokeObjectURL(row.replacement.imageUrl)
        customMediaUrlsRef.current.delete(row.replacement.imageUrl)
      }
    })
    activeReplacementRowRef.current = null
    setReplacementRows([createReplacementRow()])
  }

  function closeReplacementSheet() {
    resetReplacementForm()
    setReplacementOpen(false)
  }

  const switchReplacementType = (type: 'character' | 'scene') => {
    resetReplacementForm()
    setReplacementType(type)
  }

  const handleReplacementUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    const rowId = activeReplacementRowRef.current
    activeReplacementRowRef.current = null
    if (!file || !file.type.startsWith('image/') || !rowId) return
    const imageUrl = URL.createObjectURL(file)
    customMediaUrlsRef.current.add(imageUrl)
    setReplacementRows((current) => current.map((row) => {
      if (row.id !== rowId) return row
      if (row.replacement?.imageUrl && customMediaUrlsRef.current.has(row.replacement.imageUrl)) {
        URL.revokeObjectURL(row.replacement.imageUrl)
        customMediaUrlsRef.current.delete(row.replacement.imageUrl)
      }
      return {
        ...row,
        replacement: {
          id: `custom-${replacementType}-${crypto.randomUUID()}`,
          label: file.name,
          imageUrl,
        },
      }
    }))
  }

  const changeReplacementOriginal = (rowId: string, originalId: string) => {
    setReplacementRows((current) => current.map((row) =>
      row.id === rowId ? { ...row, originalId } : row,
    ))
  }

  const addReplacementRow = () => {
    if (replacementRows.length >= currentMedia.length) return
    setReplacementRows((current) => [...current, createReplacementRow()])
  }

  const removeReplacementRow = (rowId: string) => {
    setReplacementRows((current) => {
      const target = current.find((row) => row.id === rowId)
      if (target?.replacement?.imageUrl && customMediaUrlsRef.current.has(target.replacement.imageUrl)) {
        URL.revokeObjectURL(target.replacement.imageUrl)
        customMediaUrlsRef.current.delete(target.replacement.imageUrl)
      }
      if (current.length === 1) return [createReplacementRow()]
      return current.filter((row) => row.id !== rowId)
    })
  }

  const confirmReplacement = () => {
    if (!result || replacementRows.some((row) => !row.originalId || !row.replacement)) return
    const replacements = new Map(
      replacementRows.map((row) => [row.originalId, row.replacement] as const),
    )
    let affectedCount = 0
    const nextSegments = result.segments.map((segment) => {
      if (replacementType === 'character') {
        let changed = false
        const characters = segment.characters.map((character) => {
          const replacement = replacements.get(character.id)
          if (!replacement) return character
          changed = true
          return replacement
        })
        if (!changed) return segment
        affectedCount += 1
        return { ...segment, characters }
      }
      const replacement = segment.scene ? replacements.get(segment.scene.id) : undefined
      if (!replacement) return segment
      affectedCount += 1
      return { ...segment, scene: replacement }
    })
    setResult({ ...result, segments: nextSegments })
    setReplacementRows([createReplacementRow()])
    setReplacementOpen(false)
    setToast(`已应用${replacementRows.length}组替换，更新${affectedCount}个分镜`)
  }

  const continueToNextStep = () => {
    if (products.length < minimumProductImages) return
    clearGenerationTimers()
    setExpandedIds(new Set())
    setGenerationProgress(8)
    setPhase('generating')
    generationTimersRef.current = [
      window.setTimeout(() => setGenerationProgress(31), 650),
      window.setTimeout(() => setGenerationProgress(57), 1_550),
      window.setTimeout(() => setGenerationProgress(84), 2_650),
      window.setTimeout(() => {
        setGenerationProgress(100)
        setPhase('generated')
      }, 3_850),
    ]
  }

  return (
    <section className={`page workspace-page${phase === 'result' ? ' workspace-page--has-dock' : ''}`}>
      <WorkspaceHeader />

      {phase === 'source' && (
        <SourceStep
          remakeTitle={remake?.title}
          sourceUrl={sourceUrl}
          onSourceChange={setSourceUrl}
          onCloseRemake={() => setRemake(null)}
          onSubmit={handleLinkSubmit}
          onUpload={() => videoInputRef.current?.click()}
        />
      )}

      {(phase === 'checking-cache' || phase === 'analyzing') && source && (
        <AnalysisProgress
          phase={phase}
          source={source}
          stage={analysisStages[analysisStageIndex] ?? analysisStages[0]}
          onCancel={cancelAnalysis}
        />
      )}

      {phase === 'error' && (
        <WorkspaceError
          message={errorMessage}
          isCacheError={errorKind === 'cache'}
          onRetry={retryCurrentStep}
          onReset={resetWorkspace}
        />
      )}

      {phase === 'result' && result && (
        <StoryboardResult
          result={result}
          expandedIds={expandedIds}
          onToggle={toggleSegment}
          onReset={resetWorkspace}
        />
      )}

      {(phase === 'generating' || phase === 'generated') && (
        <VideoGenerationStep complete={phase === 'generated'} progress={generationProgress} />
      )}

      <input
        ref={videoInputRef}
        type="file"
        accept="video/*,.mp4,.mov,.m4v"
        className="visually-hidden"
        onChange={handleVideoChange}
        aria-label="选择本地视频"
      />

      {phase === 'result' && result && (
        <WorkspaceActionDock
          products={products}
          onUpload={() => productInputRef.current?.click()}
          onPreview={setPreviewProduct}
          onRemove={removeProduct}
          onModify={() => setReplacementOpen(true)}
          onNext={continueToNextStep}
        />
      )}
      <input
        ref={productInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="visually-hidden"
        onChange={handleProductChange}
        aria-label="选择产品参考图"
      />

      {replacementOpen && result && (
        <ReplacementSheet
          type={replacementType}
          media={currentMedia}
          rows={replacementRows}
          onTypeChange={switchReplacementType}
          onOriginalChange={changeReplacementOriginal}
          onUpload={(rowId) => {
            activeReplacementRowRef.current = rowId
            replacementInputRef.current?.click()
          }}
          onAddRow={addReplacementRow}
          onRemoveRow={removeReplacementRow}
          onClose={closeReplacementSheet}
          onConfirm={confirmReplacement}
        />
      )}
      <input
        ref={replacementInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="visually-hidden"
        onChange={handleReplacementUpload}
        aria-label={`上传新${replacementType === 'character' ? '人物' : '场景'}图片`}
      />

      {previewProduct && (
        <div className="workspace-image-preview" role="dialog" aria-modal="true" aria-label="产品图预览">
          <button type="button" onClick={() => setPreviewProduct(null)} aria-label="关闭预览">
            <X size={22} />
          </button>
          <img src={previewProduct.imageUrl} alt={previewProduct.fileName} />
          <span>{previewProduct.fileName}</span>
        </div>
      )}

      {toast && <WorkspaceToast message={toast} />}
    </section>
  )
}

function SourceStep({
  remakeTitle,
  sourceUrl,
  onSourceChange,
  onCloseRemake,
  onSubmit,
  onUpload,
}: {
  remakeTitle?: string
  sourceUrl: string
  onSourceChange: (value: string) => void
  onCloseRemake: () => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  onUpload: () => void
}) {
  return (
    <>
      {remakeTitle && (
        <div className="remake-banner reveal" role="status">
          <Check size={17} aria-hidden="true" />
          <div><strong>已选中同款来源</strong><span>{remakeTitle}</span></div>
          <button type="button" onClick={onCloseRemake} aria-label="关闭提示"><X size={17} /></button>
        </div>
      )}
      <div className="source-entry reveal reveal-delay">
        <div className="source-entry__heading">
          <span>STEP 01 / SOURCE</span>
          <h2>导入原视频</h2>
          <p>粘贴视频链接，或直接从手机上传。</p>
        </div>
        <form className="source-entry__control" onSubmit={onSubmit}>
          <div className="source-input-wrap">
            <Link2 size={18} aria-hidden="true" />
            <input
              type="url"
              inputMode="url"
              value={sourceUrl}
              onChange={(event) => onSourceChange(event.target.value)}
              placeholder="粘贴视频链接"
              aria-label="原视频链接"
              required
            />
            {sourceUrl && (
              <button type="button" className="source-input-wrap__clear" onClick={() => onSourceChange('')} aria-label="清空视频链接">
                <X size={15} />
              </button>
            )}
            <button type="submit" className="source-input-wrap__send" disabled={!sourceUrl.trim()} aria-label="发送视频链接">
              <SendHorizontal size={17} />
            </button>
          </div>
          <button type="button" className="upload-video-button" onClick={onUpload} aria-label="上传视频">
            <Upload size={20} /><span>上传</span>
          </button>
        </form>
        <div className="source-entry__note">
          <span>链接会先查询历史分析</span><span>上传后自动继续</span>
        </div>
      </div>
    </>
  )
}

function AnalysisProgress({
  phase,
  source,
  stage,
  onCancel,
}: {
  phase: 'checking-cache' | 'analyzing'
  source: WorkspaceSource
  stage: AnalysisStage
  onCancel: () => void
}) {
  const isChecking = phase === 'checking-cache'
  const sourceLabel = source.kind === 'link' ? source.url : source.name
  return (
    <div className={`analysis-progress reveal${isChecking ? ' is-checking' : ''}`} role="status" aria-live="polite">
      <div className="source-entry__heading">
        <span>{isChecking ? 'STEP 02 / CACHE' : 'STEP 02 / ANALYSIS'}</span>
        <h2>{isChecking ? '查询历史分析' : 'AI 正在拆解视频'}</h2>
        <p>{isChecking ? '先查找是否已有可复用的原始分镜。' : '正在识别画面结构、人物与商品关系。'}</p>
      </div>
      <div className="analysis-console">
        <div className="analysis-console__visual">
          {isChecking ? <Database size={32} /> : <ScanLine size={36} />}
          <span className="analysis-console__scanner" />
        </div>
        <div className="analysis-console__copy">
          <span>{isChecking ? 'PUBLIC ANALYSIS INDEX' : `STAGE ${analysisStages.findIndex((item) => item.id === stage.id) + 1} / 03`}</span>
          <strong>{isChecking ? '匹配视频指纹与来源链接' : stage.label}</strong>
          <p title={sourceLabel}>{source.kind === 'file' ? <FileVideo size={13} /> : <Link2 size={13} />}{sourceLabel}</p>
        </div>
        {isChecking ? <LoaderCircle className="analysis-console__loader" size={20} /> : <b>{stage.progress}%</b>}
      </div>
      <div className="analysis-track" aria-hidden="true">
        <span style={{ width: `${isChecking ? 38 : stage.progress}%` }} />
      </div>
      {!isChecking && (
        <ol className="analysis-stage-list">
          {analysisStages.map((item, index) => (
            <li key={item.id} className={index <= analysisStages.findIndex((entry) => entry.id === stage.id) ? 'is-active' : ''}>
              <span>{String(index + 1).padStart(2, '0')}</span>{item.label}
            </li>
          ))}
        </ol>
      )}
      <button type="button" className="analysis-cancel" onClick={onCancel}><X size={14} />取消{isChecking ? '查询' : '分析'}</button>
    </div>
  )
}

function WorkspaceError({
  message,
  isCacheError,
  onRetry,
  onReset,
}: {
  message: string
  isCacheError: boolean
  onRetry: () => void
  onReset: () => void
}) {
  return (
    <div className="workspace-error reveal" role="alert">
      <span>PROCESS INTERRUPTED</span>
      <h2>{isCacheError ? '历史分析查询失败' : 'AI 分析未完成'}</h2>
      <p>{message}</p>
      <div>
        <button type="button" onClick={onRetry}><RefreshCw size={15} />{isCacheError ? '重新查询' : '重新分析'}</button>
        <button type="button" onClick={onReset}>返回修改素材</button>
      </div>
    </div>
  )
}

function VideoGenerationStep({ complete, progress }: { complete: boolean; progress: number }) {
  const status = progress < 40
    ? '正在合成分镜画面'
    : progress < 75
      ? '正在融合人物与产品'
      : '正在编码竖屏视频'

  return (
    <section className="video-generation reveal" aria-live="polite">
      <div className="video-generation__heading">
        <span>STEP 03 / GENERATE</span>
        <h2>{complete ? '视频生成完成' : '正在生成视频'}</h2>
        <p>{complete ? '视频已就绪，可以直接查看。' : 'AI 正在根据分镜与参考素材生成成片。'}</p>
      </div>
      <div className={`generated-video-frame${complete ? ' is-complete' : ' is-loading'}`}>
        {complete ? (
          <video
            src="/trending/clothing-week-01.mp4"
            poster="/trending/clothing-week-01.jpg"
            controls
            playsInline
            preload="metadata"
            aria-label="生成的视频"
          />
        ) : (
          <div className="video-generation-loader">
            <div className="video-generation-loader__target">
              <ScanLine size={34} />
              <i />
            </div>
            <strong>{status}</strong>
            <span>{String(progress).padStart(2, '0')}%</span>
            <div className="video-generation-loader__track"><i style={{ width: `${progress}%` }} /></div>
          </div>
        )}
        <span className="generated-video-frame__ratio">9:16</span>
        {!complete && <i className="generated-video-frame__scan" />}
      </div>
      <div className="video-generation__status">
        {complete ? <><Check size={14} />生成完成</> : <><LoaderCircle size={14} />请保持页面打开</>}
      </div>
    </section>
  )
}

function StoryboardResult({
  result,
  expandedIds,
  onToggle,
  onReset,
}: {
  result: VideoAnalysisResult
  expandedIds: Set<string>
  onToggle: (segmentId: string) => void
  onReset: () => void
}) {
  return (
    <div className="storyboard-result reveal">
      <div className="storyboard-result__header">
        <div>
          <span>STEP 02 / STORYBOARD</span>
          <h2>分镜分析结果</h2>
          <p>{result.segments.length} 个分镜 · {new Date(result.analyzedAt).toLocaleString('zh-CN', { hour12: false })}</p>
        </div>
        <AnalysisProduct product={result.product} />
      </div>
      <table className="storyboard-table">
        <thead><tr><th>镜号</th><th>首帧</th><th>分镜内容</th><th><span className="visually-hidden">展开</span></th></tr></thead>
        <tbody>
          {result.segments.map((segment) => {
            const expanded = expandedIds.has(segment.id)
            return (
              <Fragment key={segment.id}>
                <tr className={expanded ? 'is-expanded' : ''}>
                  <td><span className="storyboard-number">{String(segment.number).padStart(2, '0')}</span></td>
                  <td><img className="storyboard-first-frame" src={segment.firstFrameUrl} alt={`分镜${segment.number}首帧`} /></td>
                  <td><button type="button" className="storyboard-content" onClick={() => onToggle(segment.id)}>{segment.content}</button></td>
                  <td><button type="button" className="storyboard-expand" onClick={() => onToggle(segment.id)} aria-expanded={expanded} aria-label={`${expanded ? '收起' : '展开'}分镜${segment.number}`}><ChevronDown size={18} /></button></td>
                </tr>
                {expanded && (
                  <tr className="storyboard-detail-row">
                    <td colSpan={4}>
                      <div className="storyboard-association-layout">
                        <div className="storyboard-secondary-media">
                          <MediaThumb label="关联场景" media={segment.scene} fallbackIcon={<Warehouse size={20} />} />
                        </div>
                        <CharacterTrack characters={segment.characters} />
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
      <button type="button" className="storyboard-reselect" onClick={onReset}><RefreshCw size={14} />重新选择原视频</button>
    </div>
  )
}

function AnalysisProduct({ product }: { product?: MediaReference }) {
  return (
    <aside className="analysis-product" aria-label={`关联产品：${product?.label ?? '暂无关联产品'}`}>
      <div className={!product?.imageUrl ? 'is-empty' : ''}>
        {product?.imageUrl
          ? <img src={product.imageUrl} alt={product.label} />
          : <ImagePlus size={18} />}
      </div>
      <p><span>关联产品</span><strong>{product?.label ?? '暂无产品'}</strong></p>
    </aside>
  )
}

function CharacterTrack({ characters }: { characters: MediaReference[] }) {
  return (
    <section className="storyboard-character-track" aria-label={`关联角色 ${characters.length}个`}>
      <div className="storyboard-character-track__heading">
        <span>关联角色</span>
        <b>{String(characters.length).padStart(2, '0')}</b>
      </div>
      <div className={`storyboard-character-rail${characters.length === 0 ? ' is-empty' : ''}`}>
        {characters.length > 0 ? characters.map((character, index) => (
          <article className="storyboard-character" key={`${character.id}-${index}`}>
            <div>
              {character.imageUrl
                ? <img src={character.imageUrl} alt={character.label} />
                : <UserRound size={20} />}
              <span>{String(index + 1).padStart(2, '0')}</span>
            </div>
            <strong>{character.label}</strong>
          </article>
        )) : (
          <div className="storyboard-character-empty">
            <UserRound size={20} />
            <span>该分镜未识别到人物</span>
          </div>
        )}
      </div>
    </section>
  )
}

function MediaThumb({ label, media, fallbackIcon }: { label: string; media?: MediaReference; fallbackIcon: React.ReactNode }) {
  return (
    <div className="storyboard-media">
      <span>{label}</span>
      <div className={!media?.imageUrl ? 'is-empty' : ''}>
        {media?.imageUrl ? <img src={media.imageUrl} alt={media.label} /> : fallbackIcon}
      </div>
      <strong>{media?.label ?? '暂无关联素材'}</strong>
    </div>
  )
}

function WorkspaceActionDock({
  products,
  onUpload,
  onPreview,
  onRemove,
  onModify,
  onNext,
}: {
  products: ProductReferenceImage[]
  onUpload: () => void
  onPreview: (product: ProductReferenceImage) => void
  onRemove: (product: ProductReferenceImage) => void
  onModify: () => void
  onNext: () => void
}) {
  return (
    <aside className="workspace-action-dock" aria-label="分镜操作">
      {products.length > 0 && (
        <div className="product-reference-tray">
          <span>产品参考</span>
          <div>
            {products.map((product) => (
              <div className="product-reference-item" key={product.id}>
                <button type="button" onClick={() => onPreview(product)} aria-label={`预览${product.fileName}`}><img src={product.imageUrl} alt="" /></button>
                <button type="button" onClick={() => onRemove(product)} aria-label={`删除${product.fileName}`}><X size={11} /></button>
              </div>
            ))}
          </div>
          <small>至少{minimumProductImages}张 · 建议不同角度</small>
        </div>
      )}
      <div className="workspace-action-dock__buttons">
        <button type="button" className="storyboard-modify-action" onClick={onModify}><PencilLine size={17} />修改</button>
        <button type="button" className="product-upload-action" onClick={onUpload} disabled={products.length >= maximumProductImages}>
          <ImagePlus size={18} />
          <span>上传产品图 <small>至少{minimumProductImages}张</small></span>
          <b>{products.length}/{maximumProductImages}</b>
        </button>
        <button type="button" className="storyboard-next-action" onClick={onNext} disabled={products.length < minimumProductImages}>下一步<ArrowRight size={17} /></button>
      </div>
    </aside>
  )
}

function ReplacementSheet({
  type,
  media,
  rows,
  onTypeChange,
  onOriginalChange,
  onUpload,
  onAddRow,
  onRemoveRow,
  onClose,
  onConfirm,
}: {
  type: 'character' | 'scene'
  media: MediaReference[]
  rows: ReplacementMappingDraft[]
  onTypeChange: (type: 'character' | 'scene') => void
  onOriginalChange: (rowId: string, originalId: string) => void
  onUpload: (rowId: string) => void
  onAddRow: () => void
  onRemoveRow: (rowId: string) => void
  onClose: () => void
  onConfirm: () => void
}) {
  const noun = type === 'character' ? '人物' : '场景'
  const usedOriginalIds = new Set(rows.map((row) => row.originalId).filter(Boolean))
  const readyCount = rows.filter((row) => row.originalId && row.replacement).length

  return (
    <div className="sheet-backdrop workspace-replace-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="bottom-sheet workspace-replace-sheet" role="dialog" aria-modal="true" aria-labelledby="replace-title" onMouseDown={(event) => event.stopPropagation()}>
        <span className="bottom-sheet__handle" />
        <div className="replacement-sheet__title">
          <div><span>GLOBAL REPLACE</span><h2 id="replace-title">全片素材替换</h2></div>
          <button type="button" onClick={onClose} aria-label="关闭修改弹窗"><X size={19} /></button>
        </div>
        <div className="replacement-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={type === 'character'} className={type === 'character' ? 'is-active' : ''} onClick={() => onTypeChange('character')}><UserRound size={15} />替换人物</button>
          <button type="button" role="tab" aria-selected={type === 'scene'} className={type === 'scene' ? 'is-active' : ''} onClick={() => onTypeChange('scene')}><Warehouse size={15} />替换场景</button>
        </div>

        <div className="replacement-map-heading">
          <div><span>ORIGINAL</span><strong>选择原{noun}</strong></div>
          <ArrowRight size={14} aria-hidden="true" />
          <div><span>REPLACEMENT</span><strong>上传新{noun}</strong></div>
        </div>

        <div className="replacement-map-list">
          {rows.map((row, index) => {
            const original = media.find((item) => item.id === row.originalId)
            return (
              <article className={`replacement-map-row${row.originalId && row.replacement ? ' is-ready' : ''}`} key={row.id}>
                <span className="replacement-map-row__index">{String(index + 1).padStart(2, '0')}</span>
                <div className="replacement-source-picker">
                  <div className="replacement-map-thumb">
                    {original?.imageUrl ? <img src={original.imageUrl} alt={original.label} /> : <UserRound size={20} />}
                  </div>
                  <label>
                    <span>原{noun}</span>
                    <span className="replacement-select-wrap">
                      <select value={row.originalId} onChange={(event) => onOriginalChange(row.id, event.target.value)} aria-label={`第${index + 1}行选择原${noun}`}>
                        <option value="">点击选择</option>
                        {media.map((item) => (
                          <option key={item.id} value={item.id} disabled={item.id !== row.originalId && usedOriginalIds.has(item.id)}>{item.label}</option>
                        ))}
                      </select>
                      <ChevronDown size={13} aria-hidden="true" />
                    </span>
                  </label>
                </div>

                <span className="replacement-map-arrow"><ArrowRight size={18} aria-hidden="true" /></span>

                <button type="button" className={`replacement-target-upload${row.replacement ? ' has-image' : ''}`} onClick={() => onUpload(row.id)} disabled={!row.originalId} aria-label={`第${index + 1}行上传新${noun}`}>
                  {row.replacement?.imageUrl ? <img src={row.replacement.imageUrl} alt={row.replacement.label} /> : <Upload size={20} />}
                  <span>{row.replacement ? row.replacement.label : `上传新${noun}`}</span>
                </button>

                <button type="button" className="replacement-map-remove" onClick={() => onRemoveRow(row.id)} aria-label={`${rows.length === 1 ? '清空' : '删除'}第${index + 1}行`}>
                  <Trash2 size={13} />
                </button>
              </article>
            )
          })}
        </div>

        <button type="button" className="replacement-add-row" onClick={onAddRow} disabled={rows.length >= media.length || media.length === 0}>
          <Plus size={15} />添加一组替换
        </button>

        <div className="bottom-sheet__actions replacement-sheet__actions">
          <button type="button" onClick={onClose}>取消</button>
          <button type="button" className="replacement-confirm" disabled={readyCount !== rows.length || readyCount === 0} onClick={onConfirm}>
            确认替换 {readyCount > 0 ? `${readyCount}组` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}

function WorkspaceToast({ message }: { message: string }) {
  return <div className="toast workspace-toast" role="status"><Check size={16} /><span>{message}</span></div>
}
