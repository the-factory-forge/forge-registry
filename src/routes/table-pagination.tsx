import { Dialog } from "@base-ui/react/dialog";
import { createFileRoute } from "@tanstack/react-router";
import { PencilIcon } from "lucide-react";
import { useRef, useState } from "react";
import { z } from "zod";

import { useActionToast } from "@/components/action-toast";
import { IconTooltip } from "@/components/icon-tooltip";
import { NativeSelect } from "@/components/native-select";
import {
  iconButtonClass,
  inputClass,
  outlineButtonClass,
  primaryClass,
} from "@/components/plugins/blogs/ui";
import { RecordDeleteButton, useRecordDeletion } from "@/components/record-deletion";
import { TablePagination } from "@/components/table-pagination";
import { matchesTableSearch, TableSearch } from "@/components/table-search";
import { cn } from "@/components/utils/cn";
import {
  tableActionCellClass,
  tableActionHeaderClass,
  tableActionsClass,
  tableCellClass,
  tableClass,
  tableHeaderClass,
  tablePanelClass,
  tableRowClass,
} from "@/components/utils/table-styles";
import { ShowroomLink as Link } from "@/showroom/routing";
import { showroomHead } from "@/showroom/seo";
import { ShowroomIntro, ShowroomPreview } from "@/showroom/showroom-preview";

const initialPosts = [
  "Make room for better ideas",
  "A quieter kind of productivity",
  "Notes from our workbench",
  "An idea for tomorrow",
  "Working together",
  "A fresh perspective",
  "Small improvements",
].map((title, index) => ({
  id: String(index),
  title,
  author: ["Alex Morgan", "Zoë Martin", "Sam Rivera"][index % 3],
  category: ["Ideas", "Studio notes", "Working together"][index % 3],
  status: index % 2 === 0 ? "Published" : "Draft",
}));

const searchSchema = z.object({
  q: z.string().optional().catch(undefined),
  postPage: z.number().int().min(1).optional().catch(undefined),
  cursor: z.number().int().min(0).max(2).optional().catch(undefined),
});
const titleSchema = z.string().trim().min(1).max(120);

