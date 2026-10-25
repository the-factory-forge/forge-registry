"use client";

import { useRouterState } from "@tanstack/react-router";

import { LoadingIndicator, useLoadingActivity } from "@/components/loading-indicator";

const loadingLabels: Record<string, string> = {
  en: "Loading…",
  fr: "Chargement…",
  de: "Wird geladen…",
  it: "Caricamento…",
};

export function ShowroomLoading() {
  const { pending, locale } = useRouterState({
    select: (state) => ({
      pending: state.status === "pending",
      locale: state.location.pathname.split("/")[1],
    }),
  });
  useLoadingActivity(pending);
  return (
    <LoadingIndicator
      label={loadingLabels[locale] ?? loadingLabels.en}
      className="top-(--showroom-header-height)"
    />
  );
}
