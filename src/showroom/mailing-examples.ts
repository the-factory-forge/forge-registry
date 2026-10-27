import type { EmailContent } from "@/components/plugins/mailing/index";

export const mailingExamples: (EmailContent & { slug: string })[] = [
  {
    slug: "verify-email",
    preview: "One more step to confirm your email address.",
    heading: "Verify your email",
    greeting: "Hello Alex,",
    paragraphs: ["Confirm your email address to finish setting up your account."],
    action: { label: "Verify my email", url: "https://example.com/verify?token=demo" },
    footer: "If you weren't expecting this email, you can ignore it.",
  },
  {
    slug: "reset-password",
    preview: "Choose a new password for your account.",
    heading: "Reset your password",
    greeting: "Hello Alex,",
    paragraphs: ["Follow the link below to choose a new password."],
    action: { label: "Reset my password", url: "https://example.com/reset?token=demo" },
    footer: "If you didn't request this change, you can ignore this email.",
  },
  {
    slug: "invitation",
    preview: "You have been invited to create an account.",
    heading: "Accept your invitation",
    greeting: "Hello Alex,",
    paragraphs: ["You have been invited to create an account. Follow the link to get started."],
    action: { label: "Accept invitation", url: "https://example.com/invitation?token=demo" },
    footer: "If you weren't expecting this invitation, you can ignore it.",
  },
  {
    slug: "email-change",
    preview: "Confirm the new email address for your account.",
    heading: "Confirm your new email address",
    greeting: "Hello Alex,",
    paragraphs: ["Confirm this address to use it for your account."],
    action: { label: "Confirm email address", url: "https://example.com/email-change?token=demo" },
    footer: "If you didn't request this change, you can ignore this email.",
  },
  {
    slug: "reservation-confirmation",
    preview: "Your reservation is confirmed.",
    heading: "Your reservation is confirmed",
    greeting: "Hello Alex,",
    paragraphs: ["Your reservation is confirmed. Here are the details."],
    details: [
      { label: "Date", value: "16 October 2026" },
      { label: "Time", value: "10:00–11:00" },
      { label: "Time zone", value: "Europe/Zurich" },
    ],
    action: { label: "View my reservation", url: "https://example.com/reservations" },
    footer: "Keep this email for your reservation details.",
  },
];
