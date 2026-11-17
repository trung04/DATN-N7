import { expect, test } from '@playwright/test'

const portals = [
  { role: 'Du khách', path: '/dang-nhap', email: 'khach@demo.vn', destination: '/' },
  { role: 'Đối tác', path: '/chu-khach-san/dang-nhap', email: 'doitac@demo.vn', destination: '/partner' },
  { role: 'Quản trị', path: '/admin/dang-nhap', email: 'admin@demo.vn', destination: '/admin' },
]

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
  await page.reload()
})

for (const portal of portals) {
  test(`${portal.role} đăng nhập từ đúng cổng riêng`, async ({ page }) => {
    await page.goto(portal.path)
    await expect(page.getByRole('heading', { name: `Đăng nhập ${portal.role === 'Du khách' ? 'du khách' : portal.role === 'Đối tác' ? 'chủ khách sạn' : 'quản trị viên'}` })).toBeVisible()
    await page.getByRole('button', { name: new RegExp(`${portal.role}: ${portal.email}`) }).click()
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`${portal.destination.replaceAll('/', '\\/')}$`))
  })
}

test('không nhận phiên đăng nhập khi tài khoản thuộc vai trò khác với cổng đã chọn', async ({ page }) => {
  await page.goto('/admin/dang-nhap')
  await page.getByLabel('Tên đăng nhập hoặc email').fill('khach@demo.vn')
  await page.getByLabel('Mật khẩu').fill('Demo@123')
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()

  await expect(page.getByText(/Tài khoản này thuộc nhóm du khách/)).toBeVisible()
  await expect(page).toHaveURL('/admin/dang-nhap')
  await expect(page.getByRole('heading', { name: 'Đăng nhập quản trị viên' })).toBeVisible()
})
