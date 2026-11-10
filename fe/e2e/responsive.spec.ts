import { expect, test } from '@playwright/test'

test.use({ viewport: { width: 360, height: 800 } })

async function expectNoPageOverflow(page: import('@playwright/test').Page, path: string) {
  await page.goto(path)
  await expect(page.locator('main h1').first()).toBeVisible()
  const sizes = await page.evaluate(() => ({ viewport: window.innerWidth, page: document.documentElement.scrollWidth }))
  expect(sizes.page, `${path} must fit a 360px viewport`).toBeLessThanOrEqual(sizes.viewport + 1)
}

test('các trang chính dùng được ở 360px', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
  for (const path of ['/', '/explore', '/hotels', '/hotels/sea-garden', '/restaurants', '/ai/trip-planner']) {
    await expectNoPageOverflow(page, path)
  }

  await page.goto('/auth/login')
  await page.getByRole('button', { name: /Đối tác: doitac@demo.vn/ }).click()
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  for (const path of ['/partner', '/partner/rooms', '/partner/rooms/room-deluxe/inventory']) {
    await expectNoPageOverflow(page, path)
  }

  await page.goto('/auth/login')
  await page.getByRole('button', { name: /Quản trị: admin@demo.vn/ }).click()
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  for (const path of ['/admin', '/admin/partners', '/admin/reports', '/admin/settlements/SET-DEMO-001']) {
    await expectNoPageOverflow(page, path)
  }
})

test('trang chủ tận dụng chiều rộng màn hình và căn thẳng header', async ({ page }, testInfo) => {
  const mobile = testInfo.project.name === 'mobile'
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Khám phá hành trình phù hợp với bạn' })).toBeVisible()
  for (const width of mobile ? [360] : [1440, 1920, 2560]) {
    await page.setViewportSize({ width, height: mobile ? 800 : 995 })
    const geometry = await page.evaluate(() => {
      const content = document.querySelector('main .container-travel')!.getBoundingClientRect()
      const header = document.querySelector('header .container-travel')!.getBoundingClientRect()
      const search = document.querySelector('main form')!.getBoundingClientRect()
      return { viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth, left: content.left, right: content.right, width: content.width, headerLeft: header.left, headerRight: header.right, searchWidth: search.width }
    })
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewport + 1)
    expect(Math.abs(geometry.headerLeft - geometry.left)).toBeLessThan(1)
    expect(Math.abs(geometry.headerRight - geometry.right)).toBeLessThan(1)
    expect(geometry.searchWidth).toBeGreaterThan(geometry.width * 0.89)
    if (!mobile) {
      expect(geometry.left).toBeLessThanOrEqual(65)
      expect(geometry.viewport - geometry.right).toBeLessThanOrEqual(65)
      expect(geometry.width).toBeGreaterThan(geometry.viewport * 0.94)
    }
  }
  if (!mobile) await page.setViewportSize({ width: 1920, height: 995 })
  await page.screenshot({ path: `test-results/home-width-${testInfo.project.name}.png` })
})
