import { DataProviderError, type DataMode, type DataProvider } from './dataProvider'
import { HttpDataProvider } from './httpDataProvider'
import { MockDataProvider } from './mockDataProvider'

function readDataMode(value: unknown): DataMode {
  return value === 'api' ? 'api' : 'mock'
}

export const dataMode = readDataMode(import.meta.env.VITE_DATA_MODE)

function createDataProvider(): DataProvider {
  if (dataMode === 'mock') return new MockDataProvider()
  const baseUrl = import.meta.env.VITE_API_BASE_URL?.trim()
  if (!baseUrl) {
    throw new DataProviderError('API 模式缺少 VITE_API_BASE_URL 配置', {
      code: 'MISSING_API_BASE_URL',
    })
  }
  return new HttpDataProvider(baseUrl)
}

export const dataProvider = createDataProvider()
