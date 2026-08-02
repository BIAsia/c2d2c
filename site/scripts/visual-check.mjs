import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "validation");
const chromePath =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
});

await mkdir(output, { recursive: true });

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

const report = {};
const failures = [];

for (const viewport of viewports) {
  const page = await browser.newPage({
    colorScheme: "light",
    deviceScaleFactor: 1,
    viewport,
  });
  const consoleErrors = [];

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await page.goto("http://localhost:3100/", {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(1000);

  const positions = [
    { name: "top", target: "#top" },
    { name: "middle", target: "#sync" },
    { name: "bottom", target: ".site-footer" },
  ];
  const positionMetrics = {};

  for (const position of positions) {
    if (position.name === "top") {
      await page.evaluate(() => window.scrollTo(0, 0));
    } else if (position.name === "bottom") {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    } else {
      await page.locator(position.target).scrollIntoViewIfNeeded();
    }

    await page.waitForTimeout(1050);

    positionMetrics[position.name] = await page.evaluate(() => {
      const header = document.querySelector(".site-header");
      const headerRect = header.getBoundingClientRect();
      const visibleChildren = [...header.children]
        .filter((element) => getComputedStyle(element).display !== "none")
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            name: element.className || element.tagName,
            top: Number(rect.top.toFixed(2)),
            bottom: Number(rect.bottom.toFixed(2)),
            left: Number(rect.left.toFixed(2)),
            right: Number(rect.right.toFixed(2)),
          };
        });
      return {
        headerTop: Number(headerRect.top.toFixed(2)),
        headerBottom: Number(headerRect.bottom.toFixed(2)),
        headerBackground: getComputedStyle(header).backgroundColor,
        children: visibleChildren,
        horizontalOverflow:
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      };
    });

    await page.screenshot({
      path: resolve(output, `${viewport.name}-${position.name}.png`),
      fullPage: false,
    });
  }

  const anchorMetrics = {};
  for (const hash of ["#pipelines", "#evidence", "#adopt"]) {
    await page.locator(`.primary-nav a[href="${hash}"]`).click();
    await page.waitForTimeout(1800);
    anchorMetrics[hash] = await page.evaluate((selector) => {
      const section = document.querySelector(selector);
      const header = document.querySelector(".site-header");
      return {
        sectionTop: Number(section.getBoundingClientRect().top.toFixed(2)),
        headerBottom: Number(header.getBoundingClientRect().bottom.toFixed(2)),
      };
    }, hash);
  }

  const pageMetrics = await page.evaluate(() => {
    const images = [...document.images].map((image) => ({
      src: (image.currentSrc || image.src).replace(window.location.origin, ""),
      complete: image.complete,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
    }));
    const footer = document.querySelector(".site-footer");
    const footerWord = document.querySelector(".footer-word");
    const displayNodes = [
      document.querySelector(".hero-title h1"),
      document.querySelector(".footer-word"),
    ].map((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const fontSize = Number.parseFloat(style.fontSize);
      const lineHeight = Number.parseFloat(style.lineHeight);
      return {
        text: element.textContent.trim().replace(/\s+/g, " "),
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        fontSize,
        lineHeight,
        lineHeightRatio: Number((lineHeight / fontSize).toFixed(3)),
        overflow: style.overflow,
        rectBottom: Number(rect.bottom.toFixed(2)),
      };
    });
    const heroTitle = document.querySelector(".hero-title");
    const heroMeta = document.querySelector(".hero-meta");
    const heroTitleRect = heroTitle.getBoundingClientRect();
    const heroMetaRect = heroMeta.getBoundingClientRect();
    return {
      documentHeight: document.documentElement.scrollHeight,
      images,
      footerPosition: getComputedStyle(footer).position,
      footerWordOverflow: getComputedStyle(footerWord).overflow,
      displayNodes,
      heroFlow: {
        titleBottom: Number((heroTitleRect.bottom + window.scrollY).toFixed(2)),
        metaTop: Number((heroMetaRect.top + window.scrollY).toFixed(2)),
      },
    };
  });

  report[viewport.name] = {
    viewport,
    consoleErrors,
    positions: positionMetrics,
    anchors: anchorMetrics,
    page: pageMetrics,
  };

  for (const [position, metrics] of Object.entries(positionMetrics)) {
    if (metrics.headerTop !== 0) {
      failures.push(
        `${viewport.name}/${position}: fixed header top is ${metrics.headerTop}`,
      );
    }
    if (metrics.horizontalOverflow !== 0) {
      failures.push(
        `${viewport.name}/${position}: horizontal overflow is ${metrics.horizontalOverflow}px`,
      );
    }
    if (
      metrics.children.some(
        (child) => child.left < -0.5 || child.right > viewport.width + 0.5,
      )
    ) {
      failures.push(
        `${viewport.name}/${position}: a visible header item is clipped`,
      );
    }
  }

  for (const [hash, metrics] of Object.entries(anchorMetrics)) {
    if (metrics.sectionTop < metrics.headerBottom - 1) {
      failures.push(`${viewport.name}/${hash}: anchor title is header-occluded`);
    }
  }

  if (pageMetrics.images.some((image) => !image.complete || !image.naturalWidth)) {
    failures.push(`${viewport.name}: one or more images failed to load`);
  }
  if (pageMetrics.footerPosition === "fixed") {
    failures.push(`${viewport.name}: footer is fixed`);
  }
  if (pageMetrics.heroFlow.metaTop < pageMetrics.heroFlow.titleBottom) {
    failures.push(`${viewport.name}: hero meta appears above or across the hero title`);
  }
  for (const display of pageMetrics.displayNodes) {
    if (display.lineHeightRatio < 0.95 || display.lineHeightRatio > 1.1) {
      failures.push(
        `${viewport.name}: display "${display.text}" line-height ratio is ${display.lineHeightRatio}`,
      );
    }
    if (
      display.overflow !== "visible" &&
      display.scrollHeight > display.clientHeight + 1
    ) {
      failures.push(
        `${viewport.name}: display "${display.text}" is clipped (${display.clientHeight}/${display.scrollHeight})`,
      );
    }
  }
  if (consoleErrors.length > 0) {
    failures.push(
      `${viewport.name}: console errors: ${consoleErrors.join(" | ")}`,
    );
  }

  await page.close();
}

await writeFile(
  resolve(output, "visual-report.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);
await browser.close();

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    "Visual check passed: desktop and mobile top/middle/bottom screenshots captured.",
  );
}
