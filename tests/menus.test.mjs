import "./drive-storage/register.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  getMenuFilterLabels,
  getMenuLabelPreset,
  menuLabelPresets,
  menuLabelIcons,
} from "../registry/components/plugins/menus/label-presets.ts";
const { buildMenu, MenuError, parsePrice, reorderMenuItems, validateItem, validateLabel } =
  await import("../registry/components/plugins/menus/model.ts");

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

test("reordering validates the complete versioned list and preserves item content", () => {
  const items = [
    item,
    {
      ...item,
      id: "b",
      position: 0,
      sizes: [{ id: "small", priceMinor: 900, translations: { en: "Small" } }],
    },
  ];
  const snapshot = structuredClone(items);
  const order = items.map(({ id, version }) => ({ id, version })).reverse();
  const result = reorderMenuItems(items, order);
  assert.deepEqual(
    result.map(({ id, position }) => [id, position]),
    [
      ["b", 0],
      ["a", 1],
    ],
  );
  assert.equal(result[1].version, item.version + 1);
  assert.deepEqual(result[0].sizes, items[1].sizes);
  assert.deepEqual(items, snapshot);
  assert.deepEqual(
    buildMenu(result, [category], [label], "en", "en")[0].items.map(({ id }) => id),
    ["b", "a"],
  );
  for (const invalid of [null, [null], [{ id: "a", version: 0 }], [order[0], order[0]]]) {
    assert.throws(
      () => reorderMenuItems(items, invalid),
      (error) => error.code === "INVALID",
    );
  }
  for (const stale of [
    order.slice(1),
    [{ id: "missing", version: 1 }, order[1]],
    [{ ...order[0], version: 99 }, order[1]],
  ]) {
    assert.throws(
      () => reorderMenuItems(items, stale),
      (error) => error.code === "CONFLICT",
    );
  }
});

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

test("spice levels default to zero, reach the public menu, and reject invalid values", () => {
  assert.equal(validateItem(item, "en").spiceLevel, 0);
  assert.equal(buildMenu([item], [category], [label], "en", "en")[0].items[0].spiceLevel, 0);
  for (const spiceLevel of [0, 1, 2, 3]) {
    const input = validateItem({ ...item, spiceLevel }, "en");
    assert.equal(input.spiceLevel, spiceLevel);
    assert.equal(
      buildMenu([{ ...item, ...input }], [category], [label], "en", "en")[0].items[0].spiceLevel,
      spiceLevel,
    );
  }
  for (const spiceLevel of [-1, 4, 1.5, "2", true, null, NaN])
    assert.throws(() => validateItem({ ...item, spiceLevel }, "en"), MenuError);
});

test("size prices normalize the default price and localize each size with fallback", () => {
  assert.deepEqual(validateItem(item, "en").sizes, []);
  assert.deepEqual(buildMenu([item], [category], [label], "en", "en")[0].items[0].sizes, []);
  const sizes = [
    { id: "small", priceMinor: 2200, translations: { en: " Small ", fr: "Petite" } },
    { id: "large", priceMinor: 2800, translations: { en: "Large", fr: " " } },
  ];
  const value = validateItem({ ...item, sizes }, "en");
  assert.equal(value.priceMinor, 2200);
  assert.equal(value.sizes[0].translations.en, "Small");
  const result = buildMenu([{ ...item, ...value }], [category], [label], "fr", "en");
  assert.deepEqual(result[0].items[0].sizes, [
    { id: "small", priceMinor: 2200, name: "Petite" },
    { id: "large", priceMinor: 2800, name: "Large" },
  ]);
  assert.equal(validateItem({ ...item, sizes: [] }, "en").priceMinor, 1450);
  assert.equal(
    validateItem({ ...item, sizes: [{ ...sizes[0], priceMinor: 0 }] }, "en").priceMinor,
    0,
  );
});

test("size validation rejects invalid prices, IDs, translations and oversized lists", () => {
  const size = { id: "small", priceMinor: 2200, translations: { en: "Small" } };
  for (const sizes of [
    null,
    {},
    "small",
    [null],
    [size, size],
    [{ ...size, id: "" }],
    [{ ...size, id: " " }],
    [{ ...size, id: "a".repeat(121) }],
    [{ ...size, priceMinor: -1 }],
    [{ ...size, priceMinor: 1.5 }],
    [{ ...size, priceMinor: "2200" }],
    [{ ...size, priceMinor: 1e9 + 1 }],
    [{ ...size, translations: { fr: "Petite" } }],
    [{ ...size, translations: { en: " " } }],
    [{ ...size, translations: { en: "a".repeat(121) } }],
    Array.from({ length: 21 }, (_, index) => ({ ...size, id: String(index) })),
  ])
    assert.throws(() => validateItem({ ...item, sizes }, "en"), MenuError);
});

