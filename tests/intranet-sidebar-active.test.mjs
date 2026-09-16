import assert from "node:assert/strict";
import test from "node:test";

import { itemIsActive } from "../registry/components/navigation/intranet-sidebar-active.ts";

test("linked project sections match their overview and project subpages", () => {
  const projects = {
    href: "/customers/projects",
    items: [{ href: "/customers/projects/project-1/analytics" }],
  };

  assert.equal(itemIsActive(projects, "/customers/projects"), true);
  assert.equal(itemIsActive(projects, "/customers/projects/project-1/analytics"), true);
  assert.equal(itemIsActive(projects, "/customers/projects/project-1/design"), true);
  assert.equal(itemIsActive(projects, "/customers/me"), false);
});

test("exact parent matching still includes children outside the parent path", () => {
  const workspace = {
    href: "/workspace",
    exact: true,
    items: [{ href: "/projects" }],
  };

  assert.equal(itemIsActive(workspace, "/workspace"), true);
  assert.equal(itemIsActive(workspace, "/workspace/other"), false);
  assert.equal(itemIsActive(workspace, "/projects/design"), true);
});

test("path matching normalizes trailing slashes and respects segment boundaries", () => {
  assert.equal(itemIsActive({ href: "/projects/" }, "/projects"), true);
  assert.equal(itemIsActive({ href: "/projects", exact: true }, "/projects/"), true);
  assert.equal(itemIsActive({ href: "/projects" }, "/projects-old"), false);
  assert.equal(itemIsActive({ href: "/" }, "/projects"), false);
  assert.equal(itemIsActive({ href: "/" }, "/"), true);
});

test("non-linked groups match descendants and empty linked groups retain their destination", () => {
  const group = { items: [{ items: [{ href: "/policies/security" }] }] };
  assert.equal(itemIsActive(group, "/policies/security"), true);
  assert.equal(itemIsActive(group, "/projects"), false);
  assert.equal(itemIsActive({ items: [] }, "/"), false);
  assert.equal(itemIsActive({ href: "/projects", items: [] }, "/projects"), true);
  assert.equal(itemIsActive({ href: "/projects", items: [] }, "/projects/design"), true);
});

test("a parent link is the current page only for its own exact destination", () => {
  const destination = { href: "/projects/", exact: true };
  assert.equal(itemIsActive(destination, "/projects"), true);
  assert.equal(itemIsActive(destination, "/projects/design"), false);
});
