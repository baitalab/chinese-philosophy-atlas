"use client";

import Image from "next/image";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n";
import type { TimelinePerson, TimelineStatement, TimelineRelation } from "@/data/research-corpus";

function closeIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m6 6 12 12M18 6 6 18" /></svg>;
}

function historicityLabel(value: string, locale: Locale) {
  const map: Record<string, Record<string, string>> = {
    "zh-CN": {
      attested: "史实可考",
      traditional: "传统记载",
      "text-person": "文本人物",
      legendary: "传说人物",
    },
    en: {
      attested: "Attested",
      traditional: "Traditional",
      "text-person": "Text persona",
      legendary: "Legendary",
    },
  };
  return map[locale]?.[value] ?? value;
}

function importanceLabel(value: string, locale: Locale) {
  const map: Record<string, Record<string, string>> = {
    "zh-CN": { core: "核心人物", extended: "重要人物", context: "脉络人物" },
    en: { core: "Core", extended: "Extended", context: "Contextual" },
  };
  return map[locale]?.[value] ?? value;
}

function reviewStatusLabel(value: string, locale: Locale) {
  const map: Record<string, Record<string, string>> = {
    "zh-CN": {
      "source-reviewed": "已复核来源",
      screened: "已筛查",
      preliminary: "初步收录",
    },
    en: {
      "source-reviewed": "Source reviewed",
      screened: "Screened",
      preliminary: "Preliminary",
    },
  };
  return map[locale]?.[value] ?? value;
}

function evidenceRoleLabel(value: string, locale: Locale) {
  const map: Record<string, Record<string, string>> = {
    "zh-CN": {
      "primary-text": "原典文本",
      "scholarly-support": "学术研究支持",
      "conceptual-comparison": "概念比较",
      "editorial-context": "编辑说明",
    },
    en: {
      "primary-text": "Primary text",
      "scholarly-support": "Scholarly support",
      "conceptual-comparison": "Conceptual comparison",
      "editorial-context": "Editorial note",
    },
  };
  return map[locale]?.[value] ?? value;
}

function subtypeLabel(value: string, locale: Locale) {
  const map: Record<string, Record<string, string>> = {
    "zh-CN": {
      agreement: "赞同",
      expansion: "发展",
      similarity: "相似",
      disagreement: "分歧",
      refutation: "驳斥",
      contrast: "对照",
    },
    en: {
      agreement: "Agreement",
      expansion: "Expansion",
      similarity: "Similarity",
      disagreement: "Disagreement",
      refutation: "Refutation",
      contrast: "Contrast",
    },
  };
  return map[locale]?.[value] ?? value;
}

function directionLabel(value: string, locale: Locale) {
  const map: Record<string, Record<string, string>> = {
    "zh-CN": { undirected: "无向（概念等价）" },
    en: { undirected: "Undirected (conceptual equivalence)" },
  };
  return map[locale]?.[value] ?? value;
}

function historicalInfluenceLabel(value: string, messages: Messages) {
  const map: Record<string, string> = {
    "conceptual-only": messages["detail.conceptualOnly"],
    probable: messages["detail.probableInfluence"],
    explicit: messages["detail.explicitInfluence"],
  };
  return map[value] ?? value;
}

type DetailPanelProps = {
  locale: Locale;
  messages: Messages;
  mode: "statement" | "person" | "relation";
  statement: TimelineStatement | null;
  person: TimelinePerson | null;
  relation: TimelineRelation | null;
  relatedStatements: Array<TimelineStatement & { personName?: string; personId?: string }>;
  relatedRelations: TimelineRelation[];
  statementsById: Map<string, TimelineStatement>;
  peopleById: Map<string, TimelinePerson>;
  onClose: () => void;
  onSelectStatement: (id: string) => void;
  onSelectPerson: (id: string) => void;
};

