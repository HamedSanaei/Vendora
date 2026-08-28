// Visual-fidelity measurement harness.
// Usage: node scripts/vf/measure.mjs <url> <width> <height> <outJson> [outPng]
// Dumps every visible element's geometry + key computed styles to JSON,
// and saves a PNG screenshot at the exact requested viewport.
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const [url, widthArg, heightArg, outJson, outPng, clickButtonName, secondClickButtonName] = process.argv.slice(2);
const width = Number(widthArg);
const height = Number(heightArg);

if (!url || !width || !height || !outJson) {
  console.error("usage: node measure.mjs <url> <w> <h> <out.json> [out.png]");
  process.exit(1);
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({
  viewport: { width, height },
  deviceScaleFactor: 1,
});
const consoleErrors = [];
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => consoleErrors.push(error.message));
await page.goto(url, { waitUntil: "networkidle", timeout: 90_000 });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(400);
if (clickButtonName) {
  await page.getByRole("button", { name: clickButtonName }).first().click();
  await page.waitForTimeout(250);
}
if (secondClickButtonName) {
  await page.getByRole("button", { name: secondClickButtonName }).first().click();
  await page.waitForTimeout(250);
}

const data = await page.evaluate(() => {
  const px = (v) => (v && v.endsWith("px") ? Number.parseFloat(v) : null);
  const els = document.querySelectorAll("body *");
  const out = [];
  let i = 0;
  for (const el of els) {
    i++;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    const ownText = Array.from(el.childNodes)
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join(" ")
      .slice(0, 60);
    out.push({
      i,
      tag: el.tagName.toLowerCase(),
      cls: (el.getAttribute("class") || "").slice(0, 160),
      txt: ownText,
      x: Math.round(r.x * 10) / 10,
      y: Math.round(r.y * 10) / 10,
      w: Math.round(r.width * 10) / 10,
      h: Math.round(r.height * 10) / 10,
      fs: cs.fontSize,
      fw: cs.fontWeight,
      lh: cs.lineHeight === "normal" ? "normal" : px(cs.lineHeight),
      ff: cs.fontFamily.split(",")[0].replace(/"/g, ""),
      color: cs.color,
      bg: cs.backgroundColor,
      bc: cs.borderTopColor,
      bw: cs.borderTopWidth,
      br: cs.borderRadius,
      bs: cs.boxShadow === "none" ? "" : cs.boxShadow.slice(0, 80),
      gap: cs.gap,
      pad: cs.padding,
      ovfX: cs.overflowX,
    });
  }
  return {
    viewport: { w: innerWidth, h: innerHeight },
    docW: document.documentElement.scrollWidth,
    lang: document.documentElement.lang,
    dir: document.documentElement.dir,
    bodyFont: getComputedStyle(document.body).fontFamily,
    els: out,
  };
});
data.consoleErrors = consoleErrors;

mkdirSync(dirname(outJson), { recursive: true });
writeFileSync(outJson, JSON.stringify(data, null, 1));
if (outPng) {
  mkdirSync(dirname(outPng), { recursive: true });
  await page.screenshot({ path: outPng, fullPage: true });
}
await browser.close();
console.log(
  `measured ${data.els.length} els | docW=${data.docW} lang=${data.lang} dir=${data.dir} bodyFont=${data.bodyFont.slice(0, 40)}`,
);
