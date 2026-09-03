import {
  ArrowRight,
  Check,
  Database,
  FileVideo,
  ImagePlus,
  Info,
  Link2,
  LoaderCircle,
  RefreshCw,
  ScanLine,
  SendHorizontal,
  ShieldAlert,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { dataProvider } from '../data/providerInstance'
import { getErrorMessage } from '../data/dataProvider'
import {
  clearRemakeSelection,
  readRemakeSelection,
  REMAKE_SELECTION_EVENT,
} from '../data/remakeSession'
import type {
  AnalysisStage,
  MediaReference,
  ProductReferenceImage,
  RemakeSource,
  StoryboardSegment,
  VideoAnalysisResult,
  WorkspacePhase,
  WorkspaceSource,
} from '../types'

const workspaceSessionKey = 'ai-video-workbench-workspace-session-v1'
const maximumProductImages = 5
const generationQuotaCost = 1

const analysisStages: AnalysisStage[] = [
  { id: 'frames', label: '提取视频帧', progress: 24 },
  { id: 'entities', label: '识别人物与场景', progress: 62 },
  { id: 'relations', label: '建立分镜关联', progress: 91 },
]

type ReplacementKind = 'character' | 'scene'

interface ReplacementDraft {
  type: ReplacementKind
  original: MediaReference
  replacement: MediaReference
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

export function WorkspacePage({ isActive = true }: { isActive?: boolean }) {
  const [remake, setRemake] = useState(() => readRemakeSelection())
  const [sourceUrl, setSourceUrl] = useState(() => remake?.sourceUrl ?? '')
  const [phase, setPhase] = useState<WorkspacePhase>('source')
  const [source, setSource] = useState<WorkspaceSource | null>(null)
  const [result, setResult] = useState<VideoAnalysisResult | null>(null)
  const [analysisStageIndex, setAnalysisStageIndex] = useState(0)
  const [generationProgress, setGenerationProgress] = useState(0)
  const [generationConfirmOpen, setGenerationConfirmOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [errorKind, setErrorKind] = useState<'cache' | 'analysis'>('analysis')
  const [products, setProducts] = useState<ProductReferenceImage[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const [replacementDrafts, setReplacementDrafts] = useState<ReplacementDraft[]>([])
  const videoInputRef = useRef<HTMLInputElement>(null)
  const productInputRef = useRef<HTMLInputElement>(null)
  const activeProductSlotRef = useRef(0)
  const replacementInputRef = useRef<HTMLInputElement>(null)
  const activeReplacementRef = useRef<{ type: ReplacementKind; original: MediaReference } | null>(null)
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
  useEffect(() => {
    sessionStorage.removeItem(workspaceSessionKey)
    clearRemakeSelection()
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 2600)
    return () => window.clearTimeout(timer)
  }, [toast])

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

  const resetWorkspace = useCallback(() => {
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
    setReplacementDrafts([])
    setResult(null)
    setSource(null)
    setSourceUrl('')
    setGenerationProgress(0)
    setGenerationConfirmOpen(false)
    setPhase('source')
    setErrorMessage('')
  }, [products])

  useEffect(() => {
    if (isActive || (phase !== 'generating' && phase !== 'generated')) return
    const resetTimer = window.setTimeout(resetWorkspace, 0)
    return () => window.clearTimeout(resetTimer)
  }, [isActive, phase, resetWorkspace])

  useEffect(() => {
    const handleRemakeSelection = (event: Event) => {
      const nextRemake = (event as CustomEvent<RemakeSource>).detail
      if (!nextRemake) return
      resetWorkspace()
      setRemake(nextRemake)
      setSourceUrl(nextRemake.sourceUrl)
    }
    window.addEventListener(REMAKE_SELECTION_EVENT, handleRemakeSelection)
    return () => window.removeEventListener(REMAKE_SELECTION_EVENT, handleRemakeSelection)
  }, [resetWorkspace])

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
        productSlot: activeProductSlotRef.current,
      }
    })
    setProducts((current) => [...current, ...nextProducts])
    activeProductSlotRef.current = 0
    if (accepted.length < files.length) setToast(`已应用${accepted.length}张产品图，最多上传${maximumProductImages}张`)
    else setToast(`已应用${accepted.length}张产品图`)
  }

  const removeProduct = (product: ProductReferenceImage) => {
    URL.revokeObjectURL(product.imageUrl)
    productUrlsRef.current.delete(product.imageUrl)
    setProducts((current) => current.filter((item) => item.id !== product.id))
    setToast('已移除该产品图，其余配置保持不变')
  }

  const handleReplacementUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    const target = activeReplacementRef.current
    activeReplacementRef.current = null
    if (!file || !file.type.startsWith('image/') || !target) return
    const imageUrl = URL.createObjectURL(file)
    customMediaUrlsRef.current.add(imageUrl)
    setReplacementDrafts((current) => {
      const existing = current.find((draft) =>
        draft.type === target.type && draft.original.id === target.original.id,
      )
      if (existing?.replacement.imageUrl && customMediaUrlsRef.current.has(existing.replacement.imageUrl)) {
        URL.revokeObjectURL(existing.replacement.imageUrl)
        customMediaUrlsRef.current.delete(existing.replacement.imageUrl)
      }
      const nextDraft: ReplacementDraft = {
        type: target.type,
        original: target.original,
        replacement: {
          id: `custom-${target.type}-${crypto.randomUUID()}`,
          label: file.name,
          imageUrl,
        },
      }
      return [
        ...current.filter((draft) =>
          draft.type !== target.type || draft.original.id !== target.original.id,
        ),
        nextDraft,
      ]
    })
    setToast(`已应用：${target.original.label} → ${file.name}`)
  }

  const removeReplacementDraft = (type: ReplacementKind, originalId: string) => {
    setReplacementDrafts((current) => {
      const target = current.find((draft) => draft.type === type && draft.original.id === originalId)
      if (target?.replacement.imageUrl && customMediaUrlsRef.current.has(target.replacement.imageUrl)) {
        URL.revokeObjectURL(target.replacement.imageUrl)
        customMediaUrlsRef.current.delete(target.replacement.imageUrl)
      }
      return current.filter((draft) => draft.type !== type || draft.original.id !== originalId)
    })
    setToast('已取消替换，将继续使用原视频素材')
  }

  const continueToNextStep = () => {
    setGenerationConfirmOpen(false)
    clearGenerationTimers()
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
      {phase === 'source' && <WorkspaceHeader />}

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
          onReset={resetWorkspace}
        >
          <HumanCommerceSceneTable
            products={result.products?.length ? result.products : result.product ? [result.product] : []}
            productReferences={products}
            characters={characterMedia}
            scenes={sceneMedia}
            replacements={replacementDrafts}
            onUploadProduct={(slot) => {
              activeProductSlotRef.current = slot
              productInputRef.current?.click()
            }}
            onRemoveProduct={removeProduct}
            onUploadReplacement={(type, original) => {
              activeReplacementRef.current = { type, original }
              replacementInputRef.current?.click()
            }}
            onRemoveReplacement={removeReplacementDraft}
          />
        </StoryboardResult>
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
          onNext={() => setGenerationConfirmOpen(true)}
        />
      )}

      {phase === 'result' && generationConfirmOpen && (
        <GenerationConfirmSheet
          quotaCost={generationQuotaCost}
          onCancel={() => setGenerationConfirmOpen(false)}
          onConfirm={continueToNextStep}
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

      <input
        ref={replacementInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="visually-hidden"
        onChange={handleReplacementUpload}
        aria-label="上传新人物或场景图片"
      />

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
  onReset,
  children,
}: {
  result: VideoAnalysisResult
  onReset: () => void
  children: React.ReactNode
}) {
  return (
    <div className="storyboard-result reveal">
      <div className="storyboard-result__header">
        <div>
          <span>STEP 02 / STORYBOARD</span>
          <h2>人货场分析结果</h2>
          <p>{result.segments.length} 个分镜 · {new Date(result.analyzedAt).toLocaleString('zh-CN', { hour12: false })}</p>
        </div>
      </div>
      {children}
      <button type="button" className="storyboard-reselect" onClick={onReset}><RefreshCw size={14} />重新选择原视频</button>
    </div>
  )
}

function WorkspaceActionDock({
  onNext,
}: {
  onNext: () => void
}) {
  return (
    <aside className="workspace-action-dock" aria-label="分镜操作">
      <div className="workspace-action-dock__buttons">
        <button type="button" className="storyboard-next-action" onClick={onNext}>下一步<ArrowRight size={17} /></button>
      </div>
    </aside>
  )
}

function GenerationConfirmSheet({
  quotaCost,
  onCancel,
  onConfirm,
}: {
  quotaCost: number
  onCancel: () => void
  onConfirm: () => void
}) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    confirmButtonRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  return (
    <div
      className="sheet-backdrop generation-confirm-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <section
        className="bottom-sheet generation-confirm-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="generation-confirm-title"
        aria-describedby="generation-confirm-description"
      >
        <span className="bottom-sheet__handle" aria-hidden="true" />
        <div className="generation-confirm-sheet__heading">
          <div className="generation-confirm-sheet__icon"><ShieldAlert size={19} aria-hidden="true" /></div>
          <div>
            <span>GENERATION CHECK</span>
            <h2 id="generation-confirm-title">确认生成视频？</h2>
          </div>
        </div>
        <p id="generation-confirm-description">确认后将立即创建视频生成任务，请检查当前的人物、产品与场景素材。</p>
        <div className="generation-quota-summary">
          <span>本次消耗额度</span>
          <strong>{quotaCost}<small> 次生成额度</small></strong>
        </div>
        <div className="bottom-sheet__actions generation-confirm-sheet__actions">
          <button type="button" onClick={onCancel}>返回检查</button>
          <button ref={confirmButtonRef} type="button" className="generation-confirm-action" onClick={onConfirm}>确认并生成</button>
        </div>
      </section>
    </div>
  )
}

