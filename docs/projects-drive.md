# Projects–Drive connector

`@forge/projects-drive` installs the optional composition of Projects and Drive.
It embeds the existing file browser with `{ type: "project", id: project.id }`.
Base Projects and Drive remain independently installable. There is no customer
file space, new storage schema or automatic folder provisioning.

```sh
pnpm dlx shadcn add @forge/projects-drive
```

```tsx
import { ProjectDrive } from "@/components/connectors/projects-drive";

<ProjectDetailPage
  {...projectPageProps}
  project={project}
  driveContent={
    <ProjectDrive
      project={project}
      client={driveClient}
      parentId={folderId}
      getFolderHref={getProjectFolderHref}
      linkComponent={HostLink}
    />
  }
/>;
```

`ProjectDriveProps` accepts the existing `DriveBrowserProps` except `scope`, plus
`project: Pick<Project, "id">`. It preserves labels, locale, selection, upload,
rename and navigation behavior. Changing the project remounts the browser so
folder state and pending UI cannot leak between projects. Folder changes within
a project retain the existing Drive lifecycle. `projectDriveScope(project)` is
also exported from the browser entrypoint and the non-visual `/scope` entrypoint
for host scope resolvers.

The host supplies a stable authenticated `DriveClient`, validated URL folder
state and folder links. The optional rename callback updates the host project;
read-only hosts omit it. File permissions and project existence must be checked
in the server's scope resolver on every operation. A supplied project ID never
grants access. Reuse `@forge/drive-storage` when suitable, following its existing
[storage and adoption guide](./drive.md); installation applies no migration and
moves no deployed objects.

The [showcase](https://registry.the-corner.io/connectors/projects-drive) uses the
existing in-memory Drive adapter. It demonstrates folder creation, navigation,
read-only access and action failure recovery in a project detail. The original
Projects showroom also uses the connector. Both previews reset on reload.
