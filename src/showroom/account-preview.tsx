"use client";

import { useSearch, useNavigate } from "@tanstack/react-router";
import { UserRoundIcon } from "lucide-react";
import { useState } from "react";

import { IntranetShell } from "@/components/layouts/intranet-shell";
import {
  AccountPage,
  AccountSecurity,
  AgentKeys,
  ChangePasswordForm,
  type AgentKey,
} from "@/components/plugins/auth";
import { ShowroomLink, useShowroomParams } from "@/showroom/routing";
import { ShowroomPreview } from "@/showroom/showroom-preview";

const initialKeys: AgentKey[] = [
  {
    id: "old",
    name: "Expired integration",
    createdAt: "2025-01-01T12:00:00Z",
    lastUsedAt: null,
    expiresAt: "2025-02-01T12:00:00Z",
    expired: true,
  },
  {
    id: "reporting",
    name: "Reporting integration",
    createdAt: "2026-10-01T12:00:00Z",
    lastUsedAt: null,
    expiresAt: "2026-11-01T12:00:00Z",
    expired: false,
  },
];
const initialSessions = [true, false].map((current) => ({
  id: current ? "current" : "other",
  current,
  userAgent: current ? "Current browser" : "Firefox on another device",
  ipAddress: "192.0.2.1",
  createdAt: "2026-01-01T12:00:00Z",
  expiresAt: "2027-01-01T12:00:00Z",
}));
export function AccountPreview() {
  const { locale } = useShowroomParams();
  const search = useSearch({ strict: false }) as { tab?: string };
  const navigate = useNavigate();
  const activeTab = ["about", "employee", "customer", "security"].includes(search.tab ?? "")
    ? search.tab!
    : "about";

  const [name, setName] = useState("Alex Morgan");
  const [keys, setKeys] = useState(initialKeys);
  const [sessions, setSessions] = useState(initialSessions);
  const [fail, setFail] = useState(false);
  const [failKeyDelete, setFailKeyDelete] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [credential, setCredential] = useState(false);
  const [custom, setCustom] = useState(false);
  const [canCreate, setCanCreate] = useState(true);
  const [calls, setCalls] = useState(0);
  async function perform() {
    setCalls((value) => value + 1);
    await new Promise((resolve) => setTimeout(resolve, 700));
    if (fail) throw new Error("Preview failure");
  }
  return (
    <ShowroomPreview
      width="full"
      notice="Actions are simulated. No real key, account, email or session is changed."
      navigation={<ShowroomLink href={`/${locale}/login`}>Authentication examples</ShowroomLink>}
      controls={
        <div className="grid gap-4 text-sm">
          <label className="flex gap-2">
            <input type="checkbox" checked={fail} onChange={(e) => setFail(e.target.checked)} />
            Simulate action failures
          </label>
          <label className="flex gap-2">
            <input
              type="checkbox"
              checked={failKeyDelete}
              onChange={(e) => setFailKeyDelete(e.target.checked)}
            />
            Fail expired key deletion
          </label>
          <label className="flex gap-2">
            <input
              type="checkbox"
              checked={unavailable}
              onChange={(e) => setUnavailable(e.target.checked)}
            />
            Simulate load failure
          </label>
          <label className="flex gap-2">
            <input
              type="checkbox"
              checked={credential}
              onChange={(e) => setCredential(e.target.checked)}
            />
            Email and password account
          </label>
          <label className="flex gap-2">
            <input type="checkbox" checked={custom} onChange={(e) => setCustom(e.target.checked)} />
            Host profile content
          </label>
          <label className="flex gap-2">
            <input
              type="checkbox"
              checked={canCreate}
              onChange={(e) => setCanCreate(e.target.checked)}
            />
            Allow key creation
          </label>
          <p>
            Actions requested: <span data-testid="callback-count">{calls}</span>
          </p>
        </div>
      }
    >
      <IntranetShell
        brand={{ name: "Acme workspace", href: `/${locale}/account` }}
        user={{ name, email: "alex@example.com" }}
        pathname={`/${locale}/account`}
        profileHref={`/${locale}/account`}
        linkComponent={ShowroomLink}
        onSignOut={perform}
        groups={[
          {
            id: "account",
            items: [
              {
                id: "profile",
                label: "Profile settings",
                href: `/${locale}/account`,
                exact: true,
                icon: <UserRoundIcon />,
              },
            ],
          },
        ]}
        contentClassName="showroom-inset"
      >
        {custom ? (
          <AccountPage
            user={{ id: "custom", name, email: "alex@example.com" }}
            header={<h1 className="text-xl font-semibold">Host profile summary</h1>}
            content={
              <>
                <nav aria-label="Custom profile sections">
                  <ShowroomLink href={`/${locale}/account`}>Profile details</ShowroomLink>
                </nav>
                <label className="grid gap-2">
                  Company name
                  <input
                    className="rounded border border-input p-2"
                    defaultValue="Example company"
                  />
                </label>
              </>
            }
          />
        ) : (
          <AccountPage
            user={{ id: "preview", name, email: "alex@example.com", roleLabel: "Member" }}
            activeTab={activeTab}
            onTabChange={(tab) =>
              navigate({
                href: `/${locale}/account${tab === "about" ? "" : `?tab=${tab}`}`,
                resetScroll: false,
              })
            }
            tabs={[
              {
                id: "employee",
                label: "Employee",
                content: <p>The host supplies employee account fields here.</p>,
              },
              {
                id: "customer",
                label: "Customer",
                content: (
                  <p className="text-sm text-muted-foreground">
                    The host supplies customer-specific account fields here.
                  </p>
                ),
              },
            ]}
            onUpdateProfile={async (values) => {
              await perform();
              setName(values.name);
            }}
            security={
              <AccountSecurity
                key={String(credential)}
                email="alex@example.com"
                locale={locale}
                error={unavailable}
                data={
                  unavailable
                    ? undefined
                    : {
                        signInMethod: credential ? "credential" : "github",
                        providers: [credential ? "credential" : "github"],
                        sessions,
                      }
                }
                onRetry={() => setUnavailable(false)}
                onRequestPasswordReset={perform}
                onRevokeSession={async (id) => {
                  await perform();
                  setSessions((values) => values.filter((value) => value.id !== id));
                }}
                passwordForm={<ChangePasswordForm onChangePassword={perform} />}
                agentKeys={
                  <AgentKeys
                    locale={locale}
                    keys={unavailable ? undefined : keys}
                    error={unavailable}
                    onRetry={() => setUnavailable(false)}
                    onCreate={
                      canCreate
                        ? async (values) => {
                            await perform();
                            setKeys((existing) => [
                              ...existing,
                              {
                                ...values,
                                id: crypto.randomUUID(),
                                createdAt: new Date(),
                                lastUsedAt: null,
                                expired: false,
                              },
                            ]);
                            return { token: "forge_key_preview_only_not_a_real_credential" };
                          }
                        : undefined
                    }
                    onDelete={async (id) => {
                      await perform();
                      if (failKeyDelete && id === "old")
                        throw new Error("Preview deletion failure");
                      setKeys((values) => values.filter((value) => value.id !== id));
                    }}
                  />
                }
              />
            }
          />
        )}
      </IntranetShell>
    </ShowroomPreview>
  );
}
