"use client";
import { useState } from "react";

import { LoginForm } from "@/components/plugins/login";
import { AuthLayout } from "@/components/plugins/login/auth-layout";

export function LoginPreview() {
  const [fail, setFail] = useState(false);
  const [notice, setNotice] = useState("");
  return (
    <AuthLayout
      siteName="Example workspace"
      homeHref="/"
      labels={{ workspaceTitle: "Your team workspace." }}
    >
      <label className="mb-4 flex gap-2 text-sm">
        <input type="checkbox" checked={fail} onChange={(event) => setFail(event.target.checked)} />
        Simulate sign-in failure
      </label>
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