function TablePaginationExample() {
  const { q: search = "", postPage: requestedPage = 1, cursor = 0 } = Route.useSearch();
  const navigate = Route.useNavigate();
  const setPage = (page: number) =>
    void navigate({
      search: (previous) => ({ ...previous, postPage: page === 1 ? undefined : page }),
      resetScroll: false,
    });
  const [posts, setPosts] = useState(initialPosts);
  const [editing, setEditing] = useState<(typeof initialPosts)[number] | null>(null);
  const [title, setTitle] = useState("");
  const [invalid, setInvalid] = useState(false);
  const returnFocus = useRef<HTMLHeadingElement>(null);
  const editTrigger = useRef<HTMLButtonElement | null>(null);
  const notify = useActionToast();
  const [state, setState] = useState("ready");
  const disabled = state === "loading" || state === "error";
  const deletion = useRecordDeletion({
    items: posts,
    getName: (post) => post.title,
    onDelete: async (id) => {
      setPosts((current) => current.filter((post) => post.id !== id));
    },
    label: "Delete post",
    disabled,
    returnFocus,
    labels: {
      deleteDescription: (name) => `Delete “${name}” from this example?`,
      cancel: "Cancel",
      close: "Close",
      confirmDelete: "Delete",
      pending: "Deleting…",
      deleted: "Post deleted",
      actionError: "Could not delete this post. Try again.",
    },
  });
  const filteredPosts =
    state === "empty"
      ? []
      : deletion.items.filter((post) => matchesTableSearch(search, post.title));
  const total = filteredPosts.length;
  const pageCount = Math.max(1, Math.ceil(total / 3));
  const page = Math.min(requestedPage, pageCount);
  return (
    <ShowroomPreview
      navigation={<Link href="/table-search">Independent table searches</Link>}
      controls={
        <div className="grid gap-2 text-sm">
          <label htmlFor="factory-pagination-state">Table state</label>
          <NativeSelect
            id="factory-pagination-state"
            value={state}
            onChange={(event) => {
              setState(event.target.value);
              setPage(1);
            }}
          >
            <option value="ready">Ready</option>
            <option value="loading">Loading</option>
            <option value="empty">Empty</option>
            <option value="error">Error</option>
          </NativeSelect>
        </div>
      }
    >
      <div className="space-y-6">
        <ShowroomIntro title="Table search & pagination">
          Search the posts, then page through the matching results. Changing the search returns to
          the first page. Scroll horizontally: actions stay pinned on the right, even on mobile.
          Sample edits and deletions reset on reload.
        </ShowroomIntro>
        <section
          className={tablePanelClass}
          aria-label="Blog posts"
          aria-busy={state === "loading"}
        >
          <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 ref={returnFocus} tabIndex={-1} className="font-semibold">
              Blog posts
            </h2>
            <TableSearch
              value={search}
              onValueChange={(value) => {
                void navigate({
                  search: (previous) => ({
                    ...previous,
                    q: value || undefined,
                    postPage: undefined,
                  }),
                  replace: true,
                  resetScroll: false,
                });
              }}
              label="Search blog posts"
              className="ml-auto"
            />
          </header>
          <section
            className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-ring"
            aria-label="Scrollable blog posts"
          >
            <table className={cn(tableClass, "min-w-[56rem]")}>
              <thead>
                <tr className={tableRowClass}>
                  <th scope="col" className={tableHeaderClass}>
                    Title
                  </th>
                  {["Author", "Category", "Status"].map((label) => (
                    <th key={label} scope="col" className={tableHeaderClass}>
                      {label}
                    </th>
                  ))}
                  <th scope="col" className={tableActionHeaderClass}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {total === 0 ? (
                  <tr>
                    <td colSpan={5} className={tableCellClass}>
                      <output>{state === "empty" ? "No posts." : "No matches."}</output>
                    </td>
                  </tr>
                ) : (
                  filteredPosts.slice((page - 1) * 3, page * 3).map((post) => (
                    <tr key={post.id} className={tableRowClass}>
                      <td className={cn(tableCellClass, "min-w-64 font-medium")}>{post.title}</td>
                      <td className={cn(tableCellClass, "whitespace-nowrap")}>{post.author}</td>
                      <td className={cn(tableCellClass, "whitespace-nowrap")}>{post.category}</td>
                      <td className={tableCellClass}>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium whitespace-nowrap",
                            post.status === "Published"
                              ? "bg-status-success text-status-success-foreground"
                              : "bg-status-not-started text-status-not-started-foreground",
                          )}
                        >
                          <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
                          {post.status}
                        </span>
                      </td>
                      <td className={tableActionCellClass}>
                        <div className={tableActionsClass}>
                          <IconTooltip label={`Edit ${post.title}`}>
                            <button
                              type="button"
                              className={iconButtonClass}
                              aria-label={`Edit ${post.title}`}
                              aria-haspopup="dialog"
                              disabled={disabled || deletion.pending}
                              onClick={(event) => {
                                editTrigger.current = event.currentTarget;
                                setEditing(post);
                                setTitle(post.title);
                                setInvalid(false);
                              }}
                            >
                              <PencilIcon className="size-4 shrink-0" aria-hidden="true" />
                            </button>
                          </IconTooltip>
                          <RecordDeleteButton
                            label={`Delete ${post.title}`}
                            disabled={disabled || deletion.pending}
                            onClick={(event) => deletion.open(post.id, event.currentTarget)}
                          />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>
          <div className="min-h-12 pt-2 text-sm">
            {state === "loading" && <output>Loading posts…</output>}
            {state === "error" && (
              <p role="alert" className="text-destructive">
                Could not load posts. Select Ready to retry.
              </p>
            )}
          </div>
          <TablePagination
            summary={`${total} posts`}
            page={page}
            pageCount={pageCount}
            label="Blog post pages"
            previousDisabled={page <= 1}
            nextDisabled={page >= pageCount}
            disabled={disabled || deletion.pending}
            onPrevious={() => setPage(page - 1)}
            onNext={() => setPage(page + 1)}
          />
        </section>
        <section className={tablePanelClass} aria-label="Cursor paging">
          <h2 className="font-semibold">Cursor paging</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Sample batch {cursor + 1} of files. Previous returns one batch at a time, as it does in
            Drive.
          </p>
          <TablePagination
            label="File batches"
            page={cursor + 1}
            previousDisabled={cursor === 0}
            nextDisabled={cursor === 2}
            onPrevious={() =>
              void navigate({
                search: (previous) => ({
                  ...previous,
                  cursor: cursor === 1 ? undefined : cursor - 1,
                }),
                resetScroll: false,
              })
            }
            onNext={() =>
              void navigate({
                search: (previous) => ({ ...previous, cursor: cursor + 1 }),
                resetScroll: false,
              })
            }
          />
        </section>
        {deletion.dialog}
        <Dialog.Root
          open={editing !== null}
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
        >
          <Dialog.Portal>
            <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/30" />
            <Dialog.Popup
              finalFocus={() =>
                editTrigger.current?.isConnected ? editTrigger.current : returnFocus.current
              }
              className={cn(
                tablePanelClass,
                "fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2",
              )}
            >
              <Dialog.Title className="text-lg font-semibold">Edit post</Dialog.Title>
              <form
                className="mt-5 space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  const parsed = titleSchema.safeParse(title);
                  if (!parsed.success) {
                    setInvalid(true);
                    return;
                  }
                  setPosts((current) =>
                    current.map((post) =>
                      post.id === editing?.id ? { ...post, title: parsed.data } : post,
                    ),
                  );
                  setEditing(null);
                  notify("Post updated");
                }}
              >
                <div className="space-y-2">
                  <label htmlFor="factory-pagination-title" className="text-sm font-medium">
                    Title <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="factory-pagination-title"
                    className={inputClass}
                    required
                    maxLength={120}
                    value={title}
                    aria-invalid={invalid}
                    aria-describedby={invalid ? "factory-pagination-title-error" : undefined}
                    onChange={(event) => {
                      setTitle(event.target.value);
                      setInvalid(false);
                    }}
                  />
                  {invalid && (
                    <p
                      id="factory-pagination-title-error"
                      role="alert"
                      className="text-sm text-destructive"
                    >
                      Enter a title.
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Dialog.Close className={outlineButtonClass}>Cancel</Dialog.Close>
                  <button type="submit" className={primaryClass}>
                    Save changes
                  </button>
                </div>
              </form>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </ShowroomPreview>
  );
}

export const Route = createFileRoute("/table-pagination")({
  validateSearch: (search): z.infer<typeof searchSchema> => searchSchema.parse(search),
  head: ({ match }) =>
    showroomHead({
      title: "React table search and pagination demo",
      description:
        "Try React table search and pagination together, with filtered totals, cursor navigation, keyboard controls and loading states.",
      path: match.pathname,
      noIndex: match.status !== "success",
    }),
  component: TablePaginationExample,
});
