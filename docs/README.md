# macOS Reading App 开发文档

## 文档结构

```
docs/
  00-product-spec.md       ← 产品定位、架构、Liquid Glass 规则（所有 Phase 共享参考）
  01-data-models.md        ← 完整类型/SQLite/wire format/状态机（所有 Phase 共享参考）
  02-phase0-spike.md       ← Phase 0：技术验证
  03-phase1-skeleton.md    ← Phase 1：项目骨架
  04-phase2-library.md     ← Phase 2：本地书库
  05-phase3-importers.md   ← Phase 3：导入器
  06-phase4-reader.md      ← Phase 4：阅读器 + Inspector
  07-phase5-ai.md          ← Phase 5：AI 解析 + 查词
  08-phase6-anki.md        ← Phase 6：AnkiConnect
  09-phase7-resources.md   ← Phase 7：学习资源 + 导出
  10-phase8-polish.md      ← Phase 8：打磨与测试
```

## 如何使用 Codex Goal 推进

每个 Phase 文档是给 Codex `/goal` 命令的自包含 prompt。用法：

### 标准 Goal 模板

```
/goal 完成 Phase N：[一句话目标]。
先读 docs/00-product-spec.md 了解产品定位，
再读 docs/01-data-models.md 了解数据契约，
然后按 docs/0X-phaseN-*.md 执行全部任务。
验证：[验收标准]。
停止条件：[明确的阻断条件]。
```

### 实际示例（Phase 0）

```
/goal 完成 Phase 0 技术验证 spike。
先读 docs/00-product-spec.md 了解产品定位和架构，
再读 docs/01-data-models.md 了解数据模型，
然后按 docs/02-phase0-spike.md 逐项验证四项核心技术。
产出 spike-notes.md 写入 /Users/samdagreat/Documents/vibe coding/MacReadingAssistant。
Phase 0 完成后必须先停下，由用户确认再进入 Phase 1。
停止条件：SwiftUI token 阅读流被证明明确不可行。
```

### 推进顺序

Phase 0 → 用户确认 → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7 → Phase 8

每个 Phase 有强依赖关系，必须串行。Phase 7 可与其他 Phase 轻度并行（不依赖外部服务）。

### Goal Prompt 字符限制

Codex `/goal` 有 4,000 字符限制。所有 Phase doc（02-10）都在限制内。参考文档（00、01）通过文件路径引用，不占 goal prompt 配额。

### 中断与恢复

- 如果 goal 运行中需要暂停：`/goal pause`
- 恢复：`/goal resume`
- 查看状态：`/goal`
- 清除重来：`/goal clear`
