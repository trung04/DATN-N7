import { api } from './api/client'
import { mock } from './mock/logic'

export const isMock = import.meta.env.VITE_DATA_MODE !== 'api'
export const repo = isMock ? mock : api
