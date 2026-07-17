/* eslint-disable @typescript-eslint/no-require-imports -- standalone browser audit using the bundled Playwright runtime. */
const { chromium } = require("playwright");
const { mkdir } = require("node:fs/promises");
const path = require("node:path");

const URL = "https://www.denizcemonduygu.com/philo/browse/#dm=1";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 2048, height: 1100 }, deviceScaleFactor: 1 });
  await page.addInitScript(() => {
    window.__canvasTextAudit = [];
    const originalFillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function auditFillText(text, x, y, maxWidth) {
      if (window.__canvasTextAudit.length < 50000) {
        const transform = this.getTransform();
        const point = new DOMPoint(x, y).matrixTransform(transform);
        window.__canvasTextAudit.push({ text: String(text), x, y, screenX: point.x, screenY: point.y, font: this.font, fillStyle: String(this.fillStyle), a: transform.a, d: transform.d, e: transform.e, f: transform.f });
      }
      return maxWidth === undefined ? originalFillText.call(this, text, x, y) : originalFillText.call(this, text, x, y, maxWidth);
    };
  });
  const errors = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(12000);

  const toolbar = await page.locator(".toolbar-btn").evaluateAll((buttons) => buttons.map((button, index) => ({ index, text: button.textContent?.trim(), title: button.getAttribute("title"), ariaLabel: button.getAttribute("aria-label"), html: button.outerHTML.slice(0, 300) })));
  await page.locator(".toolbar-btn").first().click();
  await page.locator(".toolbar-btn").first().click();
  await page.waitForTimeout(1500);

  const structure = await page.evaluate(() => ({
    title: document.title,
    bodyTextLength: document.body.innerText.length,
    canvases: Array.from(document.querySelectorAll("canvas")).map((element) => ({ width: element.width, height: element.height, className: element.className })),
    svgs: Array.from(document.querySelectorAll("svg")).map((element) => ({ width: element.getAttribute("width"), height: element.getAttribute("height"), className: element.getAttribute("class"), descendants: element.querySelectorAll("*").length })),
    topClasses: Array.from(document.querySelectorAll("[class]")).reduce((counts, element) => {
      for (const name of String(element.className).split(/\s+/).filter(Boolean)) counts[name] = (counts[name] || 0) + 1;
      return counts;
    }, {}),
  }));

  const knownPeople = await page.evaluate(() => {
    const names = ["SIMONE DE BEAUVOIR", "MAURICE MERLEAU-PONTY", "JACQUES LACAN", "THEODOR ADORNO", "GEORGES BATAILLE"];
    return names.map((name) => {
      const candidates = Array.from(document.querySelectorAll("body *")).filter((element) => element.children.length === 0 && element.textContent?.trim() === name);
      return candidates.map((element) => {
        const rect = element.getBoundingClientRect();
        return { name, tag: element.tagName, className: element.getAttribute("class"), x: rect.x, y: rect.y, width: rect.width, height: rect.height, transform: getComputedStyle(element).transform };
      });
    }).flat();
  });

  const layoutAudit = await page.evaluate(() => {
    const rows = window.__canvasTextAudit || [];
    const headings = rows.filter((row) => /FranklinGothic-Heavy/i.test(row.font) && row.text.length > 1 && row.text.length < 60);
    const scales = new Map();
    for (const row of headings) {
      const key = `${row.a.toFixed(6)}|${row.d.toFixed(6)}`;
      const group = scales.get(key) || { scale: row.a, rows: new Map() };
      group.rows.set(`${row.text}|${row.x.toFixed(2)}|${row.y.toFixed(2)}`, row);
      scales.set(key, group);
    }
    const selected = Array.from(scales.values()).filter((group) => group.rows.size > 20).sort((a, b) => b.scale - a.scale)[0];
    if (!selected) return { error: "No heading scale captured", capturedRows: rows.length };
    const people = Array.from(selected.rows.values()).sort((a, b) => a.screenX - b.screenX || a.screenY - b.screenY);
    const gaps = people.slice(0, -1).map((person, index) => people[index + 1].screenX - person.screenX).filter((gap) => gap > 0);
    let best = { base: 0, statementSlot: 0, rmse: Number.POSITIVE_INFINITY };
    for (let base = 8; base <= 16; base += 0.025) for (let statementSlot = 3; statementSlot <= 5; statementSlot += 0.025) {
      const squaredError = gaps.reduce((sum, gap) => {
        const count = Math.max(0, Math.round((gap - base) / statementSlot));
        return sum + (gap - (base + count * statementSlot)) ** 2;
      }, 0);
      const rmse = Math.sqrt(squaredError / gaps.length);
      if (rmse < best.rmse) best = { base, statementSlot, rmse };
    }
    return {
      capturedRows: rows.length,
      headingCount: people.length,
      canvasScale: selected.scale,
      screenSlotFit: {
        base: best.base,
        statementSlot: best.statementSlot,
        rmse: best.rmse,
      },
      worldSlotFit: {
        base: best.base / selected.scale,
        statementSlot: best.statementSlot / selected.scale,
        rmse: best.rmse / selected.scale,
      },
      diagonalMaxDeviation: Math.max(...people.map((person) => Math.abs((person.screenX - people[0].screenX) - (person.screenY - people[0].screenY)))),
      samples: people.slice(0, 12).map((person, index) => ({
        text: person.text,
        screen: { x: person.screenX, y: person.screenY },
        nextGap: gaps[index] ?? null,
      })),
    };
  });

  await mkdir(path.join(process.cwd(), "artifacts"), { recursive: true });
  await page.screenshot({ path: path.join(process.cwd(), "artifacts", "reference-layout-audit.png"), fullPage: true });
  console.log(JSON.stringify({ url: page.url(), structure, toolbar, knownPeople, layoutAudit, errors }, null, 2));
  await browser.close();
})().catch((error) => { console.error(error); process.exit(1); });
