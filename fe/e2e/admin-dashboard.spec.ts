import { expect, test } from '@playwright/test'

test('dashboard Admin cân đối trên desktop rộng và mobile', async ({ page }, testInfo) => {
  const mobile = testInfo.project.name === 'mobile'
  await page.setViewportSize(mobile ? { width: 360, height: 800 } : { width: 1889, height: 995 })
  await page.goto('/')
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
  await page.goto('/auth/login')
  await page.getByRole('button', { name: /Quản trị: admin@demo.vn/ }).click()
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Tổng quan quản trị' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Booking theo trạng thái' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Booking gần đây' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Đối soát cần duyệt' })).toBeVisible()

  for (const width of mobile ? [360] : [1440, 1920, 2560]) {
    await page.setViewportSize({ width, height: mobile ? 800 : 995 })
    const geometry = await page.evaluate(() => {
      const aside = document.querySelector('aside')!.getBoundingClientRect()
      const main = document.querySelector('main')!.getBoundingClientRect()
      const header = document.querySelector('header > div')!.getBoundingClientRect()
      return { viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth, asideLeft: aside.left, mainRight: main.right, mainWidth: main.width, headerLeft: header.left, headerRight: header.right }
    })
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewport + 1)
    expect(Math.abs(geometry.headerLeft - geometry.asideLeft)).toBeLessThan(1)
    expect(Math.abs(geometry.headerRight - geometry.mainRight)).toBeLessThan(1)
    if (!mobile) {
      expect(geometry.asideLeft).toBeLessThanOrEqual(41)
      expect(geometry.viewport - geometry.mainRight).toBeLessThanOrEqual(41)
      expect(geometry.mainWidth).toBeGreaterThan(geometry.viewport * 0.75)
    }
  }
  if (!mobile) await page.setViewportSize({ width: 1920, height: 995 })
  await page.screenshot({ path: `test-results/admin-dashboard-${testInfo.project.name}.png`, fullPage: true })
})
