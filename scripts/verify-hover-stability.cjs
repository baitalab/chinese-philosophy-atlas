/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require("playwright");

const baseUrl = (process.env.VERIFY_BASE_URL || "http://localhost:3000").replace(/\/$/, "");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });

  await page.goto(`${baseUrl}/zh-CN/`, { waitUntil: "domcontentloaded" });
  await page.locator(".filter-tool").waitFor();
  for (let attempt = 0; attempt < 8 && await page.locator(".canvas-wrap svg").getAttribute("data-render-mode") === "overview"; attempt += 1) {
    await page.locator(".zoom-tool").first().evaluate((button) => button.click());
    await page.waitForTimeout(80);
  }
  await page.waitForTimeout(500);

  const people = page.locator(".person-node");
  if (await people.count() === 0) throw new Error("No rendered person node found for hover test");
  await people.first().evaluate((element) => element.dispatchEvent(new PointerEvent("pointerover", { bubbles: true })));
  await page.waitForTimeout(80);
  const activeBeforeUnmount = await page.locator(".canvas-wrap svg").getAttribute("data-hover-active");

  for (let attempt = 0; attempt < 10 && await page.locator(".canvas-wrap svg").getAttribute("data-render-mode") !== "overview"; attempt += 1) {
    await page.locator(".zoom-tool").nth(1).evaluate((button) => button.click());
    await page.waitForTimeout(80);
  }
  const overviewHover = await page.locator(".canvas-wrap svg").getAttribute("data-hover-active");
  const overviewImageCount = await page.locator(".overview-static-image").count();

  for (let attempt = 0; attempt < 8 && await page.locator(".canvas-wrap svg").getAttribute("data-render-mode") === "overview"; attempt += 1) {
    await page.locator(".zoom-tool").first().evaluate((button) => button.click());
    await page.waitForTimeout(80);
  }
  const detailHoverAfterRemount = await page.locator(".canvas-wrap svg").getAttribute("data-hover-active");
  const visiblePeople = await page.locator(".person-node").count();
  const fadedPeople = await page.locator(".person-node.is-faded").count();
  const visibleStatements = await page.locator(".statement-node").count();
  const fadedStatements = await page.locator(".statement-node.is-faded").count();

  const result = {
    activeBeforeUnmount,
    overviewHover,
    overviewImageCount,
    detailHoverAfterRemount,
    visiblePeople,
    fadedPeople,
    visibleStatements,
    fadedStatements,
    errors,
  };
  console.log(JSON.stringify(result, null, 2));
  await browser.close();

  if (activeBeforeUnmount !== "true" || overviewHover !== "false" || overviewImageCount !== 1 || detailHoverAfterRemount !== "false" || fadedPeople !== 0 || fadedStatements !== 0 || errors.length) process.exit(1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