test("default menu labels cover all allergen groups with translated icons and semantic colors", () => {
  assert.deepEqual(
    menuLabelPresets
      .filter((label) => label.kind === "allergen")
      .map((label) => label.translations.en)
      .sort((a, b) => a.localeCompare(b)),
    [
      "Celery",
      "Crustaceans",
      "Eggs",
      "Fish",
      "Gluten",
      "Lupin",
      "Milk",
      "Molluscs",
      "Mustard",
      "Peanuts",
      "Sesame",
      "Soy",
      "Sulphites",
      "Tree nuts",
    ].sort((a, b) => a.localeCompare(b)),
  );
  assert.deepEqual(
    menuLabelPresets
      .filter((label) => label.kind === "dietary")
      .map((label) => label.translations.en),
    ["Vegetarian", "Vegan", "Pescatarian", "Halal", "Kosher"],
  );
  assert.equal(new Set(menuLabelPresets.map((label) => label.id)).size, menuLabelPresets.length);
  for (const preset of menuLabelPresets) {
    assert.match(
      preset.id,
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    for (const locale of ["en", "fr", "de", "it"]) assert.ok(preset.translations[locale]);
    assert.ok(preset.icon);
  }
  assert.equal(
    getMenuLabelPreset({ id: "host-milk", kind: "allergen", name: "Lait" }).tone,
    "info",
  );
  assert.equal(
    getMenuLabelPreset({ id: "host-gluten", kind: "allergen", name: "Gluten" }).tone,
    "pending",
  );
  assert.equal(
    getMenuLabelPreset({ id: "host-veggie", kind: "dietary", name: "Végétarien" }).tone,
    "success",
  );
});

test("public filters contain only visible items' labels and preserve host IDs and custom labels", () => {
  const sections = buildMenu([item], [category], [label], "fr", "en");
  const custom = { id: "custom", kind: "dietary", name: "Paleo" };
  sections[0].items[0].labels.push(custom);
  const filters = getMenuFilterLabels(sections, "fr-CH");
  const milk = filters.filter((label) => label.name === "Lait");
  assert.equal(milk.length, 1);
  assert.equal(milk[0].id, "l");
  assert.equal(filters.length, 2);
  assert.equal(
    filters.some((label) => label.name === "Végétalien"),
    false,
  );
  assert.equal(
    filters.some((label) => label.name === "Crustacés"),
    false,
  );
  assert.ok(filters.some((label) => label.id === "custom"));
  assert.equal(sections[0].items[0].labels.length, 2);
  assert.deepEqual(getMenuFilterLabels(sections, "fr", []), [milk[0], custom]);
  assert.deepEqual(getMenuFilterLabels([], "en"), []);
  const unused = { id: "unused", kind: "allergen", name: "Eggs" };
  assert.deepEqual(getMenuFilterLabels(sections, "fr", [unused]), [milk[0], custom]);
  sections[0].items.push({
    ...sections[0].items[0],
    id: "hidden",
    visible: false,
    labels: [unused],
  });
  assert.deepEqual(getMenuFilterLabels(sections, "fr"), [milk[0], custom]);
});

test("filter choices sort alphabetically by localized names without changing item labels", () => {
  const labels = [
    { ...label, id: "milk", translations: { en: "Milk", fr: "Lait" } },
    { ...label, id: "eggs", translations: { en: "Eggs", fr: "Œufs" } },
    { ...label, id: "gluten", translations: { en: "Gluten", fr: "Gluten" } },
    { ...label, id: "celery", translations: { en: "Celery", fr: "Céleri" } },
    { ...label, id: "custom-spelt", translations: { en: "Spelt", fr: "Épeautre" } },
  ];
  for (const [locale, expected] of [
    ["en", ["Celery", "Eggs", "Gluten", "Milk", "Spelt"]],
    ["fr", ["Céleri", "Épeautre", "Gluten", "Lait", "Œufs"]],
  ]) {
    const sections = buildMenu(
      [{ ...item, labelIds: labels.map((label) => label.id) }],
      [category],
      labels,
      locale,
      "en",
    );
    const original = [...sections[0].items[0].labels];
    const filters = getMenuFilterLabels(sections, locale, [...original].reverse());
    assert.deepEqual(
      filters.map((label) => label.name),
      expected,
    );
    assert.deepEqual(sections[0].items[0].labels, original);
  }
});

test("label icons validate and survive localization and public filter mapping", () => {
  assert.equal(validateLabel(label, "en").icon, null);
  assert.equal(validateLabel({ ...label, icon: null }, "en").icon, null);
  for (const icon of menuLabelIcons) {
    const value = validateLabel({ ...label, icon }, "en");
    assert.equal(value.icon, icon);
    const sections = buildMenu([item], [category], [{ ...label, ...value }], "fr", "en");
    assert.equal(sections[0].items[0].labels[0].icon, icon);
    const [filter] = getMenuFilterLabels(sections, "fr");
    assert.equal(filter.icon, icon);
    assert.equal(filter.name, "Lait");
    assert.equal(getMenuLabelPreset(filter).tone, "info");
  }
  for (const icon of ["", "unknown", "constructor", 1, true, {}, []]) {
    assert.throws(() => validateLabel({ ...label, icon }, "en"), MenuError);
  }
});
