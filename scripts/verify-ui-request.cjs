/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require("playwright");
const { mkdir } = require("node:fs/promises");
const path = require("node:path");

function overlaps(a, b) {
  return a && b && a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
  const errors = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await mkdir(path.join(process.cwd(), "artifacts"), { recursive: true });

  await page.goto("http://localhost:3000/zh-CN", { waitUntil: "domcontentloaded" });
  await page.locator(".filter-tool").waitFor();
  await page.waitForTimeout(300);
  const initialMode = await page.locator(".canvas-wrap svg").getAttribute("data-render-mode");
  // A larger corpus can make the initial fit land in the static overview LOD.
  // Zoom into the first readable detail bucket before checking labels/arcs.
  for (let attempt = 0; attempt < 6 && await page.locator(".canvas-wrap svg").getAttribute("data-render-mode") === "overview"; attempt += 1) {
    await page.locator('.zoom-tool').first().click();
    await page.waitForTimeout(220);
  }
  const filterBox = await page.locator(".filter-panel").boundingBox();
  const railBox = await page.locator(".tool-rail").boundingBox();
  const fitted = {
    initialMode,
    mode: await page.locator(".canvas-wrap svg").getAttribute("data-render-mode"),
    zoom: Number(await page.locator(".canvas-wrap svg").getAttribute("data-zoom")),
    textNodeCount: await page.locator(".timeline-viewport text").count(),
    labelFieldCount: await page.locator(".overview-label-field").count(),
    personCopyTransform: await page.locator(".person-label").first().getAttribute("transform"),
    statementCopyTransform: await page.locator(".statement-copy").first().getAttribute("transform"),
  };
  const relationSides = await page.locator(".statement-relation").evaluateAll((paths) => paths.reduce((result, path) => {
    const kind = path.getAttribute("data-relation-kind");
    const arcs = (path.getAttribute("d") ?? "").matchAll(/M\s+([\d.-]+)\s+([\d.-]+)\s+A\s+([\d.]+)\s+([\d.]+)\s+0\s+0\s+([01])\s+([\d.-]+)\s+([\d.-]+)/g);
    for (const arc of arcs) {
      const flowDirection = Number(arc[6]) - Number(arc[1]) + Number(arc[7]) - Number(arc[2]) >= 0 ? 1 : -1;
      const side = kind === "positive" ? 1 : -1;
      const expectedSweep = side * flowDirection > 0 ? 0 : 1;
      if (Number(arc[5]) === expectedSweep) {
        if (kind === "positive") result.positiveLeft += 1;
        else result.negativeRight += 1;
      } else result.wrongSide += 1;
    }
    return result;
  }, { positiveLeft: 0, negativeRight: 0, wrongSide: 0 }));
  const relationGeometry = await page.locator(".statement-relation").evaluateAll((paths) => paths.reduce((result, path) => {
    const arcs = (path.getAttribute("d") ?? "").matchAll(/M\s+([\d.-]+)\s+([\d.-]+)\s+A\s+([\d.]+)\s+([\d.]+)\s+0\s+0\s+[01]\s+([\d.-]+)\s+([\d.-]+)/g);
    for (const arc of arcs) {
      const chord = Math.hypot(Number(arc[5]) - Number(arc[1]), Number(arc[6]) - Number(arc[2]));
      const ratio = chord > 0 ? Number(arc[3]) / chord : 0;
      if (Math.abs(Number(arc[3]) - Number(arc[4])) < 0.02 && ratio >= 0.499 && ratio <= 0.526) result.circularArcs += 1;
      else result.invalid += 1;
      result.total += 1;
    }
    return result;
  }, { total: 0, circularArcs: 0, invalid: 0 }));
  await page.screenshot({ path: path.join(process.cwd(), "artifacts", "ui-request-fitted-text.png") });
  for (let attempt = 0; attempt < 24; attempt += 1) await page.locator(".zoom-tool").nth(1).click();
  const overview = {
    mode: await page.locator(".canvas-wrap svg").getAttribute("data-render-mode"),
    minimumZoom: Number(await page.locator(".canvas-wrap svg").getAttribute("data-zoom")),
    staticImageCount: await page.locator('[data-overview-static="true"]').count(),
    textNodeCount: await page.locator(".timeline-viewport text").count(),
    renderedSvgElements: await page.locator(".timeline-viewport *").count(),
  };
  await page.screenshot({ path: path.join(process.cwd(), "artifacts", "ui-request-overview.png") });
  await page.locator(".fit-tool").click();
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const currentZoom = Number(await page.locator(".canvas-wrap svg").getAttribute("data-zoom"));
    if (await page.locator(".canvas-wrap svg").getAttribute("data-render-mode") === "detail" && currentZoom >= 0.35) break;
    await page.locator(".zoom-tool").first().click();
    await page.waitForTimeout(20);
  }
  if (await page.locator(".canvas-wrap svg").getAttribute("data-render-mode") !== "detail") throw new Error("Could not enter detail render mode");
  const personLabelAlignment = await page.locator(".person-node").evaluateAll((nodes) => {
    const offsets = nodes.map((node) => {
      const dot = node.querySelector(".person-dot").getBoundingClientRect();
      const label = node.querySelector(".person-name").getBoundingClientRect();
      return Math.abs((dot.top + dot.height / 2) - (label.top + label.height / 2));
    });
    return {
      maximumCenterOffset: Math.max(...offsets),
      averageCenterOffset: offsets.reduce((sum, offset) => sum + offset, 0) / offsets.length,
    };
  });
  const dotCategories = await page.locator(".statement-dot").evaluateAll((dots) => dots.reduce((counts, dot) => {
    const count = dot.getAttribute("data-category-count");
    counts[count] = (counts[count] ?? 0) + 1;
    return counts;
  }, {}));
  const renderedRelation = page.locator(".statement-relation").first();
  const linePattern = await renderedRelation.count() ? await renderedRelation.evaluate((path) => getComputedStyle(path).strokeDasharray) : "none";
  await page.locator(".relation-chip.positive").click();
  const relationsWithPositiveOff = await page.locator(".relation-chip.positive").getAttribute("aria-pressed");
  await page.locator(".relation-chip.positive").click();
  await page.locator(".relation-chip.negative").click();
  const relationsWithNegativeOff = await page.locator(".relation-chip.negative").getAttribute("aria-pressed");
  await page.locator(".relation-chip.negative").click();
  const hoverCandidate = await page.locator(".person-node").evaluateAll((nodes) => {
    const candidate = nodes.find((node) => {
      const box = node.querySelector(".person-dot").getBoundingClientRect();
      return box.x > 470 && box.x < 1150 && box.y > 120 && box.y < 800;
    });
    if (!candidate) return null;
    const box = candidate.querySelector(".person-dot").getBoundingClientRect();
    return { id: candidate.getAttribute("data-person-id"), x: box.x + box.width / 2, y: box.y + box.height / 2 };
  });
  if (!hoverCandidate) throw new Error("No unobscured person node found for hover verification");
  const hoverPersonId = hoverCandidate.id;
  const ownStatementCount = await page.locator(`.statement-node[data-person-id="${hoverPersonId}"]`).count();
  await page.mouse.move(hoverCandidate.x, hoverCandidate.y);
  await page.waitForTimeout(100);
  const personHover = {
    fadedPeople: await page.locator(".person-node.is-faded").count(),
    fadedStatements: await page.locator(".statement-node.is-faded").count(),
    ownStatementCount,
  };

  const statement = page.locator(`.statement-node[data-person-id="${hoverPersonId}"]`).first();
  const statementDot = await statement.locator(".statement-dot").evaluate((dot) => {
    const box = dot.getBoundingClientRect();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  });
  await page.mouse.move(statementDot.x, statementDot.y);
  await page.waitForTimeout(100);
  const statementHover = {
    fadedPeople: await page.locator(".person-node.is-faded").count(),
    fadedStatements: await page.locator(".statement-node.is-faded").count(),
  };
  await statement.dispatchEvent("click");
  await page.waitForTimeout(900);
  await statement.focus();
  const selectedOutline = await statement.evaluate((node) => {
    const style = getComputedStyle(node);
    return { style: style.outlineStyle, width: style.outlineWidth, color: style.outlineColor };
  });
  const focusedDot = await page.locator('.statement-node[aria-pressed="true"] .statement-dot').boundingBox();
  const focusedCenter = focusedDot ? { x: focusedDot.x + focusedDot.width / 2, y: focusedDot.y + focusedDot.height / 2 } : null;
  const desktop = {
    fitted,
    overview,
    statusRemoved: await page.locator(".canvas-status").count() === 0,
    filterDoesNotOverlapTools: !overlaps(filterBox, railBox),
    relationSides,
    relationGeometry,
    personLabelAlignment,
    dotCategories,
    linePattern,
    relationsAreSolid: linePattern === "none",
    loadedPortraits: await page.locator(".person-portrait").count(),
    relationsWithPositiveOff,
    relationsWithNegativeOff,
    traditionsRemoved: !(await page.locator(".filter-panel").innerText()).includes("主要传统"),
    selectedOutline,
    personHover,
    statementHover,
    focusedCenter,
    viewportCenter: { x: 800, y: 475 },
    returnVisible: await page.locator(".clear-focus-btn").count() > 0,
  };
  await page.screenshot({ path: path.join(process.cwd(), "artifacts", "ui-request-desktop.png") });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://localhost:3000/zh-CN", { waitUntil: "domcontentloaded" });
  await page.locator(".filter-tool").waitFor();
  await page.waitForTimeout(700);
  const mobileClosedInitially = await page.locator(".filter-panel").count() === 0;
  await page.locator(".filter-tool").click();
  await page.locator(".filter-panel").waitFor({ state: "attached" });
  await page.waitForTimeout(400);
  const mobilePanel = await page.locator(".filter-panel").boundingBox();
  const mobile = {
    closedInitially: mobileClosedInitially,
    opensFromBottom: Boolean(mobilePanel && Math.abs(mobilePanel.y + mobilePanel.height - 844) < 2),
    sections: await page.locator(".filter-panel h2").count(),
    closeButton: await page.locator(".filter-close").count(),
  };
  await page.screenshot({ path: path.join(process.cwd(), "artifacts", "ui-request-mobile-filter.png") });
  await page.locator(".filter-close").click();
  await page.goto("http://localhost:3000/zh-CN?person=confucius", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  mobile.returnVisible = await page.locator(".clear-person-focus").isVisible();
  const mobileFocusedDot = await page.locator('.person-node[aria-pressed="true"] .person-dot').boundingBox();
  mobile.focusedCenter = mobileFocusedDot ? { x: mobileFocusedDot.x + mobileFocusedDot.width / 2, y: mobileFocusedDot.y + mobileFocusedDot.height / 2 } : null;
  mobile.viewportCenter = { x: 195, y: 422 };
  await page.screenshot({ path: path.join(process.cwd(), "artifacts", "ui-request-mobile.png") });

  console.log(JSON.stringify({ desktop, mobile, errors }, null, 2));
  await browser.close();
  if (errors.length) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });
