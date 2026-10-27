import assert from "node:assert/strict";
import { before, after, test } from "node:test";

import { chromium } from "./showroom-browser.mjs";

const baseURL = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
let browser;
before(async () => {
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
});

async function preview(t, path = "/image-crop") {
  const page = await browser.newPage();
  page.setDefaultTimeout(10000);
  t.after(() => page.close());
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, []));
  await page.goto(baseURL + path);
  await page.locator('[data-preview-ready="true"]').waitFor();
  return page;
}

async function fixture(page) {
  const data = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = 900;
    const context = canvas.getContext("2d");
    for (const [color, x, width] of [
      ["#ff0000", 0, 400],
      ["#00ff00", 400, 800],
      ["#0000ff", 1200, 400],
    ]) {
      context.fillStyle = color;
      context.fillRect(x, 0, width, 900);
    }
    return canvas.toDataURL("image/png").split(",")[1];
  });
  return { name: "landscape.png", mimeType: "image/png", buffer: Buffer.from(data, "base64") };
}

void test("confirmation gates export, keyboard crop matches WebP pixels, cancel restores the previous image", async (t) => {
  const page = await preview(t);
  const input = page.getByLabel("Image to crop", { exact: true });
  const file = await fixture(page);
  await input.focus();
  await input.setInputFiles(file);
  const dialog = page.getByRole("dialog", { name: "Crop image" });
  const confirm = dialog.getByRole("button", { name: "Use image" });
  await confirm.waitFor();
  assert.equal(await page.getByAltText("Confirmed crop").count(), 0);
  const zoom = dialog.getByRole("slider", { name: "Zoom", exact: true });
  await zoom.focus();
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowRight");
  assert.equal(await zoom.inputValue(), "1.01");
  await zoom.fill("2");
  const bounds = await dialog.locator("canvas").boundingBox();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 40, bounds.y + bounds.height / 2);
  await page.mouse.up();
  assert.ok(
    Number(await dialog.getByRole("slider", { name: "Horizontal position" }).inputValue()) < 0.5,
  );
  await dialog.getByRole("slider", { name: "Horizontal position" }).fill("0.5");
  const previewPixels = await dialog
    .locator("canvas")
    .evaluate((canvas) => [...canvas.getContext("2d").getImageData(20, 20, 1, 1).data]);
  assert.ok(previewPixels[1] > 250 && previewPixels[0] < 5);
  await page.keyboard.press("ControlOrMeta+Enter");
  await dialog.waitFor({ state: "hidden" });
  const image = page.getByAltText("Confirmed crop");
  await image.waitFor();
  const output = await image.evaluate(async (image) => {
    await image.decode();
    const blob = await fetch(image.src).then((response) => response.blob());
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0);
    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      type: blob.type,
      signature: String.fromCharCode(...new Uint8Array(await blob.arrayBuffer()).slice(8, 12)),
      pixel: [...context.getImageData(20, 20, 1, 1).data],
    };
  });
  assert.deepEqual(
    [output.width, output.height, output.type, output.signature],
    [1200, 675, "image/webp", "WEBP"],
  );
  assert.ok(output.pixel[1] > 240 && output.pixel[0] < 15 && output.pixel[2] < 15);
  assert.match(await page.getByRole("status").last().textContent(), /landscape.webp/);
  const previous = await image.getAttribute("src");
  await input.focus();
  await input.setInputFiles(file);
  await dialog.waitFor();
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  assert.equal(await image.getAttribute("src"), previous);
  assert.equal(await input.evaluate((element) => element === document.activeElement), true);
});

void test("failed callbacks retain the crop; corrupt input and unsupported encoding never produce an image", async (t) => {
  const page = await preview(t);
  await page.setViewportSize({ width: 320, height: 900 });
  const input = page.getByLabel("Image to crop", { exact: true });
  await input.setInputFiles({
    name: "bad.png",
    mimeType: "image/png",
    buffer: Buffer.from("not an image"),
  });
  await page.getByRole("alert").waitFor();
  assert.equal(await page.getByRole("button", { name: "Use image" }).isDisabled(), true);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByLabel("Simulate action failures").check();
  await input.setInputFiles(await fixture(page));
  const heading = page.getByRole("heading", { name: "Crop image", exact: true });
  const button = page.getByRole("button", { name: "Use image" });
  const before = { heading: await heading.boundingBox(), button: await button.boundingBox() };
  await page.getByRole("button", { name: "Use image" }).click();
  await page.getByRole("alert").waitFor();
  assert.deepEqual(
    { heading: await heading.boundingBox(), button: await button.boundingBox() },
    before,
  );
  await page.screenshot({ path: "/tmp/forge-image-crop-mobile-error.png", fullPage: true });
  assert.equal(await page.getByRole("dialog", { name: "Crop image" }).count(), 1);
  assert.equal(await page.getByAltText("Confirmed crop").count(), 0);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByLabel("Simulate action failures").uncheck();
  await page.evaluate(() => {
    // oxlint-disable-next-line typescript/unbound-method -- Called with an explicit canvas receiver.
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback) {
      return original.call(this, callback, "image/png");
    };
  });
  await input.setInputFiles(await fixture(page));
  await page.getByRole("button", { name: "Use image" }).click();
  await page.getByRole("alert").waitFor();
  assert.equal(await page.getByAltText("Confirmed crop").count(), 0);
});

