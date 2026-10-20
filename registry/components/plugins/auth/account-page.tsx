"use client";

import { Avatar } from "@base-ui/react/avatar";
import { Tabs } from "@base-ui/react/tabs";
import { LoaderCircleIcon } from "lucide-react";
import { useId, useRef, useState, type ReactNode } from "react";

import { ActionToastProvider, useActionToast } from "@/components/action-toast";
import {
  AccountEmailChange,
  type AccountEmailChangeProps,
} from "@/components/plugins/auth/account-email-change";
import { accountLabels, type AccountLabels } from "@/components/plugins/auth/account-labels";
import {
  accountCardClass,
  accountButtonClass,
  accountPrimaryClass,
  accountInputClass,
} from "@/components/plugins/auth/account-styles";
import { cn } from "@/components/utils/cn";

export interface AccountTab {
  id: string;
  label: string;
  content: ReactNode;
}
interface DefaultAccountProps {
  /** Host-selected plugin sections; IDs must be unique and exclude about/security. */
  tabs?: AccountTab[];
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  onChangeEmail?: (email: string) => Promise<void>;
  emailChangeLabels?: AccountEmailChangeProps["labels"];
  onUpdateProfile: (profile: { name: string }) => Promise<void>;
  security: ReactNode;
  content?: never;
}
export type AccountPageProps = {
  user: { id: string; name: string; email: string; image?: string | null; roleLabel?: string };
  /** Host summary, including custom verification details or avatar actions. */
  header?: ReactNode;
  labels?: Partial<AccountLabels>;
  className?: string;
} & (
  | DefaultAccountProps
  | {
      /** Host navigation and routed forms replace the default About/Security panels. */
      content: ReactNode;
      onUpdateProfile?: never;
      security?: never;
    }
);

export function AccountPage(props: AccountPageProps) {
  return (
    <ActionToastProvider closeLabel={props.labels?.close}>
      <AccountPageContent key={props.user.id} {...props} />
    </ActionToastProvider>
  );
}
function AccountPageContent(props: AccountPageProps) {
  const { user, header, labels: overrides, className } = props;
  const labels = { ...accountLabels, ...overrides };
  const initials = (user.name || user.email)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
  return (
    <div className={cn("mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-6", className)}>
      {header ?? (
        <>
          <h1 className="text-2xl font-bold text-foreground">{labels.title}</h1>
          <section className={cn(accountCardClass, "flex flex-wrap items-center gap-4")}>
            <div className="flex min-w-0 items-center gap-4">
              <Avatar.Root className="relative flex size-16 shrink-0 overflow-hidden rounded-full border border-border">
                <Avatar.Image
                  src={user.image ?? undefined}
                  alt={user.name}
                  className="size-full object-cover"
                />
                <Avatar.Fallback className="flex size-full items-center justify-center bg-muted text-xl text-muted-foreground">
                  {initials}
                </Avatar.Fallback>
              </Avatar.Root>
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold">{user.name}</h2>
                <p className="truncate text-sm text-muted-foreground">{user.email}</p>
              </div>
            </div>
            {user.roleLabel && (
              <dl className="ml-auto text-sm">
                <dt className="text-muted-foreground">{labels.role}</dt>
                <dd className="font-medium">{user.roleLabel}</dd>
              </dl>
            )}
          </section>
        </>
      )}
      {"content" in props ? props.content : <DefaultAccountSections {...props} />}
    </div>
  );
}

function DefaultAccountSections({
  user,
  onUpdateProfile,
  security,
  tabs = [],
  activeTab,
  onTabChange,
  onChangeEmail,
  emailChangeLabels,
  labels: overrides,
}: Omit<AccountPageProps, "content"> & DefaultAccountProps) {
  const labels = { ...accountLabels, ...overrides };
  const id = `factory-account-${useId()}`;
  const [name, setName] = useState(user.name);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const lock = useRef(false);
  const notify = useActionToast();
  return (
    <Tabs.Root
      defaultValue="about"
      value={activeTab}
      onValueChange={(value) => onTabChange?.(String(value))}
      className="grid min-w-0 gap-6"
    >
      <div className="border-b border-border/60">
        <Tabs.List aria-label={labels.sections} className="-mb-px flex gap-0 overflow-x-auto">
          {[
            { id: "about", label: labels.about },
            ...tabs,
            { id: "security", label: labels.security },
          ].map((tab) => (
            <Tabs.Tab
              key={tab.id}
              value={tab.id}
              className="relative min-h-11 cursor-pointer border-b-2 border-transparent px-4 text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-active:border-primary data-active:text-primary"
            >
              {tab.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </div>
      <Tabs.Panel value="about">
        <form
          className="grid gap-4"
          aria-busy={pending}
          onSubmit={async (event) => {
            event.preventDefault();
            if (lock.current || !name.trim() || !event.currentTarget.reportValidity()) return;
            lock.current = true;
            setPending(true);
            setFailed(false);
            try {
              await onUpdateProfile({ name: name.trim() });
              notify(labels.saved);
            } catch {
              setFailed(true);
            } finally {
              lock.current = false;
              setPending(false);
            }
          }}
        >
          <section className={accountCardClass}>
            <h2 className="font-semibold">{labels.about}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{labels.aboutDescription}</p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <label htmlFor={`${id}-name`}>{labels.name}</label>
                <input
                  id={`${id}-name`}
                  name="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                  maxLength={200}
                  readOnly={pending}
                  required
                  className={accountInputClass}
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor={`${id}-email`}>{labels.email}</label>
                <input
                  id={`${id}-email`}
                  name="email"
                  type="email"
                  value={user.email}
                  autoComplete="email"
                  readOnly
                  className={cn(accountInputClass, "bg-muted/50 text-muted-foreground")}
                />
              </div>
            </div>
          </section>
          <div className="min-h-5 text-sm text-destructive">
            {failed && <p role="alert">{labels.saveError}</p>}
          </div>
          <button
            type="submit"
            disabled={pending || !name.trim()}
            className={cn(accountButtonClass, accountPrimaryClass, "justify-self-start")}
          >
            {pending && <LoaderCircleIcon className="size-4 animate-spin" aria-hidden="true" />}
            {pending ? labels.saving : labels.save}
          </button>
        </form>
        {onChangeEmail && (
          <AccountEmailChange
            email={user.email}
            onChangeEmail={onChangeEmail}
            labels={emailChangeLabels}
          />
        )}
      </Tabs.Panel>
      {tabs.map((tab) => (
        <Tabs.Panel key={tab.id} value={tab.id} keepMounted className="min-w-0 data-hidden:hidden">
          {tab.content}
        </Tabs.Panel>
      ))}
      <Tabs.Panel value="security" className="min-w-0">
        {security}
      </Tabs.Panel>
    </Tabs.Root>
  );
}
