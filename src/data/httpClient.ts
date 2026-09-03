import { DataProviderError } from './dataProvider'

export type RuntimeParser<T> = (value: unknown) => T

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key]
  if (typeof value !== 'string') throw new Error(`字段 ${key} 必须是字符串`)
  return value
}

export function readNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key]
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`字段 ${key} 必须是有限数字`)
  }
  return value
}

export function readBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key]
  if (typeof value !== 'boolean') throw new Error(`字段 ${key} 必须是布尔值`)
  return value
}

export function readNullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key]
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') throw new Error(`字段 ${key} 必须是字符串或 null`)
  return value
}

export function readOptionalNumber(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key]
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`字段 ${key} 必须是有限数字`)
  }
  return value
}

interface RequestOptions<T> {
  baseUrl: string
  path: string
  method?: 'GET' | 'POST' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
  parser: RuntimeParser<T>
  timeoutMs?: number
}

function makeUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  return new URL(path.replace(/^\//, ''), normalizedBase).toString()
}

async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch (error) {
    throw new DataProviderError('服务端返回了无法解析的数据', {
      code: 'INVALID_JSON',
      status: response.status,
      cause: error,
    })
  }
}

function parseErrorBody(value: unknown): { code: string; message: string; requestId?: string } {
  if (!isObject(value)) return { code: 'HTTP_ERROR', message: '请求失败，请稍后重试' }
  return {
    code: typeof value.code === 'string' ? value.code : 'HTTP_ERROR',
    message: typeof value.message === 'string' ? value.message : '请求失败，请稍后重试',
    requestId: typeof value.requestId === 'string' ? value.requestId : undefined,
  }
}

export async function requestApiData<T>({
  baseUrl,
  path,
  method = 'GET',
  body,
  signal,
  parser,
  timeoutMs = 12_000,
}: RequestOptions<T>): Promise<T> {
  const controller = new AbortController()
  const onExternalAbort = () => controller.abort(signal?.reason)
  signal?.addEventListener('abort', onExternalAbort, { once: true })
  const timeout = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs)

  try {
    const response = await fetch(makeUrl(baseUrl, path), {
      method,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const responseBody = await readResponseBody(response)

    if (!response.ok) {
      const apiError = parseErrorBody(responseBody)
      throw new DataProviderError(apiError.message, {
        code: apiError.code,
        requestId: apiError.requestId,
        status: response.status,
      })
    }

    if (!isObject(responseBody) || !('data' in responseBody)) {
      throw new DataProviderError('服务端响应缺少 data 字段', { code: 'INVALID_RESPONSE' })
    }

    try {
      return parser(responseBody.data)
    } catch (error) {
      throw new DataProviderError(
        error instanceof Error ? `接口数据格式错误：${error.message}` : '接口数据格式错误',
        { code: 'INVALID_RESPONSE', cause: error },
      )
    }
  } catch (error) {
    if (error instanceof DataProviderError) throw error
    if (controller.signal.aborted) {
      if (signal?.aborted) throw new DOMException('请求已取消', 'AbortError')
      throw new DataProviderError('请求超时，请稍后重试', { code: 'REQUEST_TIMEOUT', cause: error })
    }
    throw new DataProviderError('网络连接失败，请检查后重试', {
      code: 'NETWORK_ERROR',
      cause: error,
    })
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', onExternalAbort)
  }
}

export async function requestApiVoid(
  options: Omit<RequestOptions<never>, 'parser'>,
): Promise<void> {
  const controller = new AbortController()
  const onExternalAbort = () => controller.abort(options.signal?.reason)
  options.signal?.addEventListener('abort', onExternalAbort, { once: true })
  const timeout = setTimeout(() => controller.abort(new Error('timeout')), options.timeoutMs ?? 12_000)

  try {
    const response = await fetch(makeUrl(options.baseUrl, options.path), {
      method: options.method ?? 'DELETE',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) {
      const body = await readResponseBody(response)
      const apiError = parseErrorBody(body)
      throw new DataProviderError(apiError.message, {
        code: apiError.code,
        requestId: apiError.requestId,
        status: response.status,
      })
    }
  } catch (error) {
    if (error instanceof DataProviderError) throw error
    if (controller.signal.aborted) {
      if (options.signal?.aborted) throw new DOMException('请求已取消', 'AbortError')
      throw new DataProviderError('请求超时，请稍后重试', { code: 'REQUEST_TIMEOUT', cause: error })
    }
    throw new DataProviderError('网络连接失败，请检查后重试', { code: 'NETWORK_ERROR', cause: error })
  } finally {
    clearTimeout(timeout)
    options.signal?.removeEventListener('abort', onExternalAbort)
  }
}
