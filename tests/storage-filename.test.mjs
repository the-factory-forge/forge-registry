import assert from "node:assert/strict";
import test from "node:test";

import { storageFilename } from "../registry/components/utils/storage-filename.ts";

void test("object filenames keep safe asset names, usage context and extensions", () => {
  for (const [name, type, extension, expected] of [
    ["the_corner-logo.png", "blog", undefined, "the_corner-blog.png"],
    ["the_corner-logo_mark-white.png", "blog", undefined, "the_corner-blog-white.png"],
    [
      "the_corner-icon-filled-white_bg.webp",
      "project",
      undefined,
      "the_corner-project-filled-white_bg.webp",
    ],
    ["tc_ai-logo_black.svg", "workspace", undefined, "tc_ai-workspace.svg"],
    ["the_corner-photo-thumbnail.JPG", "blog", "png", "the_corner-blog-thumbnail.png"],
    ["The Corner-Logo Mark-White.PNG", "blog", undefined, "the_corner-blog-white.png"],
    ["---photo---", "menu-item", undefined, "photo-menu_item.bin"],
    ["cover-blog-original.jpg", "blog", undefined, "cover-blog.jpg"],
    [
      "menu_item-image-thumbnail.webp",
      "menu-item",
      undefined,
      "menu_item-menu_item-thumbnail.webp",
    ],
    ["Annual Report.PDF", "project", undefined, "annual_report-project.pdf"],
    ["Crème brûlée.webp", "menu", undefined, "creme_brulee-menu.webp"],
    ["archive.tar.gz", "workspace", undefined, "archive_tar-workspace.gz"],
    ["photo.jpg", "blog", "png", "photo-blog.png"],
    ["photo", "blog", "jpg", "photo-blog.jpg"],
    ["Mia Portrait.JPG", "employee", "webp", "mia_portrait-employee.webp"],
    ["mia-portrait-original.JPG", "employee", "webp", "mia-employee.webp"],
    ["mia-employee-card.webp", "employee", "webp", "mia-employee-card.webp"],
    ["README", "workspace", undefined, "readme-workspace.bin"],
    ["../../folder/Photo.PNG", "../Blog / cover", undefined, "photo-blog_cover.png"],
    ["...", "///", undefined, "asset-file.bin"],
    ["照片-logo-white.png", "blog", undefined, "asset-blog-white.png"],
    ["photo--thumbnail.png", "blog", undefined, "photo-blog-thumbnail.png"],
    ["照片.png", "blog", undefined, "asset-blog.png"],
  ])
    assert.equal(storageFilename(name, type, extension), expected);
  const rebuilt = storageFilename("the_corner-logo_mark-white.png", "blog");
  assert.equal(storageFilename(rebuilt, "blog"), rebuilt);
  const variants = storageFilename(
    "a".repeat(100) + "-image-" + "b".repeat(100),
    "c".repeat(100),
    "png",
  );
  assert.ok(variants.length < 255);
  const long = storageFilename("a".repeat(250) + ".jpeg", "b".repeat(100));
  assert.ok(long.length < 255);
  assert.match(long, /^[a-z0-9_-]+\.jpeg$/);
});
