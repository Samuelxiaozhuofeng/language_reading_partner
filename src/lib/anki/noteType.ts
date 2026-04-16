import { SRA_NOTE_TYPE_NAME, sraBackTemplate, sraFieldNames, sraFrontTemplate, sraStyling } from './constants'
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
  signal?: AbortSignal,
) {
  try {
    await ensureAnkiPermission(endpoint, signal)

    const existingNoteTypes = await invokeAnkiAction<string[]>(endpoint, 'modelNames', {}, signal)
    const modelExists = existingNoteTypes.includes(SRA_NOTE_TYPE_NAME)

    if (!modelExists) {
      await invokeAnkiAction(endpoint, 'createModel', {
        modelName: SRA_NOTE_TYPE_NAME,
        inOrderFields: sraFieldNames,
        css: sraStyling,
        isCloze: false,
        cardTemplates: [
          {
            Name: 'Card 1',
            Front: sraFrontTemplate,
            Back: sraBackTemplate,
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
      { modelName: SRA_NOTE_TYPE_NAME },
      signal,
    )

    for (const [index, fieldName] of sraFieldNames.entries()) {
      if (!existingFields.includes(fieldName)) {
        await invokeAnkiAction(endpoint, 'modelFieldAdd', {
          modelName: SRA_NOTE_TYPE_NAME,
          fieldName,
          index,
        }, signal)
      }
    }

    for (const [index, fieldName] of sraFieldNames.entries()) {
      await invokeAnkiAction(endpoint, 'modelFieldReposition', {
        modelName: SRA_NOTE_TYPE_NAME,
        fieldName,
        index,
      }, signal)
    }

    const templates = await fetchAnkiModelTemplates(endpoint, SRA_NOTE_TYPE_NAME, signal)
    const primaryTemplateName = Object.keys(templates)[0]

    if (primaryTemplateName) {
      await invokeAnkiAction(endpoint, 'updateModelTemplates', {
        model: {
          name: SRA_NOTE_TYPE_NAME,
          templates: {
            [primaryTemplateName]: {
              Front: sraFrontTemplate,
              Back: sraBackTemplate,
            },
          },
        },
      }, signal)
    } else {
      await invokeAnkiAction(endpoint, 'modelTemplateAdd', {
        modelName: SRA_NOTE_TYPE_NAME,
        template: {
          Name: 'Card 1',
          Front: sraFrontTemplate,
          Back: sraBackTemplate,
        },
      }, signal)
    }

    await invokeAnkiAction(endpoint, 'updateModelStyling', {
      model: {
        name: SRA_NOTE_TYPE_NAME,
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
