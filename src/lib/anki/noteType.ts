import {
  getSraNoteTypeName,
  getSraNoteTypeTemplates,
  sraFieldNames,
  sraStyling,
  type SraNoteTypeLanguage,
} from './constants'
import { ensureAnkiPermission, invokeAnkiAction } from './client'
import { toUserFacingAnkiError } from './errors'

type AnkiModelTemplates = Record<string, { Front?: string; Back?: string }>

export async function fetchAnkiModelTemplates(
  endpoint: string,
  modelName: string,
  signal?: AbortSignal,
) {
  return invokeAnkiAction<AnkiModelTemplates>(
    endpoint,
    'modelTemplates',
    { modelName },
    signal,
  )
}

export async function createOrRepairSraAnkiNoteType(
  endpoint: string,
  language: SraNoteTypeLanguage = 'es',
  signal?: AbortSignal,
) {
  try {
    await ensureAnkiPermission(endpoint, signal)

    const modelName = getSraNoteTypeName(language)
    const templates = getSraNoteTypeTemplates(language)
    const existingNoteTypes = await invokeAnkiAction<string[]>(endpoint, 'modelNames', {}, signal)
    const modelExists = existingNoteTypes.includes(modelName)

    if (!modelExists) {
      await invokeAnkiAction(endpoint, 'createModel', {
        modelName,
        inOrderFields: sraFieldNames,
        css: sraStyling,
        isCloze: false,
        cardTemplates: [
          {
            Name: 'Card 1',
            Front: templates.front,
            Back: templates.back,
          },
        ],
      }, signal)

      return {
        created: true,
        fieldNames: [...sraFieldNames],
      }
    }

    const existingFields = await invokeAnkiAction<string[]>(
      endpoint,
      'modelFieldNames',
      { modelName },
      signal,
    )

    for (const [index, fieldName] of sraFieldNames.entries()) {
      if (!existingFields.includes(fieldName)) {
        await invokeAnkiAction(endpoint, 'modelFieldAdd', {
          modelName,
          fieldName,
          index,
        }, signal)
      }
    }

    for (const [index, fieldName] of sraFieldNames.entries()) {
      await invokeAnkiAction(endpoint, 'modelFieldReposition', {
        modelName,
        fieldName,
        index,
      }, signal)
    }

    const existingTemplates = await fetchAnkiModelTemplates(endpoint, modelName, signal)
    const primaryTemplateName = Object.keys(existingTemplates)[0]

    if (primaryTemplateName) {
      await invokeAnkiAction(endpoint, 'updateModelTemplates', {
        model: {
          name: modelName,
          templates: {
            [primaryTemplateName]: {
              Front: templates.front,
              Back: templates.back,
            },
          },
        },
      }, signal)
    } else {
      await invokeAnkiAction(endpoint, 'modelTemplateAdd', {
        modelName,
        template: {
          Name: 'Card 1',
          Front: templates.front,
          Back: templates.back,
        },
      }, signal)
    }

    await invokeAnkiAction(endpoint, 'updateModelStyling', {
      model: {
        name: modelName,
        css: sraStyling,
      },
    }, signal)

    return {
      created: false,
      fieldNames: [...sraFieldNames],
    }
  } catch (error) {
    throw new Error(toUserFacingAnkiError(error))
  }
}
