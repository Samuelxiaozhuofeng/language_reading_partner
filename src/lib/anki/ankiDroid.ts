import { registerPlugin } from '@capacitor/core'
import {
  getSraFieldNames,
  getSraNoteTypeName,
  getSraNoteTypeTemplates,
  sraStyling,
  type SraNoteTypeLanguage,
} from './constants'

export interface EnsureSraNoteTypeOptions {
  language: SraNoteTypeLanguage
  modelName: string
  fields: string[]
  front: string
  back: string
  css: string
}

export interface AddNoteOptions {
  deckName: string
  modelName: string
  fields: Record<string, string>
  tags?: string[]
}

export interface ShareNoteOptions {
  subject?: string
  text: string
}

export interface AnkiDroidPlugin {
  isAvailable(): Promise<{ available: boolean; packageName?: string }>
  requestPermission(): Promise<{ granted: boolean }>
  getDecks(): Promise<{ names: string[] }>
  getModels(): Promise<{ names: string[] }>
  getModelFields(options: { modelName: string }): Promise<{ fields: string[] }>
  ensureSraNoteType(options: EnsureSraNoteTypeOptions): Promise<{ modelName: string; created?: boolean }>
  addNote(options: AddNoteOptions): Promise<{ noteId: number }>
  shareNote(options: ShareNoteOptions): Promise<{ shared: boolean }>
}

class AnkiDroidWeb implements AnkiDroidPlugin {
  async isAvailable() {
    return { available: false, packageName: '' }
  }

  async requestPermission(): Promise<{ granted: boolean }> {
    throw new Error('AnkiDroid 仅在安卓原生应用中可用。')
  }

  async getDecks(): Promise<{ names: string[] }> {
    throw new Error('AnkiDroid 仅在安卓原生应用中可用。')
  }

  async getModels(): Promise<{ names: string[] }> {
    throw new Error('AnkiDroid 仅在安卓原生应用中可用。')
  }

  async getModelFields(): Promise<{ fields: string[] }> {
    throw new Error('AnkiDroid 仅在安卓原生应用中可用。')
  }

  async ensureSraNoteType(): Promise<{ modelName: string }> {
    throw new Error('AnkiDroid 仅在安卓原生应用中可用。')
  }

  async addNote(): Promise<{ noteId: number }> {
    throw new Error('AnkiDroid 仅在安卓原生应用中可用。')
  }

  async shareNote(): Promise<{ shared: boolean }> {
    throw new Error('AnkiDroid 仅在安卓原生应用中可用。')
  }
}

export const AnkiDroid = registerPlugin<AnkiDroidPlugin>('AnkiDroid', {
  web: () => new AnkiDroidWeb(),
})

export async function ensureAnkiDroidSraNoteType(
  language: SraNoteTypeLanguage = 'es',
) {
  const modelName = getSraNoteTypeName(language)
  const fields = getSraFieldNames(language)
  const templates = getSraNoteTypeTemplates(language)

  return AnkiDroid.ensureSraNoteType({
    language,
    modelName,
    fields,
    front: templates.front,
    back: templates.back,
    css: sraStyling,
  })
}
