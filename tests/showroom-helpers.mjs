export async function openPreviewControls(page) {
  const toggle = page.locator(
    'button[aria-controls="factory-showroom-controls"][aria-expanded="false"]',
  );
  if (await toggle.count()) await toggle.click();
}
