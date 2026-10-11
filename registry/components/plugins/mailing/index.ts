import { createElement } from "react";
import { render } from "react-email";

import { TransactionalEmail } from "./transactional-email";

export { TransactionalEmail } from "./transactional-email";

export interface MailingTheme {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  primary: string;
  primaryForeground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  fontSans: string;
  fontSerif: string;
}

export interface MailingBrand {
  name: string;
  logoUrl?: string;
  /** Concrete email-safe values for the host's semantic roles, not CSS variables. */
  theme?: Partial<MailingTheme>;
}

export interface EmailContent {
  locale?: string;
  preview: string;
  heading: string;
  greeting?: string;
  paragraphs: string[];
  details?: { label: string; value: string }[];
  action?: { label: string; url: string };
  footer?: string;
}

export interface RenderedEmail {
  html: string;
  text: string;
}

/** React Email renders HTML; the text alternative preserves the host's copy and labels. */
export async function renderEmail(
  content: EmailContent & { brand: MailingBrand },
): Promise<RenderedEmail> {
  const html = await render(createElement(TransactionalEmail, content));
  const { brand } = content;
  const text = [
    brand.name,
    content.heading,
    content.greeting,
    ...content.paragraphs,
    content.details?.map(({ label, value }) => `${label}: ${value}`).join("\n"),
    content.action && `${content.action.label}\n${content.action.url}`,
    content.footer,
  ]
    .filter(Boolean)
    .join("\n\n");
  return { html, text };
}
