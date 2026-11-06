import assert from "node:assert/strict";
import test from "node:test";

import { cn } from "../registry/components/utils/cn.ts";

void test("class merging preserves conditional inputs and consumer overrides", () => {
  assert.equal(cn(null, undefined, false, ""), "");
  assert.equal(
    cn("bg-primary px-5 text-sm", [false, "py-2", ["px-7"]], {
      "bg-secondary": true,
      hidden: false,
    }),
    "text-sm py-2 px-7 bg-secondary",
  );
  assert.equal(cn("p-4", "px-6"), "p-4 px-6");
  assert.equal(cn("px-6 py-2", "p-4"), "p-4");
});

void test("class merging retains semantic tokens, custom classes and independent variants", () => {
  assert.equal(
    cn(
      "container-premium bg-background section-padding text-sm text-foreground hover:bg-muted",
      "bg-card text-lg text-primary hover:bg-accent focus-visible:ring-ring dark:bg-background",
    ),
    "container-premium section-padding bg-card text-lg text-primary hover:bg-accent focus-visible:ring-ring dark:bg-background",
  );
  assert.equal(cn("w-[12rem] md:w-64", "w-[20rem] md:w-80"), "w-[20rem] md:w-80");
  assert.equal(cn("[&_svg]:size-5", "[&_svg]:size-4"), "[&_svg]:size-4");
  assert.equal(cn("p-2! p-4", "p-6!"), "p-4 p-6!");
});
