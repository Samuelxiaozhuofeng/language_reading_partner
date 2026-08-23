# Android Arabic direct-read

## Product
安卓：导入后直接阅读，不再要求用户分句/批量解析。点英语或阿拉伯语单词，按所在句子调用 AI 解释。
导入语言增加阿拉伯语。阿拉伯语阅读用从右到左。

网页：保留分句/解析；也要能选阿拉伯语。

## Language
- BookLanguage = 'es' | 'ja' | 'ar'
- 标签：西班牙语 / 日本語 / 阿拉伯语
- ar 走通用分句，不走日语 kuromoji
- ar 阅读容器 dir=rtl lang=ar
- 点词继续用 tokenizeSpanishWords（已支持 \\p{L} 阿拉伯字母）

## Android flow
- 导入 EPUB 成功 → 打开第一章阅读，不去工作台
- 粘贴文章：仍要有一个粘贴页，但只贴原文、选语言、点「开始阅读」。后台自动分句入库，然后进阅读。不要出现分句/开始解析/区间
- 书架卡片主按钮一律「阅读」，点了进阅读（没有句子则先静默分句）
- 阅读正文里的词可直接点，不必先展开句子、不必先有解析结果
- 点词弹层显示 AI 解释；没有整句解析时不要强行加 Anki

## Non-goals
- 不要改分句算法本身、不要改 AnkiDroid 插件、不要跑 lint/build
- 单文件不超过 500 行；已超标的 ReadingPage.tsx(629)、epub.ts(604) 只做最小改动，新逻辑抽新文件
