export function toUserFacingAnkiError(error: unknown): string {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return '连接 AnkiConnect 超时，请确认 Anki 已打开后重试。'
  }

  if (error instanceof TypeError) {
    return '无法连接到 AnkiConnect。请确认 Anki 已打开、AnkiConnect 已启用，并允许当前页面来源访问 127.0.0.1:8765。'
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Anki 添加失败，请稍后重试。'
}
