import "./drive-storage/register.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildMenu,
  MenuError,
  parsePrice,
  validateItem,
} from "../registry/components/plugins/menus/model.ts";

const category = { id: "c", position: 0, translations: { en: "Starters", fr: "Entrées" } };
const label = { id: "l", kind: "allergen", position: 0, translations: { en: "Milk", fr: "Lait" } };
const item = {
  id: "a",
  version: 1,
  categoryId: "c",
  priceMinor: 1450,
  position: 0,
  visible: true,
  soldOut: true,
  imageEntryId: null,
  labelIds: ["l"],
  translations: {
    en: { name: "Burrata", description: "Fresh cheese" },
    fr: { name: "", description: "" },
  },
};

test("public menu orders items, omits hidden products, and falls back by entity", () => {
  const sections = buildMenu(
    [
      { ...item, id: "b", position: 2, visible: false },
      { ...item, id: "a", position: 1 },
    ],
    [category],
    [label],
    "fr",
    "en",
  );
  assert.equal(sections.length, 1);
  assert.equal(sections[0].name, "Entrées");
  assert.equal(sections[0].items.length, 1);
  assert.equal(sections[0].items[0].name, "Burrata");
  assert.equal(sections[0].items[0].description, "Fresh cheese");
  assert.equal(sections[0].items[0].labels[0].name, "Lait");
  assert.equal(sections[0].items[0].soldOut, true);
});

test("price parsing is exact and item validation rejects malformed input", () => {
  assert.equal(parsePrice("14.50", 2), 1450);
  assert.equal(parsePrice("14.5", 2), 1450);
  assert.equal(parsePrice("14", 0), 14);
  for (const price of ["14.501", "1e3", "-1", "14,50"])
    assert.throws(() => parsePrice(price, 2), MenuError);
  assert.throws(() => validateItem({ ...item, priceMinor: -1 }, "en"), MenuError);
  assert.throws(() => validateItem({ ...item, labelIds: ["l", "l"] }, "en"), MenuError);
  assert.throws(
    () =>
      validateItem({ ...item, translations: { fr: { name: "Burrata", description: "" } } }, "en"),
    MenuError,
  );
});
