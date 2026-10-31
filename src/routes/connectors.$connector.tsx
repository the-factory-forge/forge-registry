import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

import { BexioContactLinkCard, BexioSyncAllButton } from "@/components/connectors/customers-bexio";
import { ProjectDrive, projectDriveScope } from "@/components/connectors/projects-drive";
import { CustomerDetailPage } from "@/components/plugins/customers";
import { ProjectDetailPage, type Project } from "@/components/plugins/projects";
import { createCustomersBexioMock } from "@/showroom/customers-bexio-mock";
import { createDriveMock } from "@/showroom/drive-mock";
import { ShowroomLink } from "@/showroom/routing";
import { showroomHead } from "@/showroom/seo";
import { previewDataNotice, ShowroomPreview } from "@/showroom/showroom-preview";

const connectors = {
  "customers-bexio": {
    title: "Customers–Bexio",
    description:
      "Link customers to Bexio, sync saved changes automatically, or import contacts in bulk.",
    adapters: [
      "BexioCredentialProvider — server-side access token",
      "BexioBulkContactClient — Bexio contact and relationship API",
      "createBexioCustomerProvisioner — transactional account creation and retry",
      "ForgeCustomerAdapter / ForgeCustomerImportAdapter — authorized customer reads and atomic updates",
      "createBexioContactLinkStore — durable links with database-enforced person uniqueness",
      "BexioHostAdapter — permissions and serialized writes",
    ],
  },
  "projects-drive": {
    title: "Projects–Drive",
    description: "Browse a project's files through the existing Drive client and project scope.",
    adapters: [
      "DriveClient — authenticated file operations",
      "Host scope resolver — project existence and permissions",
      "Host route adapter — folder URLs and navigation",
      "Host rename callback — project name updates",
    ],
  },
};
export const Route = createFileRoute("/connectors/$connector")({
  beforeLoad: ({ params }) => {
    if (!Object.hasOwn(connectors, params.connector)) throw notFound();
  },
  validateSearch: z.object({
    person: z.string().max(200).optional().catch(undefined),
    company: z.string().max(200).optional().catch(undefined),
    section: z.enum(["about", "details"]).optional().catch(undefined),
  }),
  head: ({ match, params }) =>
    showroomHead({
      title: `${connectors[params.connector as keyof typeof connectors]?.title ?? "Connector"} demo`,
      description:
        connectors[params.connector as keyof typeof connectors]?.description ??
        "Explore Forge connectors with mock data.",
      path: match.pathname,
    }),
  component: ConnectorRoute,
});
function ConnectorRoute() {
  const { connector } = Route.useParams();
  return <ConnectorExample key={connector} connector={connector as keyof typeof connectors} />;
}
function ConnectorExample({ connector }: { connector: keyof typeof connectors }) {
  const metadata = connectors[connector];
  const query = Route.useSearch();
  const navigate = Route.useNavigate();
  const base = `/connectors/${connector}`;
  const [fail, setFail] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [bexio] = useState(createCustomersBexioMock);
  const [drive] = useState(createDriveMock);
  const [, refresh] = useState(0);
  const [bexioRevision, setBexioRevision] = useState(0);
  const [syncWarning, setSyncWarning] = useState<string | null>(null);
  const [project, setProject] = useState<Project>({
    id: "portal",
    name: "Customer portal",
    ownerId: "acme",
    status: "production",
    description: "Shared documents for the customer portal.",
  });
  useEffect(() => () => drive.dispose(), [drive]);
  bexio.configure({ fail, readOnly });
  const driveClient = useMemo(
    () =>
      drive.client(
        [
          {
            scope: projectDriveScope(project),
            name: project.name,
            capabilities: {
              upload: !readOnly,
              createFolder: !readOnly,
              rename: !readOnly,
              delete: !readOnly,
              download: true,
              restore: !readOnly,
            },
          },
        ],
        fail,
        "ready",
      ),
    [drive, project, readOnly, fail],
  );
  return (
    <ShowroomPreview
      notice={previewDataNotice}
      controls={
        <div className="space-y-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={fail}
              onChange={(event) => setFail(event.target.checked)}
            />
            Simulate action failures
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={readOnly}
              onChange={(event) => setReadOnly(event.target.checked)}
            />
            Read-only connection
          </label>
          <details>
            <summary className="cursor-pointer font-medium">Adapters and installation</summary>
            <div className="mt-3 space-y-4">
              <p className="font-mono text-xs break-words">
                pnpm dlx shadcn add @forge/{connector}
              </p>
              <ul className="space-y-3">
                {metadata.adapters.map((adapter) => (
                  <li key={adapter}>{adapter}</li>
                ))}
              </ul>
              {connector === "customers-bexio" && (
                <p>
                  Install @forge/customers-bexio-server for the guarded Bexio service. This preview
                  uses in-memory adapters.
                </p>
              )}
              <a
                className="underline underline-offset-4"
                href={`https://github.com/the-factory-forge/forge-registry/blob/main/docs/${connector}.md`}
              >
                Host setup guide
              </a>
            </div>
          </details>
        </div>
      }
    >
      <p className="mb-6 text-sm text-muted-foreground">{metadata.description}</p>
      {connector === "customers-bexio" ? (
        <CustomerDetailPage
          customer={{ ...bexio.customer }}
          section={query.section === "about" ? "about" : "sync"}
          backHref="/?category=Connector"
          sectionHrefs={{
            about: `${base}?section=about`,
            projects: "/en/customers/acme/projects",
            sync: base,
          }}
          linkComponent={ShowroomLink}
          onSave={async (values) => {
            if (readOnly) throw new Error("Read-only customer");
            Object.assign(bexio.customer, values);
            refresh((value) => value + 1);
            setSyncWarning(await bexio.syncSavedCustomer());
          }}
          syncContent={
            <div className="space-y-8">
              <BexioContactLinkCard
                key={bexioRevision}
                customerId={bexio.customer.id}
                actions={bexio.actions}
                canWrite={!readOnly}
                search={{ person: query.person ?? "", company: query.company ?? "" }}
                onSearchChange={(type, value) => {
                  void navigate({
                    search: (previous) => ({ ...previous, [type]: value || undefined }),
                    hash: true,
                    resetScroll: false,
                  });
                }}
                onChanged={() => {
                  setSyncWarning(null);
                  refresh((value) => value + 1);
                }}
              />
              <BexioSyncAllButton
                syncAll={bexio.directoryActions.syncAllContacts}
                canWrite={!readOnly}
                onSynced={() => {
                  setSyncWarning(null);
                  setBexioRevision((value) => value + 1);
                  refresh((value) => value + 1);
                }}
              />
            </div>
          }
        />
      ) : (
        <ProjectDetailPage
          project={project}
          section={query.section === "details" ? "details" : "drive"}
          backHref="/?category=Connector"
          sectionHrefs={{ details: `${base}?section=details`, drive: base }}
          linkComponent={ShowroomLink}
          onSave={async (values) => {
            if (readOnly || fail) throw new Error("Simulated host failure");
            setProject((previous) => ({ ...previous, ...values }));
          }}
          driveContent={
            <ProjectDrive
              project={project}
              client={driveClient}
              transferUpload={drive.transfer}
              parentId={query.folder}
              getFolderHref={(id) => `${base}${id ? `?folder=${encodeURIComponent(id)}` : ""}`}
              linkComponent={ShowroomLink}
              onRenameSpace={
                readOnly
                  ? undefined
                  : async (name) => {
                      if (fail) throw new Error("Simulated host failure");
                      setProject((previous) => ({ ...previous, name }));
                    }
              }
            />
          }
        />
      )}
      {connector === "customers-bexio" && (
        <div className="mt-4 min-h-6 text-sm" aria-live="polite">
          {syncWarning && (
            <p role="alert" className="text-destructive">
              {syncWarning}
            </p>
          )}
        </div>
      )}
    </ShowroomPreview>
  );
}
