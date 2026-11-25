export async function openPreviewControls(page) {
  const toggle = page.locator(
    'button[aria-controls="factory-showroom-controls"][aria-expanded="false"]',
  );
  if (await toggle.count()) await toggle.click();
}

export async function switchPreviewLanguage(page, language) {
  await openPreviewControls(page);
  await page
    .getByRole("complementary", { name: "Preview controls" })
    .getByRole("button", { name: "Language", exact: true })
    .click();
  await page.getByRole("menuitem", { name: language, exact: true }).click();
}
