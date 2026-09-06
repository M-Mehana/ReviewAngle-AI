import { expect, test } from "@playwright/test";
import { fixtures } from "../src/lib/fixtures";

test("paste and CSV both complete analysis from synthetic review input", async ({
  page,
}) => {
  const rows = fixtures("en").slice(0, 6);
  await page.goto("/");
  await page.getByLabel("Project name").fill("Paste fixture verification");
  await page
    .getByLabel("One review per paragraph")
    .fill(rows.map((r) => r.text).join("\n\n"));
  await page
    .getByRole("button", { name: "Preview reviews", exact: true })
    .click();
  await expect(page.getByText("6 ready to analyze")).toBeVisible();
  await page
    .getByRole("button", { name: "Analyze reviews", exact: true })
    .click();
  await expect(page.getByText("of 6 imported")).toBeVisible({ timeout: 90000 });
  await page.getByRole("button", { name: "New project", exact: true }).click();
  await page.getByRole("tab", { name: "Upload file" }).click();
  const csv =
    "text,rating\n" +
    rows.map((r) => `"${r.text.replaceAll('"', '""')}",${r.rating}`).join("\n");
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "synthetic.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });
  await expect(
    page.getByRole("combobox", { name: "Review text *", exact: true }),
  ).toHaveValue("text");
  await page
    .getByRole("button", { name: "Preview reviews", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Analyze reviews", exact: true })
    .click();
  await expect(page.getByText("of 6 imported")).toBeVisible({ timeout: 90000 });
  await page.getByRole("button", { name: "Ad Angles", exact: true }).click();
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  const hook = await page.locator(".hook p").first().innerText();
  await page
    .getByRole("button", { name: "Copy Hook", exact: true })
    .first()
    .click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(hook);
});
test("desktop: synthetic reviews → analysis → evidence → followups → save → export → persisted history", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator(".demo-banner")).toContainText("SYNTHETIC DEMO");
  await page.getByRole("button", { name: "Mixed", exact: true }).click();
  await expect(page.getByText("12 ready to analyze")).toBeVisible();
  await page
    .getByRole("button", { name: "Analyze reviews", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible({ timeout: 90000 });
  await expect(page.getByText("of 12 imported")).toBeVisible({ timeout: 90000 });
  await page.screenshot({
    path: "test-results/desktop-overview.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Ad Angles", exact: true }).click();
  await page
    .getByRole("button", { name: "Save angle", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Unsave angle", exact: true }),
  ).toHaveCount(1);
  await page
    .getByRole("button", { name: /supporting reviews/ })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "The evidence behind the insight" }),
  ).toBeVisible();
  await expect(dialog.locator("blockquote").first()).not.toBeEmpty();
  await expect(dialog.locator("code").first()).toContainText(/^[a-f0-9-]{36}$/);
  await page.screenshot({ path: "test-results/evidence.png", fullPage: true });
  await dialog
    .getByRole("button", { name: "Translate to output language" })
    .first()
    .click();
  await expect(page.locator(".error-banner")).toContainText(
    "translation requires",
  );
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .getByRole("button", { name: "View Angle", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Generate More Hooks" }).click();
  await expect(
    page.getByRole("heading", { name: "Additional hooks" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Generate UGC Script" }).click();
  await expect(
    page.getByRole("heading", { name: "UGC script concept", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByText("Export", { exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download JSON + evidence" }).click();
  expect((await downloadPromise).suggestedFilename()).toMatch(/\.json$/);
  await page.reload();
  await page.getByRole("button", { name: /All projects/ }).click();
  await page
    .getByRole("button", { name: /Daily Carry Bottle/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Ad Angles", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Unsave angle", exact: true }),
  ).toHaveCount(1);
  await page
    .getByRole("button", { name: "View Angle", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "UGC script concept", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("mobile Arabic: RTL import and complete localized results without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "العربية", exact: true })
    .first()
    .click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.getByRole("button", { name: "العربية", exact: true }).click();
  await page.getByLabel("لغة المحتوى التسويقي").selectOption("ar-EG");
  await page
    .getByRole("button", { name: "تحليل المراجعات", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "نظرة عامة", exact: true }),
  ).toBeVisible({ timeout: 90000 });
  await expect(
    page.getByText("المراجعات المحللة", { exact: true }),
  ).toBeVisible({ timeout: 90000 });
  await page.screenshot({
    path: "test-results/mobile-arabic-overview.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "فتح القائمة" }).click();
  await page
    .getByRole("button", { name: "الزوايا الإعلانية", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "الزوايا الإعلانية", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/mobile-arabic-angles.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "عرض الزاوية", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toContainText("يومك أسهل");
  await page.getByRole("button", { name: "إغلاق", exact: true }).click();
});
test("CSV column mapping and malformed file recovery", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Upload file" }).click();
  await page.locator("input[type=file]").setInputFiles({
    name: "bad.csv",
    mimeType: "text/csv",
    buffer: Buffer.from('text,rating\n"broken,5'),
  });
  await expect(page.locator(".error-banner")).toContainText("Invalid CSV");
  await page.locator("input[type=file]").setInputFiles({
    name: "reviews.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      'customer_words,stars\n"Keeps coffee warm, and travels well",5\n"The lid is hard to clean",3',
    ),
  });
  await page.getByRole("button", { name: "Preview reviews" }).click();
  await expect(page.locator(".error-banner")).toContainText(
    "Choose a review text column",
  );
  await page.getByLabel("Review text *").selectOption("customer_words");
  await page
    .getByRole("combobox", { name: "Rating", exact: true })
    .selectOption("stars");
  await page.getByRole("button", { name: "Preview reviews" }).click();
  await expect(page.getByText("2 ready to analyze")).toBeVisible();
  await page
    .getByRole("button", { name: "Analyze reviews", exact: true })
    .click();
  await expect(page.locator(".error-banner")).toContainText(
    "synthetic fixtures only",
  );
});
