import type { ReactNode } from "react";

export const productsLabels = {
  products: "Products",
  catalog: "Product catalog",
  name: "Name",
  slug: "URL slug",
  slugError: "Use lowercase letters, numbers and single hyphens. A product ID cannot be a slug.",
  slugTaken: "This URL slug is already in use. Choose another.",
  language: "Product language",
  description: "Description",
  price: "Price",
  banner: "Banner image",
  thumbnail: "Thumbnail",
  gallery: "Product photos",
  photo: (number: number) => `Photo ${number}`,
  addPhoto: "Add photo",
  choosePhoto: "Choose photo",
  removePhoto: "Remove photo",
  imageUrl: "Image URL",
  imageAlt: "Image description",
  imageUrlError: "Enter a site path starting with / or an HTTPS image URL.",
  imageFileError: "Choose a JPEG, PNG or WebP image up to 10 MiB.",
  uploadError: "Could not upload this photo. Choose the file again to retry.",
  uploading: "Uploading photo…",
  previousPhoto: "Previous photo",
  nextPhoto: "Next photo",
  photoPosition: (current: number, total: number) => `${current} / ${total}`,
  characteristics: "Characteristics",
  label: "Label",
  value: "Value",
  addCharacteristic: "Add characteristic",
  removeCharacteristic: "Remove characteristic",
  status: "Status",
  publicationStatus: "Publication status",
  published: "Published",
  private: "Private",
  actions: "Actions",
  edit: "Edit",
  deleteProduct: "Delete product",
  deleteDescription: (name: string) => `Permanently delete “${name}”?`,
  cancel: "Cancel",
  confirmDelete: "Delete",
  deleting: "Deleting…",
  deleted: "Product deleted.",
  deleteError: "Could not delete. Try again.",
  add: "Add product",
  createAction: "Create",
  product: "Product",
  search: "Search products",
  clearSearch: "Clear product search",
  searchEmpty: "No matching products.",
  editProduct: "Edit product",
  publish: "Publish",
  unpublish: "Unpublish",
  save: "Save",
  saved: "Product saved.",
  publishedNotice: "Product published.",
  hiddenNotice: "Product unpublished.",
  back: "Back to products",
  close: "Close",
  empty: "No products yet.",
  catalogEmpty: "No published products yet.",
  loading: "Loading products…",
  retry: "Refresh products",
  readError: "Products could not be loaded.",
  saveError: "Could not save. Your changes are still here. Try again.",
  conflict: "This product has changed. Reopen it to review the latest version.",
  visibilityError: "Could not change visibility. Try again.",
  required: "Enter a value.",
  priceError: "Enter a valid price of zero or more.",
};
export type ProductsLabels = Partial<typeof productsLabels>;
export interface ProductListProps {
  locale?: string;
  currency: string;
  imageUrl?: (src: string) => string;
  labels?: ProductsLabels;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  pagination?: ReactNode;
  className?: string;
}
export const productButtonClass =
  "inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-4";
export const productPrimaryClass =
  "inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-4";
