# 数据与国际化规范

## 1. 核心数据表

正式数据库采用“实体与翻译分离”，避免新增语言时修改主表结构。

当前仓库的 CSV 权威源与运行时 Schema v4 对应如下：

| 表 | 用途 |
|---|---|
| `people.csv` | 人物稳定 ID、年代、状态和非语言字段；人物是体系容器，不是关系节点 |
| `people_i18n.csv` | 当前中英姓名和别名；后端数据库将迁移为每 locale 一行 |
| `statements.csv` | 哲学观点稳定 ID、人物、顺序、领域和审核状态；公开类型只能是 `position` |
| `statement_translations.csv` | 每个 locale 一行的观点文本、释义和标签 |
| `statement_sources.csv` | 观点—来源关联、原典定位和证据角色 |
| `statement_relations.csv` | 两个观点端点、正负性质、子类型、判断依据、方向与影响状态 |
| `relation_translations.csv` | 每个 locale 一行的关系解释 |
| `taxonomies.csv` | 时期、传统、领域及其双语标签 |
| `sources.csv` | 研究来源、链接与双语引文说明 |

正式后台中的每个翻译记录至少包含：`locale`、`value`、`status`、`translator_id`、`reviewer_id`、`source_locale`、`updated_at`。当前 CSV 已为观点和关系采用长表 locale 行；人物宽表是一期兼容格式，新增第三语言前必须迁移成长表。

## 2. 语言指向性

语言不能通过组件内部的硬编码判断。每段可见文字必须来自以下路径之一：

1. UI 词典键，如 `toolbar.zoomIn`。
2. 数据翻译表，如 `statement_translations`。
3. 明确标记为不翻译的专名或文献原文。

每个 UI 区域使用 `data-i18n-scope` 标记。区域与词典键的对应关系保存在 `src/i18n/scopes.json`，用于告诉维护者遗漏可能发生在哪个页面区域。

执行：

```bash
npm run i18n:check
```

检查内容：

- 所有语言是否拥有同一组键。
- 是否存在未知或多余键。
- 是否有词典键未分配给 UI 区域。
- 是否有键被错误分配给多个区域。

## 3. API 语言协议

公开 API 接受 `lang`：

```text
GET /api/v1/timeline?lang=zh-CN
GET /api/v1/timeline?lang=en
```

响应 `meta` 必须返回：请求语言、实际语言、是否使用语言回退、发生字段回退的位置、数据状态和 Schema 版本。Schema v4 中 `people` 是观点体系标题，`statements`（兼容别名 `nodes`）只包含已复核 `position`，`relations` 的端点必须是观点 ID。研究进度表不进入公开 API。禁止静默回退。

## 4. 新增语言流程

1. 在 `src/i18n/config.ts` 注册 locale。
2. 创建完整 UI 词典。
3. 为数据库建立翻译任务。
4. 运行 `npm run i18n:check`。
5. 检查每个 `data-i18n-scope` 区域。
6. 检查 API 的 `fieldFallbacks`。
7. 完成母语审核后才能标记为公开语言。

## 5. 表格驱动更新

导入工作簿建议与上述九个 CSV 一一对应。执行 `npm run data:research-queue` 更新内部人物研究队列，再执行 `npm run data:build` 校验并生成公开页面数据。研究队列不是观点表，绝不能转成页面节点。坐标、关系曲线、筛选项、人物索引和缩放细节层级全部由系统重新计算。
