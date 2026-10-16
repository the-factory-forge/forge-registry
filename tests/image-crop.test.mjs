import assert from "node:assert/strict";
import test from "node:test";

import { imageCropRect, validImageCropSize } from "../registry/components/utils/crop-image.ts";

void test("crop geometry covers the target at a fixed ratio and clamps travel", () => {
  assert.deepEqual(imageCropRect({ width: 1600, height: 900 }, { width: 400, height: 400 }), {
    x: 350,
    y: 0,
    width: 900,
    height: 900,
  });
  assert.deepEqual(
    imageCropRect({ width: 900, height: 1600 }, { width: 400, height: 400 }, 2, 1, 0),
    { x: 450, y: 0, width: 450, height: 450 },
  );
  assert.deepEqual(
    imageCropRect({ width: 100, height: 100 }, { width: 1200, height: 675 }, 1, -1, 2),
    { x: 0, y: 43.75, width: 100, height: 56.25 },
  );
  for (const source of [
    { width: 400, height: 300 },
    { width: 300, height: 400 },
  ]) {
    for (const zoom of [1, 1.3, 3]) {
      const crop = imageCropRect(source, { width: 1200, height: 675 }, zoom, 0.9, 0.1);
      assert.ok(crop.x >= 0 && crop.y >= 0);
      assert.ok(crop.x + crop.width <= source.width && crop.y + crop.height <= source.height);
      assert.ok(Math.abs(crop.width / crop.height - 16 / 9) < 1e-10);
    }
  }
});

void test("invalid or unbounded crop sizes are rejected before allocation", () => {
  for (const size of [0, -1, NaN, Infinity, 1.5, 8193]) {
    assert.equal(validImageCropSize({ width: size, height: 100 }), false);
    assert.throws(() => imageCropRect({ width: 400, height: 300 }, { width: size, height: 100 }));
  }
  assert.equal(validImageCropSize({ width: 8192, height: 8192 }), false);
  assert.throws(() => imageCropRect({ width: 0, height: 100 }, { width: 100, height: 100 }));
  assert.throws(() => imageCropRect({ width: 100, height: 100 }, { width: 100, height: 100 }, NaN));
});
