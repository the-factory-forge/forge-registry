export async function openPreviewControls(page) {
  const toggle = page.locator(
    'button[aria-controls="factory-showroom-controls"][aria-expanded="false"]',
  );
  if (await toggle.count()) await toggle.click();
}

export async function switchPreviewLanguage(page, language) {
  await openPreviewControls(page);
  const controls = page.getByRole("complementary", { name: "Preview controls" });
  await controls.getByRole("link", { name: `switch language to ${language}` }).click();
}
