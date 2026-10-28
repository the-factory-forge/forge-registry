import type { EmailContent, MailingBrand } from "@/components/plugins/mailing/index";

// Email documents need concrete values from the showroom's light theme.
export const mailingBrand = {
  name: "The Corner Factory",
  theme: {
    background: "#ffffff",
    foreground: "#000000",
    card: "#ffffff",
    cardForeground: "#000000",
    primary: "#13343a",
    primaryForeground: "#ffffff",
    muted: "#ffffff",
    mutedForeground: "#616161",
    border: "#d1d1d1",
    fontSans: "Montserrat, Inter, 'Helvetica Neue', Arial, sans-serif",
    fontSerif: "Montserrat, Inter, 'Helvetica Neue', Arial, sans-serif",
  },
} satisfies MailingBrand;

const stayDetails = [
  { label: "Service", value: "Woodland cabin" },
  { label: "Arrival", value: "16 October 2026, 16:00" },
  { label: "Departure", value: "18 October 2026, 10:00" },
  { label: "Nights", value: "2" },
  { label: "Time zone", value: "Europe/Zurich" },
];
const manageStay = {
  label: "Manage my reservation",
  url: "https://example.com/reservations/manage?key=demo",
};

export const mailingExamples: (EmailContent & {
  slug: string;
  group: "Account" | "Reservations";
})[] = [
  {
    slug: "verify-email",
    group: "Account",
    preview: "One more step to confirm your email address.",
    heading: "Verify your email",
    greeting: "Hello Alex,",
    paragraphs: ["Confirm your email address to finish setting up your account."],
    action: { label: "Verify my email", url: "https://example.com/verify?token=demo" },
    footer: "If you weren't expecting this email, you can ignore it.",
  },
  {
    slug: "reset-password",
    group: "Account",
    preview: "Choose a new password for your account.",
    heading: "Reset your password",
    greeting: "Hello Alex,",
    paragraphs: ["Follow the link below to choose a new password."],
    action: { label: "Reset my password", url: "https://example.com/reset?token=demo" },
    footer: "If you didn't request this change, you can ignore this email.",
  },
  {
    slug: "invitation",
    group: "Account",
    preview: "You have been invited to create an account.",
    heading: "Accept your invitation",
    greeting: "Hello Alex,",
    paragraphs: ["You have been invited to create an account. Follow the link to get started."],
    action: { label: "Accept invitation", url: "https://example.com/invitation?token=demo" },
    footer: "If you weren't expecting this invitation, you can ignore it.",
  },
  {
    slug: "email-change",
    group: "Account",
    preview: "Confirm the new email address for your account.",
    heading: "Confirm your new email address",
    greeting: "Hello Alex,",
    paragraphs: ["Confirm this address to use it for your account."],
    action: { label: "Confirm email address", url: "https://example.com/email-change?token=demo" },
    footer: "If you didn't request this change, you can ignore this email.",
  },
  {
    slug: "reservation-booked",
    group: "Reservations",
    preview: "Your reservation request is waiting for approval.",
    heading: "Your request is received",
    greeting: "Hello Alex,",
    paragraphs: [
      "We received your reservation request. Your stay is not confirmed yet; we will email you after reviewing it.",
    ],
    details: [...stayDetails, { label: "Status", value: "Pending approval" }],
    action: manageStay,
    footer: "Use your private management link to check the request or cancel it.",
  },
  {
    slug: "reservation-confirmation",
    group: "Reservations",
    preview: "Your reservation is confirmed.",
    heading: "Your reservation is confirmed",
    greeting: "Hello Alex,",
    paragraphs: ["Your reservation is confirmed. Here are the details."],
    details: [...stayDetails, { label: "Status", value: "Confirmed" }],
    action: { label: "View my reservation", url: "https://example.com/reservations" },
    footer: "Keep this email for your reservation details.",
  },
  {
    slug: "reservation-rescheduled",
    group: "Reservations",
    preview: "Your reservation now runs from 23 to 25 October.",
    heading: "Your stay has been rescheduled",
    greeting: "Hello Alex,",
    paragraphs: ["Your previous dates, 16–18 October, have been replaced by the dates below."],
    details: [
      { label: "Service", value: "Woodland cabin" },
      { label: "Arrival", value: "23 October 2026, 16:00" },
      { label: "Departure", value: "25 October 2026, 10:00" },
      { label: "Nights", value: "2" },
      { label: "Time zone", value: "Europe/Zurich" },
      { label: "Status", value: "Confirmed" },
    ],
    action: manageStay,
    footer: "Use these updated dates when planning your stay.",
  },
  {
    slug: "reservation-rejected",
    group: "Reservations",
    preview: "We could not approve your reservation request.",
    heading: "Your request was not approved",
    greeting: "Hello Alex,",
    paragraphs: [
      "We could not approve your request for the dates below. No stay is confirmed for this request.",
    ],
    details: [...stayDetails, { label: "Status", value: "Rejected" }],
    action: manageStay,
    footer: "Contact the team if you would like to discuss another date.",
  },
  {
    slug: "reservation-cancelled",
    group: "Reservations",
    preview: "Your reservation has been cancelled.",
    heading: "Your stay has been cancelled",
    greeting: "Hello Alex,",
    paragraphs: [
      "Your reservation for the dates below is cancelled. You do not need to take any further action.",
    ],
    details: [...stayDetails, { label: "Status", value: "Cancelled" }],
    action: manageStay,
    footer: "Keep this email as confirmation of the cancellation.",
  },
  {
    slug: "reservation-link",
    group: "Reservations",
    preview: "Here is the private management link you requested.",
    heading: "Your reservation management link",
    greeting: "Hello Alex,",
    paragraphs: [
      "You requested access to your existing reservation. Use this private link to view or manage it; this email does not create a new booking.",
    ],
    details: [...stayDetails, { label: "Status", value: "Confirmed" }],
    action: manageStay,
    footer: "Keep this link private. If you didn't request it, you can ignore this email.",
  },
];
