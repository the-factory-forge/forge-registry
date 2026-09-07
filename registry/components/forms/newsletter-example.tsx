"use client";

import * as React from "react";

import { Newsletter } from "@/components/forge/forms/newsletter";

export function NewsletterExample() {
  const [loading, setLoading] = React.useState(false);
  const [successMessage, setSuccessMessage] = React.useState<string>();
  const [errorMessage, setErrorMessage] = React.useState<string>();

  async function handleSubmit(email: string) {
    setLoading(true);
    setSuccessMessage(undefined);
    setErrorMessage(undefined);

    try {
      await new Promise((resolve) => setTimeout(resolve, 600));
      setSuccessMessage(`Thanks for subscribing, ${email}!`);
    } catch {
      setErrorMessage("Could not subscribe right now. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Newsletter
      eyebrow="Newsletter"
      title="Build better products"
      description="A monthly digest with experiments, release notes, and UX insights."
      placeholder="name@company.com"
      buttonLabel="Join now"
      privacyText="No spam. Unsubscribe any time."
      loading={loading}
      successMessage={successMessage}
      errorMessage={errorMessage}
      onSubmit={handleSubmit}
    />
  );
}
