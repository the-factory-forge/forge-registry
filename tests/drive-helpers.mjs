export async function openDriveFolderDialog(page) {
  await page.locator('[aria-busy="false"] table').waitFor();
  const navigation = page.getByRole("navigation", { name: "Drive navigation", exact: true });
  if (!(await navigation.isVisible()))
    await page.getByRole("button", { name: "Drive navigation", exact: true }).click();
  // The mobile drawer makes the breadcrumb inert while its menu is open.
  const heading = page
    .getByRole("navigation", { name: "Folder navigation", exact: true, includeHidden: true })
    .getByRole("heading", { includeHidden: true });
  const name = await (
    (await heading.count()) ? heading : navigation.getByRole("link", { current: "page" })
  ).innerText();
  await navigation.getByRole("button", { name: `Actions: ${name}`, exact: true }).click();
  await page.getByRole("menuitem", { name: "Add", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await page.getByRole("menuitem", { name: "Folder", exact: true }).press("Enter");
}

export async function closeDriveNavigation(page) {
  const close = page.getByRole("button", { name: "Close Drive navigation", exact: true });
  if (await close.isVisible()) {
    await close.click();
    await page
      .getByRole("dialog", { name: "Drive navigation", exact: true })
      .waitFor({ state: "hidden" });
  }
}
