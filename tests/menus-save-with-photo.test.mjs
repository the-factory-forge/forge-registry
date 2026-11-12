import "./drive-storage/register.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";

const { prepareDishPhoto, saveDishWithPhoto } =
  await import("../registry/components/plugins/menus/save-with-photo.ts");

const input = {
  categoryId: "main",
  priceMinor: null,
  position: 0,
  visible: true,
  soldOut: false,
  spiceLevel: 0,
  imageEntryId: null,
  labelIds: [],
  translations: { en: { name: "Roast", description: "" } },
};

await test("a partial photo save retries without another dish or upload", async () => {
  let creates = 0;
  let transfers = 0;
  let prepares = 0;
  let saves = 0;
  let completed = false;
  const state = {};
  const file = new File(["image bytes"], "dish.webp", { type: "image/webp" });
  const photo = prepareDishPhoto(file);
  const replacement = prepareDishPhoto(file);
  assert.notEqual(photo.file.name, replacement.file.name);
  assert.match(photo.file.name, /^dish-[0-9a-f]+\.webp$/);

  const args = {
    client: {
      async create(data, options) {
        creates++;
        assert.deepEqual(options, { visibleOnCreate: true });
        assert.equal(data.visible, false);
        assert.equal(data.imageEntryId, null);
        return { ...data, id: "dish", version: 1 };
      },
      async save(id, version, data) {
        assert.equal(id, "dish");
        assert.equal(version, 1);
        assert.equal(data.visible, true);
        assert.equal(data.imageEntryId, "photo");
        if (++saves === 1) throw new Error("association failed");
        return { ...data, id, version: 2 };
      },
    },
    drive: {
      async prepareUpload({ scope, requestId, name }) {
        assert.deepEqual(scope, { type: "menu-item", id: "dish" });
        assert.equal(requestId, photo.requestId);
        assert.equal(name, photo.file.name);
        prepares++;
        return { id: requestId, entryId: "photo", completed };
      },
      async completeUpload() {
        completed = true;
        throw new Error("completion response lost");
      },
    },
    async transfer(ticket, file) {
      assert.equal(ticket.entryId, "photo");
      assert.equal(file, photo.file);
      transfers++;
    },
    state,
    input,
    photo,
    visibleOnCreate: true,
    signal: new AbortController().signal,
  };

  await assert.rejects(saveDishWithPhoto(args), /completion response lost/);
  assert.equal(state.item.id, "dish");
  assert.equal(state.item.visible, false);
  await assert.rejects(saveDishWithPhoto(args), /association failed/);
  const saved = await saveDishWithPhoto(args);
  assert.equal(saved.id, "dish");
  assert.equal(saved.visible, true);
  assert.equal(saved.imageEntryId, "photo");
  assert.deepEqual(
    { creates, transfers, prepares, saves },
    { creates: 1, transfers: 1, prepares: 2, saves: 2 },
  );
});
