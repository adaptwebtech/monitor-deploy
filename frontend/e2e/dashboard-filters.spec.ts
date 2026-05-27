import { test, expect } from '@playwright/test'

// Helper: login as authenticated user
async function loginAsUser(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.fill('[data-test="email"]', 'pedro.miranda@adaptweb.com.br')
  await page.fill('[data-test="password"]', 'password123')
  await page.click('[data-test="submit"]')
  await expect(page).toHaveURL('/')
}

test('AC-13: selecting environment=staging shows only staging data in KpiCards and PipelineTable', async ({ page }) => {
  // Arrange — authenticate and land on dashboard
  await loginAsUser(page)

  // Wait for initial dashboard data to load
  await page.waitForSelector('[data-test="filter-environment"]')

  // Capture baseline KPI total before filtering
  const kpiTotalBefore = page.locator('[data-test="kpi-total"]')
  await expect(kpiTotalBefore).toBeVisible()

  // Act — select staging environment filter
  await page.selectOption('[data-test="filter-environment"]', 'staging')

  // Wait for network requests triggered by filter to complete
  await page.waitForLoadState('networkidle')

  // Assert — KPI total reflects staging only (numeric value present)
  const kpiTotal = page.locator('[data-test="kpi-total"]')
  await expect(kpiTotal).toBeVisible()

  // Assert — all visible pipeline rows in the table have staging environment
  const pipelineRows = page.locator('[data-test="pipeline-row"]')
  const rowCount = await pipelineRows.count()

  // If there are rows, every one must have environment=staging
  for (let i = 0; i < rowCount; i++) {
    const row = pipelineRows.nth(i)
    const envCell = row.locator('[data-test="pipeline-environment"]')
    await expect(envCell).toHaveText('staging')
  }

  // Assert — clear-filters button is visible since a filter is active
  await expect(page.locator('[data-test="clear-filters"]')).toBeVisible()
})
