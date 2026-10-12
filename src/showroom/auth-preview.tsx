"use client";
import { useState } from "react";

import {
  AccessDeniedPage,
  AuthLayout,
  ChangePasswordPage,
  ForgotPasswordForm,
  LoginForm,
  ResetPasswordForm,
  SignOutButton,
  useAuthAction,
} from "@/components/plugins/auth";
import { ShowroomLink, useShowroomParams } from "@/showroom/routing";
import { ShowroomPreview } from "@/showroom/showroom-preview";

type View = "login" | "forgot-password" | "reset-password" | "change-password" | "access-denied";
const destinations = [
  ["login", "Sign in"],
  ["forgot-password", "Forgot password"],
  ["reset-password", "Reset password"],
  ["change-password", "Change password"],
  ["account", "Account and security"],
  ["access-denied", "Access denied"],
];
export function AuthPreview({ view = "login" }: { view?: View }) {
  return <Preview key={view} view={view} />;
}
function Preview({ view }: { view: View }) {
  const { locale } = useShowroomParams();
  const [fail, setFail] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [validLink, setValidLink] = useState(true);
  const [strictPassword, setStrictPassword] = useState(false);
  const [calls, setCalls] = useState(0);
  const [notice, setNotice] = useState("");
  const [verificationStatus, setVerificationStatus] = useState<"success" | "error">();
  const signOutAction = useAuthAction();
  async function perform() {
    setCalls((value) => value + 1);
    await new Promise((resolve) => setTimeout(resolve, 700));
    if (fail) throw new Error("Preview failure");
  }
  const passwordProps = strictPassword
    ? { minLength: 12, maxLength: 16, labels: { passwordHint: "Use 12 to 16 characters." } }
    : {};
  return (
    <ShowroomPreview
      width="full"
      notice="Actions are simulated. No credentials are stored, no session is changed, and no email is sent."
      navigation={
        <nav aria-label="Authentication examples" className="grid gap-3 text-sm">
          {destinations.map(([path, name]) => (
            <ShowroomLink
              key={path}
              href={`/${locale}/${path}`}
              aria-current={path === view ? "page" : undefined}
              className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
            >
              {name}
            </ShowroomLink>
          ))}
        </nav>
      }
      controls={
        view !== "access-denied" && (
          <div className="grid gap-4">
            <label className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={fail}
                onChange={(event) => setFail(event.target.checked)}
              />
              Simulate action failures
            </label>
            {(view === "login" || view === "forgot-password" || view === "reset-password") && (
              <label className="flex gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(event) => setEnabled(event.target.checked)}
                />
                Service available
              </label>
            )}
            {view === "reset-password" && (
              <label className="flex gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={validLink}
                  onChange={(event) => setValidLink(event.target.checked)}
                />
                Valid reset link
              </label>
            )}
            {(view === "reset-password" || view === "change-password") && (
              <label className="flex gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={strictPassword}
                  onChange={(event) => setStrictPassword(event.target.checked)}
                />
                12–16 character password policy
              </label>
            )}
            {view === "login" && (
              <div id="factory-auth-controls" className="grid gap-2">
                <label className="grid gap-2 text-sm">
                  Email verification result
                  <select
                    value={verificationStatus ?? ""}
                    onChange={(event) =>
                      setVerificationStatus(
                        event.target.value === "success"
                          ? "success"
                          : event.target.value === "error"
                            ? "error"
                            : undefined,
                      )
                    }
                  >
                    <option value="">None</option>
                    <option value="success">Verified</option>
                    <option value="error">Invalid or expired link</option>
                  </select>
                </label>
                <SignOutButton
                  pending={signOutAction.pending}
                  disabled={signOutAction.disabled}
                  onClick={() =>
                    void signOutAction.run(async () => {
                      await perform();
                      setNotice("Sign-out callback received. No session was changed.");
                    })
                  }
                />
                {signOutAction.failed && (
                  <p role="alert" className="text-sm text-destructive">
                    Could not sign out. Please try again.
                  </p>
                )}
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              Actions requested: <span data-testid="callback-count">{calls}</span>
            </p>
          </div>
        )
      }
    >
      {view === "access-denied" ? (
        <AccessDeniedPage
          className="showroom-fill"
          homeHref={`/${locale}/login`}
          linkComponent={ShowroomLink}
        />
      ) : (
        <AuthLayout
          className="showroom-fill"
          linkComponent={ShowroomLink}
          siteName="Example workspace"
          homeHref="/"
          labels={{ workspaceTitle: "Your team workspace." }}
        >
          {view === "login" && (
            <LoginForm
              key={verificationStatus ?? "login"}
              defaultEmail={verificationStatus ? "member+verified@example.test" : undefined}
              verificationStatus={verificationStatus}
              enabled={enabled}
              forgotPasswordHref={`/${locale}/forgot-password`}
              linkComponent={ShowroomLink}
              onSignIn={async () => {
                await perform();
                setNotice("Sign-in callback received. No session was created.");
              }}
              onGoogleSignIn={async () => {
                await perform();
                setNotice("Google sign-in callback received. No provider was contacted.");
              }}
            />
          )}
          {view === "forgot-password" && (
            <ForgotPasswordForm
              enabled={enabled}
              loginHref={`/${locale}/login`}
              linkComponent={ShowroomLink}
              onRequestReset={perform}
            />
          )}
          {view === "reset-password" && (
            <ResetPasswordForm
              key={String(validLink)}
              enabled={enabled}
              validLink={validLink}
              loginHref={`/${locale}/login`}
              requestResetHref={`/${locale}/forgot-password`}
              linkComponent={ShowroomLink}
              onResetPassword={perform}
              {...passwordProps}
            />
          )}
          {view === "change-password" && (
            <ChangePasswordPage onChangePassword={perform} {...passwordProps} />
          )}
          {notice && <output className="mt-4 block text-sm">{notice}</output>}
        </AuthLayout>
      )}
    </ShowroomPreview>
  );
}
