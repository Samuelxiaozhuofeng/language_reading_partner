# Phase 8 — 打磨与测试

> **Codex Goal**：`完成 Phase 8：键盘可达性、暗色模式、性能优化、打包签名、app icon，参考 docs/00-product-spec.md §Liquid Glass 实现原则 和§Done Criteria`
> **依赖**：`docs/00-product-spec.md`
> **前置**：Phase 7 完成

## 目标

全链路打磨，确保 App 达到第一版交付标准。

## 任务清单

### 1. 键盘可达性
- 所有菜单项可快捷键触发。
- Tab 键在 toolbar 和 inspector 中正确导航。
- 阅读器中 Arrow/PageUp/PageDown 流畅。
- VoiceOver 覆盖：toolbar button、章节行动作、词汇 token button、inspector 区域。

### 2. 暗色模式
- 所有视图在浅色/深色模式切换后正确显示。
- 无硬编码 `Color.white`、`Color.black` 或固定背景色。
- Liquid Glass sidebar、toolbar、inspector 在深色模式下材料自然。
- 阅读正文区域在深色模式下背景深但文字清晰。
- 高对比度模式下所有信息可见。

### 3. Liquid Glass 审查
- 逐个检查 sidebar、toolbar、inspector、Settings——没有人工 blur、半透明白底、自定义背景。
- 如果有 `glassEffect` 自定义控件，检查是否放在 `GlassEffectContainer` 中。
- icon tint 只在语义状态使用，没有纯装饰性色彩。
- 阅读正文区域不使用玻璃材质。

### 4. 大章节性能
- 测试 5000 句章节的加载时间（快照 decode + 视图渲染）。
- 测试 token button 在 10000 字章节上的交互延迟。
- 测试整章解析时 UI 不卡顿。
- 测试 ScrollView 长列表内存占用。

### 5. 多窗口状态
- 打开两个 `WindowGroup` 窗口，数据不冲突。
- 不同窗口可看不同书籍/章节。
- inspector 状态绑定到各自窗口。

### 6. 错误信息统一
- 所有 `AppError` 类型都有对应的中文用户消息。
- 导入失败、解析失败、Anki 失败有 inline banner 展示。
- API key 缺失时引导用户去 Settings。
- `Logs/` 目录只记录时间、错误类别、短消息、ID——不含完整 prompt、API key、原文章节。

### 7. 无障碍审查
- 所有 toolbar button 有 `.accessibilityLabel`。
- token button 有 accessibility label（至少显示词汇文本）。
- 阅读器字号变化不破坏 VoiceOver 顺序。
- 减少透明度设置下 glassEffect 控件降级合理。

### 8. 打包签名
- App Sandbox 配置（如启用）：outgoing network client entitlement。
- 确保 AnkiConnect `127.0.0.1:8765` 请求在 sandbox 下正常。
- 签名配置：Development 和 Release 都可 build。

### 9. App Icon
- 使用 Icon Composer 路线制作 Liquid Glass 分层图标。
- 第一版最小可交付方案：简洁占位图标（非低清位图）。

## 验收

- [ ] App 可持续阅读一小时无明显卡顿。
- [ ] 大章节（5000+ 句）切换流畅。
- [ ] 重启恢复上次阅读位置。
- [ ] Anki 失败重试稳定。
- [ ] 暗色模式切换无视觉异常。
- [ ] macOS 26 下 sidebar、toolbar、inspector、Settings 没有自定义背景与系统材料冲突。
- [ ] 键盘完整可达。
- [ ] 所有 Done Criteria（`00-product-spec.md` §第一版 Done Criteria）通过。

## 停止条件

- 大章节性能不达标（加载 >2s 或翻页 >300ms）时停止优化。
- 暗色模式出现文字不可见或布局严重错位时停止修复。
