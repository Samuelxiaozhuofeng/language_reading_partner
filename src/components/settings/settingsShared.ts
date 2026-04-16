import type { SettingsTab } from '../../types'

export const MODEL_SEARCH_THRESHOLD = 30
export const MODEL_PAGE_SIZE = 30

export const settingsTabLabelMap: Record<SettingsTab, string> = {
  ai: 'AI 配置',
  prompt: 'Prompt',
  anki: 'Anki',
}
