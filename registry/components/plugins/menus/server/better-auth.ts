import type { BetterAuthPlugin } from "better-auth";

/** Register these models in Better Auth alongside the matching Drizzle tables. */
export const menusPlugin = () =>
  ({
    id: "menus",
    schema: {
      menuCategory: {
        modelName: "menu_category",
        fields: {
          position: { type: "number", required: true },
          translations: { type: "json", required: true },
        },
      },
      menuLabel: {
        modelName: "menu_label",
        fields: {
          kind: { type: "string", required: true },
          position: { type: "number", required: true },
          translations: { type: "json", required: true },
        },
      },
      menuItem: {
        modelName: "menu_item",
        fields: {
          version: { type: "number", required: true },
          categoryId: {
            type: "string",
            required: true,
            fieldName: "category_id",
            references: { model: "menuCategory", field: "id", onDelete: "restrict" },
          },
          priceMinor: { type: "number", required: true, fieldName: "price_minor" },
          position: { type: "number", required: true },
          visible: { type: "boolean", required: true },
          soldOut: { type: "boolean", required: true, fieldName: "sold_out" },
          imageEntryId: { type: "string", required: false, fieldName: "image_entry_id" },
          labelIds: { type: "json", required: true, fieldName: "label_ids" },
          translations: { type: "json", required: true },
        },
      },
    },
  }) satisfies BetterAuthPlugin;
