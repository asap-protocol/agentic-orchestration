import { test, expect } from "@playwright/test"

const visualPins = [
  { name: "home", path: "/" },
  { name: "connectors", path: "/connectors" },
  { name: "tools", path: "/tools" },
  { name: "templates", path: "/templates" },
  { name: "builder", path: "/builder" },
] as const

for (const theme of ["light", "dark"] as const) {
  test.describe(`Design System VRT — ${theme} mode`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme })
    })

    for (const pin of visualPins) {
      test(`${pin.name} (${theme})`, async ({ page }) => {
        await page.goto(pin.path)
        await page.waitForLoadState("networkidle")
        await page.waitForTimeout(500)
        await expect(page).toHaveScreenshot(`${pin.name}-${theme}.png`, {
          fullPage: true,
          maxDiffPixelRatio: 0.01,
        })
      })
    }
  })
}
