import { useNavigate, useSearch, useLocation } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { IntranetShell } from "@/components/layouts/intranet-shell";
import {
  SupportDetailPage,
  SupportsPage,
  type SupportDetail,
  type SupportPage,
} from "@/components/plugins/supports";
import { pluginIcons } from "@/components/utils/plugin-icons";
import { ShowroomLink, useShowroomParams } from "@/showroom/routing";
import { ShowroomPreview, previewDataNotice } from "@/showroom/showroom-preview";
import { createSupportsMock } from "@/showroom/supports-mock";

export function SupportsPreview() {
  const [mock] = useState(createSupportsMock);
  const { locale, segments } = useShowroomParams();
  const id = segments[0];
  const base = `/${locale}/intranet/supports`;
  const navigate = useNavigate({ from: "/$locale/intranet/supports/$" });
  const pathname = useLocation({ select: (location) => location.pathname });
  const query = useSearch({ strict: false });
  const search = query.search ?? "";
  const page = Number(query.page ?? 1);
  const [list, setList] = useState<SupportPage>({ items: [], total: 0 });
  const [detail, setDetail] = useState<SupportDetail>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [mode, setMode] = useState("normal");
  const [fail, setFail] = useState(false);
  const [delay, setDelay] = useState(false);
  const generation = useRef(0);
  const load = useCallback(
    async (cursor?: string, signal?: AbortSignal) => {
      const current = ++generation.current;
      await Promise.resolve();
      if (signal?.aborted) return;
      setLoading(true);
      setError(false);
      try {
        if (mode === "loading") return;
        if (mode === "error" || segments.length > 1) throw new Error("Unavailable");
        if (id) {
          const result = await mock.client.get(id, cursor);
          if (current === generation.current && !signal?.aborted)
            setDetail((previous) => ({
              ...result,
              activity:
                cursor && previous?.ticket.id === id
                  ? [...previous.activity, ...result.activity]
                  : result.activity,
            }));
        } else {
          const result =
            mode === "empty" ? { items: [], total: 0 } : await mock.client.list({ search, page });
          if (current === generation.current && !signal?.aborted) setList(result);
        }
      } catch {
        if (current === generation.current && !signal?.aborted) setError(true);
      } finally {
        if (current === generation.current && !signal?.aborted && mode !== "loading")
          setLoading(false);
      }
    },
    [mock, id, search, page, mode, segments.length],
  );
  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => load(undefined, controller.signal));
    return () => controller.abort();
  }, [load]);
  useEffect(() => () => mock.dispose(), [mock]);
  const queryString = new URLSearchParams({
    ...(search ? { search } : {}),
    ...(page > 1 ? { page: String(page) } : {}),
  }).toString();
  const backHref = `${base}${queryString ? `?${queryString}` : ""}`;
  return (
    <ShowroomPreview
      width="full"
      notice={previewDataNotice}
      controls={
        <>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={fail}
              onChange={(event) => {
                mock.setFailures(event.target.checked);
                setFail(event.target.checked);
              }}
            />
            Simulate action failures
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={delay}
              onChange={(event) => {
                mock.setDelay(event.target.checked);
                setDelay(event.target.checked);
              }}
            />
            Delay actions
          </label>
          <label className="grid gap-2 text-sm">
            List state
            <select
              value={mode}
              onChange={(event) => setMode(event.target.value)}
              className="rounded-md border border-border bg-background p-2"
            >
              <option value="normal">Normal</option>
              <option value="empty">Empty</option>
              <option value="loading">Loading</option>
              <option value="error">Error</option>
            </select>
          </label>
        </>
      }
    >
      <IntranetShell
        brand={{ name: "Example workspace", href: `/${locale}/intranet` }}
        user={{ name: "Alex Morgan", email: "alex@example.com" }}
        profileHref={`/${locale}/account`}
        onSignOut={async () => {}}
        pathname={pathname}
        linkComponent={ShowroomLink}
        groups={[
          {
            id: "workspace",
            items: [
              {
                id: "profile",
                label: "Profile settings",
                href: `/${locale}/account`,
                icon: <pluginIcons.auth />,
              },
              {
                id: "employees",
                label: "Employees",
                href: `/${locale}/employees`,
                icon: <pluginIcons.employees />,
              },
            ],
          },
        ]}
        footerItems={[
          { id: "supports", label: "Support", href: base, icon: <pluginIcons.supports /> },
        ]}
        showTopbar={false}
        contentClassName="showroom-inset"
      >
        {id ? (
          detail?.ticket.id === id ? (
            <SupportDetailPage
              client={mock.client}
              ticket={detail.ticket}
              activity={detail.activity}
              backHref={backHref}
              linkComponent={ShowroomLink}
              onChanged={() => void load()}
              onLoadMore={detail.nextCursor ? () => void load(detail.nextCursor) : undefined}
              loading={loading}
              error={error}
            />
          ) : (
            <div className="space-y-4">
              <ShowroomLink href={backHref}>Back to support</ShowroomLink>
              <p role={error ? "alert" : "status"}>
                {error ? "Ticket not found. Demo tickets reset on reload." : "Loading ticket…"}
              </p>
            </div>
          )
        ) : (
          <SupportsPage
            client={mock.client}
            tickets={mode === "empty" || mode === "loading" ? [] : list.items}
            total={mode === "empty" ? 0 : list.total}
            search={search}
            page={page}
            onSearchChange={(value) =>
              void navigate({
                search: (previous) => ({
                  ...previous,
                  search: value || undefined,
                  page: undefined,
                }),
                replace: true,
                resetScroll: false,
                hash: true,
              })
            }
            onPageChange={(value) =>
              void navigate({
                search: (previous) => ({
                  ...previous,
                  page: value === 1 ? undefined : String(value),
                }),
                resetScroll: false,
                hash: true,
              })
            }
            onChanged={() => void load()}
            getTicketHref={(ticket) =>
              `${base}/${ticket.id}${queryString ? `?${queryString}` : ""}`
            }
            onCreated={(ticket) =>
              void navigate({
                to: "/$locale/intranet/supports/$",
                params: { locale, _splat: ticket.id },
                search: { search: undefined, page: undefined },
              })
            }
            linkComponent={ShowroomLink}
            loading={loading}
            error={error}
            onRetry={() => void load()}
          />
        )}
      </IntranetShell>
    </ShowroomPreview>
  );
}
