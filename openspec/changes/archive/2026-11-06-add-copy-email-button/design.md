## Context

TC's ProfileSummaryCard shows a CopyIcon beside the email and reports Clipboard API success or failure with Sonner. No equivalent standalone registry control exists; ShareButton also invokes native sharing and combines text with a URL.

## Goals / Non-Goals

Promote only exact email copying, keyboard access, tooltip and feedback. Preserve TC layouts, field ownership and routing. Do not add a profile plugin, generic clipboard toolkit, permission preflight or deprecated clipboard fallback.

## Decisions

CopyEmailButton accepts an email, three translated labels and an optional className. It uses a native button, the shared action button classes, IconTooltip and the Base UI toast manager under the host's existing ActionToastProvider. An empty email disables the action; rejected or missing clipboard access reports the existing manual-copy fallback. Only explicit user activation writes to the clipboard.

The item declares Base UI, Lucide and its complete action-toast/icon-tooltip/cn closure. Source installs at @components/copy-email-button.tsx. The new standalone item has no reverse dependencies. TC already satisfies the acceptance behavior and retains its house Button, Sonner and current header rather than receiving a duplicate implementation.

## Risks / Trade-offs

Clipboard access may be unavailable or denied; the visible email remains available for manual copying. Consumers must provide the shared toast provider and translations. Source publication does not update existing websites.