export function DetailPanel({
  locale,
  messages,
  mode,
  statement,
  person,
  relation,
  relatedStatements,
  relatedRelations,
  statementsById,
  peopleById,
  onClose,
  onSelectStatement,
  onSelectPerson,
}: DetailPanelProps) {
  return <aside className="detail-panel" data-i18n-scope="timeline-detail">
    <button className="detail-close" onClick={onClose} aria-label={messages["detail.close"]}>{closeIcon()}</button>

    {mode === "statement" && statement && <div className="detail-content">
      <div className="detail-kicker">
        <span className={`detail-kind-badge ${statement.domains[0]?.id ?? ""}`} style={{ borderColor: statement.domains[0]?.color }}>
          <i style={{ background: statement.domains[0]?.color }} />
          {messages["detail.statement"]}
        </span>
        {statement.introductory && <span className="detail-badge intro">{messages["detail.introductory"]}</span>}
      </div>

      <h1 className="detail-statement-text">{statement.text}</h1>

      <div className="detail-meta-row">
        <button className="detail-person-link" onClick={() => person && onSelectPerson(person.id)}>
          {person && <Image className="detail-person-link-portrait" src={person.portrait.path} width={30} height={30} alt="" />}
          <strong>{person?.name}</strong>
          <span>{person?.dateLabel}</span>
        </button>
      </div>

      <section className="detail-section">
        <h2>{messages["detail.explanation"]}</h2>
        <p className="detail-explanation">{statement.explanation}</p>
      </section>

      {statement.tags.length > 0 && <section className="detail-section">
        <h2>{messages["detail.tags"]}</h2>
        <div className="chip-row">
          {statement.tags.map((tag) => <span key={tag} className="detail-tag">{tag}</span>)}
        </div>
      </section>}

      {statement.domains.length > 0 && <section className="detail-section">
        <h2>{messages["detail.domains"]}</h2>
        <div className="chip-row">
          {statement.domains.map((term) => <span key={term.id} className="detail-tag domain-tag">
            <i style={{ background: term.color }} />{term.label}
          </span>)}
        </div>
      </section>}

      {statement.sources.length > 0 && <section className="detail-section">
        <h2>{messages["detail.sources"]}</h2>
        <div className="detail-source-list">
          {statement.sources.map((source, i) => <div key={`${source.id}-${i}`} className="detail-source-item">
            <div className="detail-source-header">
              {source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a> : <span>{source.title}</span>}
              <span className="detail-source-role">{evidenceRoleLabel(source.evidenceRole, locale)}</span>
            </div>
            {source.locator && <div className="detail-source-locator">{source.locator}</div>}
            {source.citation && <div className="detail-source-citation">{source.citation}</div>}
          </div>)}
        </div>
      </section>}

      {relatedRelations.length > 0 && <section className="detail-section">
        <h2>{messages["detail.relatedStatements"]} <small>({relatedRelations.length})</small></h2>
        <div className="detail-relation-list">
          {relatedRelations.map((relation) => {
            const otherId = relation.source === statement.id ? relation.target : relation.source;
            const other = statementsById.get(otherId);
            if (!other) return null;
            return <button key={relation.id} className={`detail-relation-item ${relation.kind}`} onClick={() => onSelectStatement(otherId)}>
              <div className="detail-relation-indicator" aria-hidden="true">
                <i />
              </div>
              <div className="detail-relation-body">
                <div className="detail-relation-type">
                  <span className={`relation-pill ${relation.kind}`}>{subtypeLabel(relation.subtype, locale)}</span>
                  {relation.historicalInfluence !== "conceptual-only" && <span className="influence-pill">{historicalInfluenceLabel(relation.historicalInfluence, messages)}</span>}
                </div>
                <div className="detail-relation-text">{other.text}</div>
                <div className="detail-relation-person">{peopleById.get(other.personId)?.name ?? person?.name}</div>
              </div>
            </button>;
          })}
        </div>
      </section>}

      <div className="detail-footer">
        <span className="detail-review-status">
          {messages["detail.reviewStatus"]}: {reviewStatusLabel(statement.reviewStatus, locale)}
        </span>
        {statement.reviewer && <span className="detail-reviewer">· {statement.reviewer}</span>}
        {statement.reviewedAt && <span className="detail-reviewed-at">· {statement.reviewedAt}</span>}
      </div>
    </div>}

    {mode === "person" && person && <div className="detail-content">
      <div className="detail-kicker">
        <span className="detail-kind-badge" style={{ borderColor: person.period.color }}>
          <i style={{ background: person.period.color }} />
          {messages["detail.person"]}
        </span>
        <span className="detail-badge importance">{importanceLabel(person.importance, locale)}</span>
      </div>

      <div className="detail-person-heading">
        <Image className="detail-person-portrait" src={person.portrait.path} width={76} height={76} alt={person.name} />
        <div><h1 className="detail-person-name">{person.name}</h1><div className="detail-person-date">{person.dateLabel}</div></div>
      </div>
      {person.portrait.kind === "sourced-image" && person.portrait.sourceUrl && <a className="portrait-credit" href={person.portrait.sourceUrl} target="_blank" rel="noreferrer">{person.portrait.author || "Wikimedia Commons"} · {person.portrait.license}</a>}
      {person.portrait.kind === "generated-illustration" && <span className="portrait-credit portrait-generated-note">{locale === "zh-CN" ? "AI 生成示意像 · 非历史肖像" : "AI interpretive illustration · not a historical likeness"}</span>}

      {person.aliases.length > 0 && <div className="detail-aliases">
        <span>{messages["detail.aliases"]}:</span>
        {person.aliases.map((alias) => <span key={alias} className="detail-alias">{alias}</span>)}
      </div>}

      <div className="detail-info-grid">
        <div className="detail-info-item">
          <label>{messages["detail.period"]}</label>
          <span>{person.period.label}</span>
        </div>
        <div className="detail-info-item">
          <label>{messages["detail.historicity"]}</label>
          <span>{historicityLabel(person.historicity, locale)}</span>
        </div>
      </div>

      {person.traditions.length > 0 && <section className="detail-section">
        <h2>{messages["detail.traditions"]}</h2>
        <div className="chip-row">
          {person.traditions.map((term) => <span key={term.id} className="detail-tag tradition-tag">
            <i style={{ background: term.color }} />{term.label}
          </span>)}
        </div>
      </section>}

      {person.domains.length > 0 && <section className="detail-section">
        <h2>{messages["detail.domains"]}</h2>
        <div className="chip-row">
          {person.domains.map((term) => <span key={term.id} className="detail-tag domain-tag">
            <i style={{ background: term.color }} />{term.label}
          </span>)}
        </div>
      </section>}

      <section className="detail-section">
        <h2>{messages["detail.personStatements"]} <small>({person.statementIds.length})</small></h2>
        <div className="detail-statement-list">
          {relatedStatements.map((stmt) => <button key={stmt.id} className="detail-statement-item" onClick={() => onSelectStatement(stmt.id)}>
            <i style={{ background: stmt.domains[0]?.color }} />
            <div className="detail-statement-item-body">
              <div className="detail-statement-item-text">{stmt.text}</div>
              {stmt.tags.slice(0, 2).length > 0 && <div className="detail-statement-item-tags">{stmt.tags.slice(0, 2).join(" · ")}</div>}
            </div>
          </button>)}
        </div>
      </section>

      {person.sources.length > 0 && <section className="detail-section">
        <h2>{messages["detail.sources"]}</h2>
        <div className="detail-source-list">
          {person.sources.map((source) => <div key={source.id} className="detail-source-item small">
            <div className="detail-source-header">
              {source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a> : <span>{source.title}</span>}
            </div>
            {source.citation && <div className="detail-source-citation">{source.citation}</div>}
          </div>)}
        </div>
      </section>}

      <div className="detail-footer">
        <span className="detail-review-status">
          {messages["detail.reviewStatus"]}: {reviewStatusLabel(person.reviewStatus, locale)}
        </span>
      </div>
    </div>}

    {mode === "relation" && relation && <div className="detail-content">
      <div className="detail-kicker">
        <span className={`detail-kind-badge ${relation.kind}`} style={{ borderColor: relation.kind === "positive" ? "#58c96f" : "#e56f7c" }}>
          <i style={{ background: relation.kind === "positive" ? "#58c96f" : "#e56f7c" }} />
          {messages["detail.relation"]}
        </span>
        <span className={`relation-pill ${relation.kind}`}>{subtypeLabel(relation.subtype, locale)}</span>
      </div>

      <h1 className="detail-statement-text">{relation.note || `${subtypeLabel(relation.subtype, locale)}关系`}</h1>

      <section className="detail-section">
        <h2>{messages["detail.fromStatement"]}</h2>
        {(() => {
          const src = statementsById.get(relation.source);
          const srcPerson = src ? peopleById.get(src.personId) : null;
          if (!src) return null;
          return <button className="detail-statement-item full" onClick={() => onSelectStatement(relation.source)}>
            <i style={{ background: src.domains[0]?.color }} />
            <div className="detail-statement-item-body">
              <div className="detail-statement-item-text">{src.text}</div>
              <div className="detail-statement-item-tags">{srcPerson?.name ?? ""} · {src.tags.slice(0, 2).join(" · ")}</div>
            </div>
          </button>;
        })()}
      </section>

      <section className="detail-section">
        <h2>{messages["detail.toStatement"]}</h2>
        {(() => {
          const tgt = statementsById.get(relation.target);
          const tgtPerson = tgt ? peopleById.get(tgt.personId) : null;
          if (!tgt) return null;
          return <button className="detail-statement-item full" onClick={() => onSelectStatement(relation.target)}>
            <i style={{ background: tgt.domains[0]?.color }} />
            <div className="detail-statement-item-body">
              <div className="detail-statement-item-text">{tgt.text}</div>
              <div className="detail-statement-item-tags">{tgtPerson?.name ?? ""} · {tgt.tags.slice(0, 2).join(" · ")}</div>
            </div>
          </button>;
        })()}
      </section>

      <section className="detail-section">
        <h2>{messages["detail.relationType"]}</h2>
        <div className="detail-info-grid">
          <div className="detail-info-item">
            <label>{messages["detail.subtype"]}</label>
            <span>{subtypeLabel(relation.subtype, locale)}</span>
          </div>
          <div className="detail-info-item">
            <label>{messages["detail.basis"]}</label>
            <span>{relation.basis}</span>
          </div>
          <div className="detail-info-item">
            <label>{messages["detail.direction"]}</label>
            <span>{directionLabel(relation.direction, locale)}</span>
          </div>
          <div className="detail-info-item">
            <label>{messages["detail.historicalInfluence"]}</label>
            <span>{historicalInfluenceLabel(relation.historicalInfluence, messages)}</span>
          </div>
        </div>
      </section>

      {relation.evidenceSources.length > 0 && <section className="detail-section">
        <h2>{messages["detail.evidence"]} <small>({relation.evidenceSources.length})</small></h2>
        <div className="detail-source-list">
          {relation.evidenceSources.map((source, i) => <div key={`${source.id}-${i}`} className="detail-source-item">
            <div className="detail-source-header">
              {source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a> : <span>{source.title}</span>}
            </div>
            {source.citation && <div className="detail-source-citation">{source.citation}</div>}
          </div>)}
        </div>
      </section>}

      <div className="detail-footer">
        <span className="detail-review-status">
          {messages["detail.reviewStatus"]}: {reviewStatusLabel(relation.status, locale)}
        </span>
      </div>
    </div>}
  </aside>;
}
