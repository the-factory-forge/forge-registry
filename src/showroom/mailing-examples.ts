import type { EmailContent, MailingBrand } from "@/components/plugins/mailing/index";

export const mailingBrands = {
  studio: {
    name: "Northstar Studio",
    logoPath: "/showroom/mailing/northstar.png",
    theme: {
      background: "#edf4f5",
      foreground: "#173b43",
      card: "#ffffff",
      cardForeground: "#173b43",
      primary: "#173b43",
      primaryForeground: "#ffffff",
      muted: "#e5eff1",
      mutedForeground: "#46656b",
      border: "#c9dadd",
      fontSans: "Arial, Helvetica, sans-serif",
      fontSerif: "Arial, Helvetica, sans-serif",
    },
  },
  lodge: {
    name: "Pinewood Lodge",
    logoPath: "/showroom/mailing/pinewood.png",
    theme: {
      background: "#f7f1e9",
      foreground: "#483326",
      card: "#fffdf9",
      cardForeground: "#483326",
      primary: "#87452d",
      primaryForeground: "#ffffff",
      muted: "#f1e8dc",
      mutedForeground: "#705c4e",
      border: "#e2d3c1",
      fontSans: "Verdana, Geneva, sans-serif",
      fontSerif: "Georgia, 'Times New Roman', serif",
    },
  },
  corner: {
    name: "The Corner",
    logoPath: "/icon.png",
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
      fontSans: "'Work Sans', Arial, Helvetica, sans-serif",
      fontSerif: "'Work Sans', Arial, Helvetica, sans-serif",
    },
  },
} satisfies Record<string, MailingBrand & { logoPath: string }>;

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
    paragraphs: [
      "Confirm your email address to keep receiving updates about your account.",
      "This verification link expires in 24 hours.",
    ],
    action: { label: "Verify my email", url: "https://example.com/verify?token=demo" },
    footer: "If you weren't expecting this email, you can ignore it.",
  },
  {
    slug: "reset-password",
    group: "Account",
    preview: "Choose a new password for your account.",
    heading: "Reset your password",
    greeting: "Hello Alex,",
    paragraphs: [
      "Follow the link below to choose a new password.",
      "This password-reset link expires in 30 minutes.",
    ],
    action: { label: "Reset my password", url: "https://example.com/reset?token=demo" },
    footer: "If you didn't request this change, you can ignore this email.",
  },
  {
    slug: "invitation",
    group: "Account",
    preview: "Your team has invited you to create an account.",
    heading: "Accept your invitation",
    greeting: "Hello Alex,",
    paragraphs: [
      "Your team has invited you to join its workspace. Set a password to activate your account.",
      "This invitation link expires in 48 hours and can only be used once.",
    ],
    action: { label: "Accept invitation", url: "https://example.com/invitation?token=demo" },
    footer: "If you weren't expecting this invitation, you can ignore it.",
  },
  {
    slug: "email-change",
    group: "Account",
    preview: "Confirm the new email address requested for your account.",
    heading: "Confirm your new email address",
    greeting: "Hello Alex,",
    paragraphs: [
      "You asked to change your account's email address to alex.new@example.com. Confirm this new address to complete the change.",
      "This confirmation link expires in 30 minutes. Your current address stays active until you confirm.",
    ],
    action: { label: "Confirm new address", url: "https://example.com/email-change?token=demo" },
    footer:
      "If you didn't request this change, keep your current address and contact your administrator.",
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
    preview: "Your stay is confirmed for 16–18 October.",
    heading: "Your stay is confirmed",
    greeting: "Hello Alex,",
    paragraphs: ["Your reservation is confirmed. Here are the details of your stay."],
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
