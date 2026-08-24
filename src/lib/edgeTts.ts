import { registerPlugin } from '@capacitor/core'

export interface EdgeTtsPlugin {
  synthesize(options: { text: string, voice: string }): Promise<{ audioBase64: string }>
}

class EdgeTtsWeb implements EdgeTtsPlugin {
  async synthesize(): Promise<{ audioBase64: string }> {
    throw new Error('仅安卓可用')
  }
}

export const EdgeTts = registerPlugin<EdgeTtsPlugin>('EdgeTts', {
  web: () => new EdgeTtsWeb(),
})

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64)
  const len = binaryString.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
}

export async function synthesizeEdgeTts(text: string, voice: string): Promise<Uint8Array> {
  const result = await EdgeTts.synthesize({ text, voice })
  if (!result || !result.audioBase64) {
    throw new Error('未接收到音频数据')
  }
  return base64ToUint8Array(result.audioBase64)
}