function HumanCommerceSceneTable({
  products,
  productReferences,
  characters,
  scenes,
  replacements,
  onUploadProduct,
  onRemoveProduct,
  onUploadReplacement,
  onRemoveReplacement,
}: {
  products: MediaReference[]
  productReferences: ProductReferenceImage[]
  characters: MediaReference[]
  scenes: MediaReference[]
  replacements: ReplacementDraft[]
  onUploadProduct: (slot: number) => void
  onRemoveProduct: (product: ProductReferenceImage) => void
  onUploadReplacement: (type: ReplacementKind, original: MediaReference) => void
  onRemoveReplacement: (type: ReplacementKind, originalId: string) => void
}) {
  const findReplacement = (type: ReplacementKind, originalId: string) =>
    replacements.find((draft) => draft.type === type && draft.original.id === originalId)

  const productRows = Array.from({ length: Math.max(2, products.length) }, (_, index) => products[index])

  const renderMaterialRows = (
    type: ReplacementKind,
    noun: string,
    media: MediaReference[],
  ) => media.length > 0 ? media.map((original, index) => {
    const draft = findReplacement(type, original.id)
    return (
      <tr key={`${type}-${original.id}`}>
        <td>
          <span>{String(index + 1).padStart(2, '0')}</span>
          <div className="material-table__source">
            <div className="material-table__thumb">
              {original.imageUrl ? <img src={original.imageUrl} alt="" /> : <ImagePlus size={18} aria-hidden="true" />}
            </div>
            <strong>{original.label}</strong>
          </div>
        </td>
        <td aria-hidden="true"><ArrowRight size={14} /></td>
        <td>
          <div className="material-table__target">
            <button type="button" className={draft ? 'has-value' : ''} onClick={() => onUploadReplacement(type, original)}>
              {draft?.replacement.imageUrl
                ? <img className="material-table__thumb" src={draft.replacement.imageUrl} alt="" />
                : <span className="material-table__upload-icon"><Upload size={15} /></span>}
              <span>{draft?.replacement.label ?? `上传新${noun}`}</span>
            </button>
            {draft && (
              <button type="button" className="material-table__clear" onClick={() => onRemoveReplacement(type, original.id)} aria-label={`清除${original.label}的替换`}>
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </td>
      </tr>
    )
  }) : (
    <tr className="material-table__empty"><td colSpan={3}>未识别到{noun}</td></tr>
  )

  return (
    <section className="material-table-panel" aria-labelledby="material-table-title">
      <div className="material-table-panel__title">
        <div><span>PEOPLE · PRODUCT · PLACE</span><h3 id="material-table-title">人货场素材对照</h3></div>
        <small>左侧原素材 · 右侧新素材</small>
      </div>
      <table className="material-table">
        <thead><tr><th>原素材</th><th><span className="visually-hidden">替换为</span></th><th>新素材</th></tr></thead>
        <tbody>
          <tr className="material-table__group material-table__product-group">
            <th colSpan={3}>
              <div className="material-table__group-layout">
                <div><span>01</span>产品<small>{productRows.length} 项</small></div>
                <p className="material-upload-hint">
                  <Info size={12} aria-hidden="true" />
                  <span><strong>上传要点：</strong>每个产品尽量完整展示多角度、内外细节与包装。</span>
                </p>
              </div>
            </th>
          </tr>
          {productRows.map((product, index) => {
            const slotReferences = productReferences.filter((item) => (item.productSlot ?? 0) === index)
            return (
              <tr key={product?.id ?? `product-slot-${index}`}>
                <td>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <div className="material-table__source">
                    <div className="material-table__thumb">
                      {product?.imageUrl ? <img src={product.imageUrl} alt="" /> : <ImagePlus size={18} aria-hidden="true" />}
                    </div>
                    <strong>{product?.label ?? `待识别产品 ${String(index + 1).padStart(2, '0')}`}</strong>
                  </div>
                </td>
                <td aria-hidden="true"><ArrowRight size={14} /></td>
                <td>
                  <div className="material-table__product-target">
                    <button type="button" onClick={() => onUploadProduct(index)} disabled={productReferences.length >= maximumProductImages}>
                      <Upload size={14} />{slotReferences.length > 0 ? `继续上传 ${productReferences.length}/${maximumProductImages}` : '上传新产品'}
                    </button>
                    {slotReferences.map((item) => (
                      <span key={item.id}>
                        <img className="material-table__thumb" src={item.imageUrl} alt="" />
                        <b>{item.fileName}</b>
                        <button type="button" onClick={() => onRemoveProduct(item)} aria-label={`删除${item.fileName}`}><X size={12} /></button>
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            )
          })}
          <tr className="material-table__group material-table__character-group">
            <th colSpan={3}>
              <div className="material-table__group-layout">
                <div><span>02</span>人物<small>{characters.length} 项</small></div>
                <p className="material-upload-hint">
                  <Info size={12} aria-hidden="true" />
                  <span><strong>上传要点：</strong>人物尽量使用全身照，具备正、侧、背三视图为佳。</span>
                </p>
              </div>
            </th>
          </tr>
          {renderMaterialRows('character', '人物', characters)}
          <tr className="material-table__group"><th colSpan={3}><span>03</span>场景<small>{scenes.length} 项</small></th></tr>
          {renderMaterialRows('scene', '场景', scenes)}
        </tbody>
      </table>
    </section>
  )
}

function WorkspaceToast({ message }: { message: string }) {
  return <div className="toast workspace-toast" role="status"><Check size={16} /><span>{message}</span></div>
}
