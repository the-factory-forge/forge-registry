import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_supports")({ component: Outlet });
