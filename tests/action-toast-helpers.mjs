import assert from "node:assert/strict";

export async function actionToast(page, message) {
  const toasts = page.getByRole("dialog").filter({ hasText: message });
  const toast = toasts.last();
  await toast.waitFor();
  assert.equal(
    await toast.evaluate((element) => getComputedStyle(element.parentElement).position),
    "fixed",
  );
  assert.equal(await toast.evaluate((element) => element.closest("form, table") === null), true);
  while (await toasts.count()) {
    const element = await toast.elementHandle();
    await toast.getByRole("button", { name: "Close", exact: true }).click();
    await element.waitForElementState("hidden");
  }
}
