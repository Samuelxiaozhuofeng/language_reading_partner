import type { AnkiFieldSource } from '../../types'

export const SRA_NOTE_TYPE_NAME = 'SRA'

export const ankiFieldSourceOrder: AnkiFieldSource[] = [
  'sentence',
  'grammar',
  'meaning',
  'knowledge',
  'knowledgeKind',
  'knowledgeExplanation',
]

export const ankiFieldSourceLabelMap: Record<AnkiFieldSource, string> = {
  sentence: '句子',
  grammar: '语法',
  meaning: '内容',
  knowledge: '知识点',
  knowledgeKind: '知识点类型',
  knowledgeExplanation: '知识点解释',
}

export const sraFieldNames = ankiFieldSourceOrder.map((source) => ankiFieldSourceLabelMap[source])

export const sraFrontTemplate = `<div class="es-card">
  <div class="es-header">
    <span class="es-badge">Spanish</span>
  </div>

  <div class="es-sentence-wrap">
    <div class="es-sentence">{{句子}}</div>
    {{#语法}}
    <div class="es-grammar-hint">  这里的「{{知识点}}」如何理解？
</div>
    {{/语法}}
  </div>
</div>`

export const sraBackTemplate = `<div class="es-card">
  <div class="es-header">
    <span class="es-badge">Spanish</span>
    {{#语法}}<span class="es-badge es-badge-grammar">Grammar</span>{{/语法}}
  </div>

  <div class="es-sentence-wrap">
    <div class="es-sentence">{{句子}}</div>
  </div>

  {{#内容}}
  <div class="es-divider"></div>

  <div class="es-content-wrap">
    <div class="es-label">Translation / 翻译</div>
    <div class="es-content">{{内容}}</div>
  </div>
  {{/内容}}

  {{#知识点}}
  <div class="es-knowledge-wrap">
    <div class="es-knowledge-box">
      <div class="es-knowledge-header">
        <span class="es-knowledge-word">{{知识点}}</span>
        {{#知识点类型}}<span class="es-knowledge-type">{{知识点类型}}</span>{{/知识点类型}}
      </div>
      {{#知识点解释}}
      <div class="es-knowledge-explanation">{{知识点解释}}</div>
      {{/知识点解释}}
    </div>
  </div>
  {{/知识点}}
</div>`

export const sraStyling = `* { box-sizing: border-box; margin: 0; padding: 0; }

.card {
  background: #f4f3f0;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 24px 16px;
  min-height: 100vh;
  font-family: -apple-system, "Helvetica Neue", "Segoe UI",
               "Noto Sans", sans-serif;
}

.nightMode .card {
  background: #1e1e1e;
}

/* 主卡片容器 */
.es-card {
  width: 100%;
  max-width: 720px;
  background: #ffffff;
  border-radius: 16px;
  border: 0.5px solid rgba(0,0,0,0.08);
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,0.02);
}

.nightMode .es-card {
  background: #2a2a2a;
  border-color: rgba(255,255,255,0.08);
}

/* 顶部类型标签 */
.es-header {
  padding: 12px 24px;
  background: #f9f8f6;
  border-bottom: 0.5px solid rgba(0,0,0,0.06);
  display: flex;
  align-items: center;
  gap: 10px;
}

.nightMode .es-header {
  background: #252525;
  border-bottom-color: rgba(255,255,255,0.06);
}

.es-badge {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  padding: 4px 12px;
  border-radius: 20px;
  background: #E8E4F3;
  color: #5B4BA4;
  text-transform: uppercase;
}

.nightMode .es-badge {
  background: #3a3266;
  color: #B8B0E3;
}

.es-badge-grammar {
  background: #E3F2FD;
  color: #1565C0;
}

.nightMode .es-badge-grammar {
  background: #1a3a5c;
  color: #90CAF9;
}

/* 句子区域 - 核心内容 */
.es-sentence-wrap {
  padding: 36px 28px 32px;
  text-align: center;
}

.es-sentence {
  font-family: "Noto Serif", Georgia, "Times New Roman", serif;
  font-size: 22px;
  line-height: 1.7;
  color: #1a1a1a;
  font-weight: 400;
}

.nightMode .es-sentence {
  color: #e8e8e8;
}

.es-sentence em,
.es-sentence i {
  color: #5B4BA4;
  font-style: italic;
}

.nightMode .es-sentence em,
.nightMode .es-sentence i {
  color: #B8B0E3;
}

.es-sentence strong,
.es-sentence b {
  color: #3a2d8a;
  font-weight: 700;
  letter-spacing: 0.01em;
}

.nightMode .es-sentence strong,
.nightMode .es-sentence b {
  color: #d4ccff;
}

/* 语法提示 */
.es-grammar-hint {
  margin-top: 16px;
  font-size: 13px;
  color: #666;
  font-style: italic;
}

.nightMode .es-grammar-hint {
  color: #999;
}

/* 分隔线 */
.es-divider {
  height: 0.5px;
  background: rgba(0,0,0,0.08);
  margin: 0 24px;
}

.nightMode .es-divider {
  background: rgba(255,255,255,0.08);
}

/* 内容翻译区域 */
.es-content-wrap {
  padding: 24px 28px;
}

.es-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: #999;
  text-transform: uppercase;
  margin-bottom: 10px;
}

.es-content {
  font-size: 17px;
  line-height: 1.8;
  color: #333;
}

.nightMode .es-content {
  color: #d0d0d0;
}

/* 知识点区域 */
.es-knowledge-wrap {
  padding: 20px 28px 28px;
  background: #fafafa;
}

.nightMode .es-knowledge-wrap {
  background: #252525;
}

.es-knowledge-box {
  background: #ffffff;
  border-radius: 12px;
  padding: 20px;
  border: 0.5px solid rgba(0,0,0,0.06);
}

.nightMode .es-knowledge-box {
  background: #2f2f2f;
  border-color: rgba(255,255,255,0.06);
}

.es-knowledge-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.es-knowledge-word {
  font-family: "Noto Serif", Georgia, serif;
  font-size: 18px;
  font-weight: 600;
  color: #5B4BA4;
}

.nightMode .es-knowledge-word {
  color: #B8B0E3;
}

.es-knowledge-type {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.05em;
  padding: 2px 8px;
  border-radius: 4px;
  background: #E8E4F3;
  color: #5B4BA4;
  text-transform: uppercase;
}

.nightMode .es-knowledge-type {
  background: #3a3266;
  color: #B8B0E3;
}

.es-knowledge-explanation {
  font-size: 15px;
  line-height: 1.7;
  color: #444;
}

.nightMode .es-knowledge-explanation {
  color: #bbb;
}

.es-knowledge-explanation strong,
.es-knowledge-explanation b {
  color: #5B4BA4;
  font-weight: 600;
}

.nightMode .es-knowledge-explanation strong,
.nightMode .es-knowledge-explanation b {
  color: #B8B0E3;
}

/* 空内容隐藏 */
.es-grammar-hint:empty,
.es-content:empty,
.es-knowledge-wrap:empty,
.es-knowledge-word:empty,
.es-knowledge-explanation:empty {
  display: none;
}

/* 移动端优化 */
@media (max-width: 480px) {
  .es-sentence {
    font-size: 19px;
  }
  .es-content {
    font-size: 16px;
  }
  .es-sentence-wrap {
    padding: 28px 20px 24px;
  }
  .es-content-wrap,
  .es-knowledge-wrap {
    padding-left: 20px;
    padding-right: 20px;
  }
}`
