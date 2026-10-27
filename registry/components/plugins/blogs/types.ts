import type { ComponentType } from "react";

import type { ImageProps } from "@/components/image";
import type { LinkProps } from "@/components/link";
import type { BlogsLabels } from "@/components/plugins/blogs/labels";

export interface BlogEditor {
  id: string;
  name: string;
}
export interface BlogLocale {
  code: string;
  name: string;
}
export interface BlogCategory {
  id: string;
  version: number;
  parentId: string | null;
  translations: Record<string, { name: string; slug: string }>;
}
export interface BlogShared {
  /** Optional only for documents written before separate authorship was installed. */
  author?: BlogEditor;
  thumbnailId: string | null;
  bannerId: string | null;
  categoryIds: string[];
}
export interface BlogContent {
  title: string;
  slug: string;
  summary: string;
  markdown: string;
  thumbnailAlt: string;
  bannerAlt: string;
}
export interface BlogRevision extends BlogContent {
  revisionId: string | null;
  assetIds: string[];
  editor: BlogEditor;
  updatedAt: string;
}
export interface BlogPublication extends BlogRevision {
  shared: BlogShared;
  publishedAt: string;
  omittedAssetIds?: string[];
}
export interface BlogHistoryState {
  lastNumber: number;
  lastPublicationOrder: number;
  currentId: string | null;
  publishedId: string | null;
}
export interface BlogTranslation {
  draft: BlogRevision;
  published: BlogPublication | null;
  /** Legacy documents fall back to article.shared until migration or their next save. */
  shared?: BlogShared;
  history?: BlogHistoryState;
}
export interface BlogHistoryHeader {
  id: string;
  number: number;
  locale: string;
  state: "draft" | "publication";
  savedAt: string;
  savedBy: BlogEditor;
  author?: BlogEditor;
  repriseId: string | null;
  sourcePublicationId: string | null;
  sourcePublicationOrder: number | null;
  publicationOrder: number | null;
  publishedAt: string | null;
  omittedAssetIds: string[];
}
export interface BlogHistoryVersion extends BlogHistoryHeader {
  content: BlogRevision;
  shared: BlogShared;
}
export interface BlogHistoryOrigin {
  versionId: string;
  /** A fresh identity for each start from a publication; drafts retain theirs. */
  repriseId?: string;
}
export interface BlogHistoryTarget {
  id: string;
  version: number;
  locale: string;
  versionId: string;
}
export interface BlogHistoryPlan {
  target: BlogHistoryTarget;
  discarded: BlogHistoryHeader[];
  missingAssetIds: string[];
  historicalReturn: boolean;
  token: string;
}
export interface BlogsHistoryClient {
  list(input: { id: string; locale: string }): Promise<BlogHistoryHeader[]>;
  get(input: { id: string; locale: string; versionId: string }): Promise<BlogHistoryVersion>;
  plan(input: BlogHistoryTarget): Promise<BlogHistoryPlan>;
  publish(
    input: BlogHistoryTarget & BlogMutation & { token: string; omitMissingImages: boolean },
  ): Promise<BlogArticle>;
  delete(input: BlogHistoryTarget & BlogMutation): Promise<BlogArticle>;
}
export interface BlogArticle {
  id: string;
  version: number;
  shared: BlogShared;
  translations: Record<string, BlogTranslation>;
  editor: BlogEditor;
  createdAt: string;
  updatedAt: string;
}
export interface BlogListItem {
  id: string;
  author?: BlogEditor;
  title: string;
  categoryNames?: string[];
  editor: BlogEditor;
  updatedAt: string;
  translations: { locale: string; slug: string; status: "draft" | "published" | "changed" }[];
}
export interface BlogPost extends BlogPublication {
  id: string;
  locale: string;
}
export interface BlogAsset {
  id: string;
  postId: string;
  name: string;
  size: number;
  contentType: string;
}
export interface BlogPage<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
export interface BlogQuery {
  search?: string;
  page?: number;
  pageSize?: number;
  locale: string;
}
export interface BlogPublicQuery extends BlogQuery {
  categoryId?: string;
}
export interface BlogPublicPage extends BlogPage<Omit<BlogPost, "markdown">> {
  categoryCounts: Record<string, number>;
}
export interface BlogCapabilities {
  changeAuthor?: boolean;
  reviewLegacyAuthor?: boolean;
  create: boolean;
  edit: boolean;
  publish: boolean;
  delete: boolean;
  upload: boolean;
  manageCategories: boolean;
}
export interface BlogMutation {
  requestId: string;
}
export interface BlogPostMutation extends BlogMutation {
  id: string;
  version: number;
}
export interface BlogSaveInput extends BlogPostMutation {
  locale: string;
  content: BlogContent;
  shared: BlogShared;
  origin?: BlogHistoryOrigin;
}
export interface BlogPublishInput extends BlogPostMutation {
  locale: string;
}
export interface BlogCategoryInput extends BlogMutation {
  id?: string;
  version?: number;
  parentId: string | null;
  translations: BlogCategory["translations"];
}
/** The host supplies authenticated transport. Actor identities never come from these inputs. */
export interface BlogsClient {
  /** Optional so existing host transports keep their current editor. */
  history?: BlogsHistoryClient;
  list(query: BlogQuery): Promise<BlogPage<BlogListItem>>;
  get(id: string): Promise<BlogArticle>;
  categories(): Promise<BlogCategory[]>;
  assets(id: string): Promise<BlogAsset[]>;
  create(input: BlogMutation & { title: string; locale: string }): Promise<BlogArticle>;
  save(input: BlogSaveInput): Promise<BlogArticle>;
  publish(input: BlogPublishInput): Promise<BlogArticle>;
  unpublish(input: BlogPublishInput): Promise<BlogArticle>;
  delete(input: BlogPostMutation): Promise<void>;
  upload(input: BlogMutation & { id: string; file: File }): Promise<BlogAsset>;
  saveCategory(input: BlogCategoryInput): Promise<BlogCategory>;
  deleteCategory(input: BlogMutation & { id: string; version: number }): Promise<void>;
}
export interface BlogsAppearanceProps {
  labels?: Partial<BlogsLabels>;
  className?: string;
  linkComponent?: ComponentType<LinkProps>;
  imageComponent?: ComponentType<ImageProps>;
  /** Resolve a verified asset ID to a host route; never persist an expiring URL in Markdown. */
  assetUrl: (id: string) => string;
  maxImageBytes?: number;
  maxMarkdownBytes?: number;
  formatDate?: (iso: string, locale: string) => string;
}