void test("pending export blocks duplicate confirmation and Escape; dialog fits both themes on mobile and desktop", async (t) => {
  const page = await preview(t);
  const file = await fixture(page);
  for (const [width, dark] of [
    [1440, false],
    [320, true],
  ]) {
    await page.setViewportSize({ width, height: 900 });
    const toggle = page.shell.getByRole("button", { name: "Dark mode", exact: true });
    if ((await toggle.getAttribute("aria-pressed")) !== String(dark)) await toggle.click();
    await page.getByLabel("Image to crop", { exact: true }).setInputFiles(file);
    const dialog = page.getByRole("dialog", { name: "Crop image" });
    await page.getByRole("slider", { name: "Zoom", exact: true }).fill("1.5");
    assert.equal(
      await dialog.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return (
          rect.left >= 0 &&
          rect.right <= innerWidth &&
          rect.top >= 0 &&
          rect.bottom <= innerHeight &&
          element.scrollWidth <= element.clientWidth
        );
      }),
      true,
    );
    await page.screenshot({ path: `/tmp/forge-image-crop-${width}.png`, fullPage: true });
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
  }
  await page.evaluate(() => {
    // oxlint-disable-next-line typescript/unbound-method -- Called with an explicit canvas receiver.
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (...args) {
      setTimeout(() => original.apply(this, args), 800);
    };
  });
  await page.getByLabel("Image to crop", { exact: true }).setInputFiles(file);
  await page.getByRole("button", { name: "Use image" }).click();
  assert.equal(await page.getByRole("button", { name: "Use image" }).isDisabled(), true);
  assert.equal(await page.getByRole("button", { name: "Cancel", exact: true }).isDisabled(), true);
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog", { name: "Crop image" }).count(), 1);
  await page.getByAltText("Confirmed crop").waitFor();
});

void test("Blog thumbnail and banner uploads crop by default, preserve canceled selection and retry as WebP", async (t) => {
  const page = await preview(t, "/en/admin/blogs/b1000000-0000-4000-8000-000000000001");
  const file = await fixture(page);
  assert.equal(
    await page.getByLabel("Crop new blog images (1200 × 675)", { exact: true }).isChecked(),
    true,
  );
  const field = page.getByLabel("Thumbnail", { exact: true });
  const input = page.getByLabel("Upload image — Thumbnail", { exact: true });
  const previous = await field.inputValue();
  await page.evaluate(() => {
    // oxlint-disable-next-line typescript/unbound-method -- Called with an explicit canvas receiver.
    const original = HTMLCanvasElement.prototype.toBlob;
    window.cropExports = 0;
    HTMLCanvasElement.prototype.toBlob = function (...args) {
      window.cropExports++;
      return original.apply(this, args);
    };
  });
  await input.setInputFiles(file);
  await page.getByRole("dialog", { name: "Crop image" }).waitFor();
  assert.equal(await field.inputValue(), previous);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal(await field.inputValue(), previous);
  await page.getByRole("button", { name: "Fail next upload", exact: true }).click();
  await input.setInputFiles(file);
  await page.getByRole("button", { name: "Use image" }).click();
  await page.getByRole("dialog", { name: "Crop image" }).getByRole("alert").waitFor();
  assert.equal(await field.inputValue(), previous);
  await page.getByRole("button", { name: "Use image" }).click();
  await page.getByRole("dialog", { name: "Crop image" }).waitFor({ state: "hidden" });
  assert.notEqual(await field.inputValue(), previous);
  assert.match(await field.locator("option:checked").textContent(), /landscape.webp/);
  assert.equal(await page.evaluate(() => window.cropExports), 1);
  const banner = page.getByLabel("Banner", { exact: true });
  const previousBanner = await banner.inputValue();
  await page.getByLabel("Upload image — Banner", { exact: true }).setInputFiles(file);
  await page.getByRole("dialog", { name: "Crop image" }).waitFor();
  assert.equal(await banner.inputValue(), previousBanner);
  await page.getByRole("button", { name: "Use image" }).click();
  await page.getByRole("dialog", { name: "Crop image" }).waitFor({ state: "hidden" });
  assert.notEqual(await banner.inputValue(), previousBanner);
  assert.match(await banner.locator("option:checked").textContent(), /landscape.webp/);
  assert.equal(await page.evaluate(() => window.cropExports), 2);
});
