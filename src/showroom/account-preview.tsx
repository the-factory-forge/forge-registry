"use client";

import { useState } from "react";

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
  const [name, setName] = useState("Alex Morgan");
  const [keys, setKeys] = useState(initialKeys);
  const [sessions, setSessions] = useState(initialSessions);
  const [fail, setFail] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [credential, setCredential] = useState(false);
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
      navigation={<ShowroomLink href={`/${locale}/auth`}>Authentication examples</ShowroomLink>}
      controls={
        <div className="grid gap-4 text-sm">
          <label className="flex gap-2">
            <input type="checkbox" checked={fail} onChange={(e) => setFail(e.target.checked)} />
            Simulate action failures
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
          <p>
            Actions requested: <span data-testid="callback-count">{calls}</span>
          </p>
        </div>
      }
    >
      <AccountPage
        user={{ id: "preview", name, email: "alex@example.com", roleLabel: "Member" }}
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
                onCreate={async (values) => {
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
                }}
                onDelete={async (id) => {
                  await perform();
                  setKeys((values) => values.filter((value) => value.id !== id));
                }}
              />
            }
          />
        }
      />
    </ShowroomPreview>
  );
}
