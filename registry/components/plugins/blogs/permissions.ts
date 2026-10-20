import type { BlogCapabilities } from "@/components/plugins/blogs/types";

/** Hosts must derive this actor from a fresh, active, fully onboarded staff session. */
export interface BlogActor {
  id: string;
  admin: boolean;
}

/** Shared collaboration policy. Hosts may enforce a narrower policy in their adapter. */
export function blogCapabilities(actor: BlogActor | null, authorId?: string): BlogCapabilities {
  const managesArticle = !!actor && (actor.admin || actor.id === authorId);
  return {
    create: !!actor,
    edit: !!actor,
    upload: !!actor,
    publish: managesArticle,
    delete: managesArticle,
    changeAuthor: managesArticle,
    manageCategories: !!actor?.admin,
  };
}

export function canAccessBlog(
  actor: BlogActor | null,
  permission: "read" | keyof BlogCapabilities,
  authorId?: string,
): boolean {
  return permission === "read" ? !!actor : !!blogCapabilities(actor, authorId)[permission];
}
