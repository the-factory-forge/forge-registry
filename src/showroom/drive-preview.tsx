"use client";

import { useSearch } from "@tanstack/react-router";

import { DriveBrowser, DrivePage, type DriveScope } from "@/components/plugins/drive";
import { usePluginsPreview } from "@/showroom/plugins-preview";
import { ShowroomLink as Link, useShowroomParams } from "@/showroom/routing";

export function EmbeddedDrivePreview({
  scope,
  base,
  customerId,
}: {
  scope: DriveScope;
  base: string;
  customerId?: string;
}) {
  const state = usePluginsPreview();
  const query = useSearch({ strict: false });
  const { locale } = useShowroomParams();
  return (
    <DriveBrowser
      locale={locale}
      client={state.driveClient}
      transferUpload={state.driveMock.transfer}
      scope={scope}
      parentId={query.folder}
      backHref={`/${locale}/drive`}
      getFolderHref={(folder) => {
        const params = new URLSearchParams();
        if (customerId) params.set("customerId", customerId);
        if (folder) params.set("folder", folder);
        return `${base}${params.size ? `?${params.toString()}` : ""}`;
      }}
      linkComponent={Link}
    />
  );
}

export function DrivePreview() {
  const state = usePluginsPreview();
  const params = useShowroomParams();
  const base = `/${params.locale}/drive`;
  const [type, id, folder] = params.segments ?? [];
  if (!type)
    return (
      <DrivePage
        className="showroom-page"
        locale={params.locale}
        client={state.driveClient}
        getSpaceHref={(space) =>
          `${base}/${encodeURIComponent(space.scope.type)}/${encodeURIComponent(space.scope.id)}`
        }
        linkComponent={Link}
      />
    );
  if (!id || (params.segments?.length ?? 0) > 3)
    return (
      <p>
        Drive space not found.{" "}
        <Link className="underline" href={base}>
          Back to Drive
        </Link>
      </p>
    );
  return (
    <DriveBrowser
      className="showroom-page"
      locale={params.locale}
      client={state.driveClient}
      transferUpload={state.driveMock.transfer}
      scope={{ type, id }}
      parentId={folder}
      backHref={base}
      getFolderHref={(folderId) =>
        `${base}/${encodeURIComponent(type)}/${encodeURIComponent(id)}${folderId ? `/${encodeURIComponent(folderId)}` : ""}`
      }
      linkComponent={Link}
    />
  );
}
