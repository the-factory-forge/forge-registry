# Design

Reuse the shared PasswordFormContent for Account Security and existing host page
callers. Render current/new fields with independent visibility; only new passwords
receive the configured length policy. Preserve the submission lock, failed drafts,
accessible errors and form reset. The recovery wrapper forwards only newPassword.

Auth owns the changed files; intranet-sidebar and intranet-shell depend on it.
The RC2 callback remains compatible. Hosts that installed the intervening source
must restore their server-side current-password check. Retain ChangePasswordPage's
export, while removing the showroom route and navigation. Consumers own onboarding
routes, authentication and redirects; this task changes none of those sites.
