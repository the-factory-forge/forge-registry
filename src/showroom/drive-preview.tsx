"use client";

import { useSearch } from "@tanstack/react-router";

import { ProjectDrive } from "@/components/connectors/projects-drive";
import { DriveBrowser, DrivePage, type DriveScope } from "@/components/plugins/drive";
import {
  DRIVE_FILE_SORT_FIELDS,
  DRIVE_SORT_FIELDS,
  TRASH_SORT_FIELDS,
} from "@/components/plugins/drive/types";
import { usePluginsPreview } from "@/showroom/plugins-preview";
import { useShowroomTableSort, useShowroomQuery } from "@/showroom/routing";
import { ShowroomLink as Link, useShowroomParams } from "@/showroom/routing";

export function useShowroomDriveOrder() {
  const order = useShowroomTableSort("files", DRIVE_FILE_SORT_FIELDS);
  const trashOrder = useShowroomTableSort("trash", TRASH_SORT_FIELDS);
  const { query, update } = useShowroomQuery();
  return {
    ...order,
    trashOrder,
    trashView: query.trash === true,
    onTrashViewChange: (visible: boolean) => update({ trash: visible || undefined }),
  };
}
export function EmbeddedDrivePreview({
  scope,
  base,
  customerId,
}: {
  scope: DriveScope;
  base: string;
  customerId?: string;
}) {
  const fileOrder = useShowroomDriveOrder();
  const state = usePluginsPreview();
  const query = useSearch({ strict: false });
  const { locale } = useShowroomParams();
  return (
    <ProjectDrive
      {...fileOrder}
      project={{ id: scope.id }}
      locale={locale}
      client={state.driveClient}
      transferUpload={state.driveMock.transfer}
      onRenameSpace={
        scope.type === "project" ? (name) => state.renameDriveSpace(scope, name) : undefined
      }
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
  const fileOrder = useShowroomDriveOrder();
  const state = usePluginsPreview();
  const spacesOrder = useShowroomTableSort("spaces", DRIVE_SORT_FIELDS);
  const params = useShowroomParams();
  const base = `/${params.locale}/drive`;
  const [type, id, folder] = params.segments ?? [];
  if (!type)
    return (
      <DrivePage
        {...spacesOrder}
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
        <Link
          className="inline-flex min-h-10 items-center rounded-md px-3 text-sm font-medium hover:bg-primary/5 hover:text-primary focus-visible:outline-2 focus-visible:outline-ring"
          href={base}
        >
          Back to drive
        </Link>
      </p>
    );
  return (
    <DriveBrowser
      {...fileOrder}
      className="showroom-page"
      locale={params.locale}
      client={state.driveClient}
      transferUpload={state.driveMock.transfer}
      scope={{ type, id }}
      onRenameSpace={
        type === "project" ? (name) => state.renameDriveSpace({ type, id }, name) : undefined
      }
      parentId={folder}
      backHref={base}
      getFolderHref={(folderId) =>
        `${base}/${encodeURIComponent(type)}/${encodeURIComponent(id)}${folderId ? `/${encodeURIComponent(folderId)}` : ""}`
      }
      linkComponent={Link}
    />
  );
}
