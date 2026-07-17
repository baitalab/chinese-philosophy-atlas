/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS lets the bundled Playwright runtime be injected through NODE_PATH on Windows. */
const { chromium } = require("playwright");
const { mkdir } = require("node:fs/promises");
const path = require("node:path");

function strictDiagonal(points) {
  return points.slice(1).every((point, index) => {
    const dx = point.x - points[index].x;
    const dy = point.y - points[index].y;
    return dx > 0 && dy > 0 && Math.abs(dx - dy) < 0.8;
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 950 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await mkdir(path.join(process.cwd(), "artifacts"), { recursive: true });

  await page.goto("http://localhost:3000/zh-CN", { waitUntil: "networkidle" });
  const apiResponse = await page.request.get("http://localhost:3000/api/v1/timeline?lang=zh-CN");
  const api = await apiResponse.json();
  const overview = {
    people: await page.locator(".person-node").count(),
    statements: await page.locator(".statement-node").count(),
    relations: await page.locator(".statement-relation").count(),
    researchEntries: await page.locator('[data-content-type="research-index"]').count(),
    detailPanels: await page.locator(".person-detail,.statement-detail").count(),
    points: await page.locator(".person-node").evaluateAll((nodes) => nodes.map((node) => {
      const dot = node.querySelector(".person-dot").getBoundingClientRect();
      return { rank: Number(node.getAttribute("data-layout-rank")), x: dot.left + dot.width / 2, y: dot.top + dot.height / 2 };
    }).sort((a, b) => a.rank - b.rank)),
  };
  overview.strict45 = strictDiagonal(overview.points);
  const confuciusRows = await page.locator('.statement-node[data-person-id="confucius"]').evaluateAll((nodes) => nodes.map((node) => {
    const dot = node.querySelector(".statement-dot").getBoundingClientRect();
    return { order: Number(node.getAttribute("data-order")), x: dot.left + dot.width / 2, y: dot.top + dot.height / 2 };
  }).sort((a, b) => a.order - b.order));
  const statementRows45 = confuciusRows.slice(1).every((row, index) => Math.abs((row.x - confuciusRows[index].x) - (row.y - confuciusRows[index].y)) < 0.8);
  await page.screenshot({ path: path.join(process.cwd(), "artifacts", "focus-model-overview-zh.png"), fullPage: true });

  const relationsById = new Map(api.data.relations.map((relation) => [relation.id, relation]));
  const statementsById = new Map(api.data.statements.map((statement) => [statement.id, statement]));
  const confuciusIds = new Set(api.data.statements.filter((statement) => statement.personId === "confucius").map((statement) => statement.id));

  await page.locator('.person-node[data-person-id="confucius"]').evaluate((element) => element.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  await page.waitForTimeout(250);
  const personRelationIds = await page.locator(".statement-relation").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-relation-id")));
  const personFocus = {
    people: await page.locator(".person-node").count(),
    statements: await page.locator(".statement-node").count(),
    relations: personRelationIds.length,
    detailPanels: await page.locator(".person-detail,.statement-detail").count(),
    selectedPeople: await page.locator('.person-node[aria-pressed="true"]').count(),
    urlPerson: new URL(page.url()).searchParams.get("person"),
    onlyIncidentRelations: personRelationIds.every((id) => {
      const relation = relationsById.get(id);
      return relation && (confuciusIds.has(relation.source) || confuciusIds.has(relation.target));
    }),
    containsAllOwnStatements: [...confuciusIds].every((id) => page.locator(`.statement-node[data-person-id="confucius"][aria-label="${statementsById.get(id).text}"]`)),
    points: await page.locator(".person-node").evaluateAll((nodes) => nodes.map((node) => {
      const dot = node.querySelector(".person-dot").getBoundingClientRect();
      return { rank: Number(node.getAttribute("data-layout-rank")), x: dot.left + dot.width / 2, y: dot.top + dot.height / 2 };
    }).sort((a, b) => a.rank - b.rank)),
  };
  personFocus.strict45 = strictDiagonal(personFocus.points);
  await page.screenshot({ path: path.join(process.cwd(), "artifacts", "focus-model-person-confucius-zh.png"), fullPage: true });

  await page.locator('.person-node[data-person-id="confucius"]').evaluate((element) => element.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  await page.waitForTimeout(250);
  const resetAfterPerson = {
    people: await page.locator(".person-node").count(),
    statements: await page.locator(".statement-node").count(),
    relations: await page.locator(".statement-relation").count(),
  };

  const selectedStatementId = "confucius-ren-ritual";
  await page.locator(`.statement-node[aria-label="${statementsById.get(selectedStatementId).text}"]`).evaluate((element) => element.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  await page.waitForTimeout(250);
  const statementRelationIds = await page.locator(".statement-relation").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-relation-id")));
  const expectedNeighborIds = new Set([selectedStatementId]);
  for (const relation of api.data.relations) {
    if (relation.source === selectedStatementId || relation.target === selectedStatementId) {
      expectedNeighborIds.add(relation.source);
      expectedNeighborIds.add(relation.target);
    }
  }
  const visibleStatementIds = await page.locator(".statement-node").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("aria-label")));
  const expectedLabels = new Set([...expectedNeighborIds].map((id) => statementsById.get(id).text));
  const statementFocus = {
    people: await page.locator(".person-node").count(),
    statements: visibleStatementIds.length,
    relations: statementRelationIds.length,
    detailPanels: await page.locator(".person-detail,.statement-detail").count(),
    selectedStatements: await page.locator('.statement-node[aria-pressed="true"]').count(),
    urlStatement: new URL(page.url()).searchParams.get("statement"),
    onlyIncidentRelations: statementRelationIds.every((id) => {
      const relation = relationsById.get(id);
      return relation && (relation.source === selectedStatementId || relation.target === selectedStatementId);
    }),
    exactOneDegreeStatements: visibleStatementIds.length === expectedLabels.size && visibleStatementIds.every((label) => expectedLabels.has(label)),
    points: await page.locator(".person-node").evaluateAll((nodes) => nodes.map((node) => {
      const dot = node.querySelector(".person-dot").getBoundingClientRect();
      return { rank: Number(node.getAttribute("data-layout-rank")), x: dot.left + dot.width / 2, y: dot.top + dot.height / 2 };
    }).sort((a, b) => a.rank - b.rank)),
  };
  statementFocus.strict45 = strictDiagonal(statementFocus.points);
  await page.screenshot({ path: path.join(process.cwd(), "artifacts", "focus-model-statement-zh.png"), fullPage: true });

  await page.goto("http://localhost:3000/en", { waitUntil: "networkidle" });
  const english = { people: await page.locator(".person-node").count(), statements: await page.locator(".statement-node").count(), relations: await page.locator(".statement-relation").count() };

  const result = {
    overview: { ...overview, points: undefined },
    statementRows45,
    personFocus: { ...personFocus, points: undefined },
    resetAfterPerson,
    statementFocus: { ...statementFocus, points: undefined },
    english,
    api: { status: apiResponse.status(), schema: api.meta.schemaVersion, statements: api.data.statements.length, relations: api.data.relations.length, exposesResearchEntries: Object.hasOwn(api.data.coverage, "researchIndexEntries") },
    errors,
  };
  console.log(JSON.stringify(result, null, 2));
  await browser.close();

  const pass = overview.people === 155 && overview.statements === 18 && overview.relations === 14 && overview.researchEntries === 0 && overview.detailPanels === 0 && overview.strict45 && statementRows45
    && personFocus.statements === 9 && personFocus.relations === 7 && personFocus.detailPanels === 0 && personFocus.selectedPeople === 1 && personFocus.urlPerson === "confucius" && personFocus.onlyIncidentRelations && personFocus.strict45
    && resetAfterPerson.people === 155 && resetAfterPerson.statements === 18 && resetAfterPerson.relations === 14
    && statementFocus.statements === 4 && statementFocus.relations === 3 && statementFocus.detailPanels === 0 && statementFocus.selectedStatements === 1 && statementFocus.urlStatement === selectedStatementId && statementFocus.onlyIncidentRelations && statementFocus.exactOneDegreeStatements && statementFocus.strict45
    && english.people === 155 && english.statements === 18 && english.relations === 14
    && apiResponse.status() === 200 && api.meta.schemaVersion === 4 && api.data.statements.length === 18 && api.data.relations.length === 14 && !Object.hasOwn(api.data.coverage, "researchIndexEntries")
    && errors.length === 0;
  if (!pass) process.exit(1);
})().catch((error) => { console.error(error); process.exit(1); });
