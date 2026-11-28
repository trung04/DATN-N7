import { expect, test } from '@playwright/test'

test('thêm lại sở thích sau khi xóa và lưu ngân sách nguyên theo đồng', async ({ page }) => {
  await page.goto('/dang-nhap')
  await page.getByLabel('Tên đăng nhập hoặc email').fill('khach@demo.vn')
  await page.getByLabel('Mật khẩu').fill('Demo@123')
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  await expect(page).not.toHaveURL(/dang-nhap/)

  await page.goto('/preferences')
  await page.getByRole('button', { name: 'Xóa toàn bộ sở thích' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Xóa toàn bộ sở thích' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.getByRole('heading', { name: 'Chưa có sở thích' })).toBeVisible()

  await page.getByRole('button', { name: 'Thêm sở thích' }).click()
  await expect(page.getByRole('form', { name: 'Thêm sở thích' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Thêm sở thích' })).toBeFocused()
  await expect(page.getByRole('group', { name: 'Loại hình yêu thích' })).toBeVisible()
  await expect(page.getByText('Đã xóa toàn bộ sở thích.')).toBeHidden()
  await page.getByText('Biển', { exact: true }).click()
  await expect(page.getByRole('checkbox', { name: 'Biển' })).toBeChecked()
  await page.getByLabel('Ngân sách tham khảo (VND)').fill('5550000')
  await page.getByRole('button', { name: 'Lưu sở thích' }).click()

  await expect(page.getByText('Đã lưu sở thích.')).toBeVisible()
  await page.reload()
  await expect(page.getByText('Biển', { exact: true })).toBeVisible()
  await expect(page.getByText(/5[.\s]550[.\s]000/)).toBeVisible()
})
