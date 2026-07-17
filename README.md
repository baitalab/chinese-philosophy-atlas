# 中国思想图谱 / Chinese Thought Atlas

一个以中国哲学命题为节点、以历史时间为主轴、以赞同、发展、批判和反对为关系边的交互式时序知识网络。

An interactive temporal knowledge network where Chinese philosophical statements are nodes, birth year orders a proportionality-free content stream, and intellectual relations form the edges.

## 当前状态 / Current status

- 旧项目已归档至 `legacy/atlas-of-chinese-thought-2026-07-13/`。
- Schema v4 双语观点时间轴已经可用：155 位登记人物全部至少有1条观点，共167条双语观点和14条已复核观点关系。
- 人物是观点体系标题，人物下方每个点都是哲学观点；人物或观点点击只显示严格一度关系，不弹出详情框。内容按出生年排序，从左上向右下以45°等距展开。
- The legacy application is preserved under `legacy/atlas-of-chinese-thought-2026-07-13/`.
- The bilingual Schema v4 timeline now gives every one of the 155 registered people at least one position, for 167 bilingual positions and 14 reviewed position relations.
- A person is a system heading and every point beneath it is a philosophical position. Person or position selection shows a strict first-degree graph with no detail panel. The birth-ranked stream runs at 45° from upper left to lower right.

## 本地运行 / Local development

```bash
npm install
npm run dev
```

- 中文：`http://localhost:3000/zh-CN`
- English: `http://localhost:3000/en`
- API: `http://localhost:3000/api/v1/timeline?lang=zh-CN`

## 质量检查 / Quality gates

```bash
npm run i18n:check
npm run data:research-queue
npm run data:check
npm run data:benchmark
npm run lint
npm run typecheck
npm run build
```

## 文档 / Documentation

- [中文开发文档](docs/DEVELOPMENT.zh-CN.md)
- [English development specification](docs/DEVELOPMENT.en.md)
- [中文数据与国际化规范](docs/DATA-I18N.zh-CN.md)
- [English data and i18n specification](docs/DATA-I18N.en.md)
- [开发日志 / Development log](docs/DEVELOPMENT-LOG.md)
- [一期研究方法](docs/RESEARCH-METHOD.zh-CN.md)
- [Phase 1 research method](docs/RESEARCH-METHOD.en.md)
- [科研数据流水线](docs/RESEARCH-PIPELINE.zh-CN.md)
- [Research data pipeline](docs/RESEARCH-PIPELINE.en.md)
- [原项目关系模型考察](docs/REFERENCE-MODEL.zh-CN.md)
- [Reference-project relation model](docs/REFERENCE-MODEL.en.md)

## 设计声明 / Design note

项目借鉴 History of Philosophy 的全屏命题时间轴、聚焦网络和筛选逻辑，但使用独立代码、数据模型、品牌、视觉资产和中国哲学关系分类，不复制其专有源码或素材。

The product takes functional inspiration from the full-screen statement timeline, focus network, and filtering model of History of Philosophy, while using an independent implementation, data model, identity, visual assets, and Chinese-philosophy relation taxonomy.
