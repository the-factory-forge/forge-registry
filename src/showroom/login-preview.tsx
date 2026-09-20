"use client";
import { useState } from "react";

import { LoginForm } from "@/components/plugins/login";
import { AuthLayout } from "@/components/plugins/login/auth-layout";
import { PreviewControls } from "@/showroom/preview-controls";

export function LoginPreview() {
  const [fail, setFail] = useState(false);
  const [notice, setNotice] = useState("");
  return (
    <AuthLayout
      className="min-h-[calc(100svh-var(--showroom-header-height))]"
      siteName="Example workspace"
      homeHref="/"
      labels={{ workspaceTitle: "Your team workspace." }}
    >
      <PreviewControls className="mb-6">
        <label className="flex gap-2 text-sm">
          <input
            type="checkbox"
            checked={fail}
            onChange={(event) => setFail(event.target.checked)}
          />
          Simulate sign-in failure
        </label>
      </PreviewControls>
      <LoginForm
        onSignIn={async () => {
          if (fail) throw new Error("Preview failure");
          setNotice("Sign-in callback received. No session was created.");
        }}
        socialProviders={[
          {
            id: "example",
            label: "Continue with example provider",
            onSignIn: async () => {
              if (fail) throw new Error("Preview failure");
              setNotice("Social sign-in callback received. No provider was contacted.");
            },
          },
        ]}
      />
      {notice && <output className="mt-4 block text-sm">{notice}</output>}
    </AuthLayout>
  );
}
