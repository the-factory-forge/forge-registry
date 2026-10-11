import { Fragment } from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "react-email";

import type { EmailContent, MailingBrand, MailingTheme } from "./index";

const defaultTheme: MailingTheme = {
  background: "#f4f7f7",
  foreground: "#13343a",
  card: "#ffffff",
  cardForeground: "#13343a",
  primary: "#13343a",
  primaryForeground: "#ffffff",
  muted: "#edf4f4",
  mutedForeground: "#486266",
  border: "#dbe5e5",
  fontSans: "Arial, Helvetica, sans-serif",
  fontSerif: "Georgia, 'Times New Roman', serif",
};

function httpUrl(value: string) {
  const url = new URL(value);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password)
    throw new Error("Email links and images require an absolute HTTP(S) URL without credentials.");
  return value;
}

export function TransactionalEmail({ brand, ...content }: EmailContent & { brand: MailingBrand }) {
  const theme = { ...defaultTheme, ...brand.theme };
  const actionUrl = content.action ? httpUrl(content.action.url) : undefined;
  const logoUrl = brand.logoUrl ? httpUrl(brand.logoUrl) : undefined;
  const paragraphStyle = { margin: "0 0 20px", fontSize: "16px", lineHeight: "26px" };
  return (
    <Html lang={content.locale ?? "en"}>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light" />
        <title>{content.heading}</title>
      </Head>
      <Body
        lang={content.locale ?? "en"}
        style={{
          margin: 0,
          padding: "32px 12px",
          backgroundColor: theme.background,
          color: theme.foreground,
          fontFamily: theme.fontSans,
        }}
      >
        <Preview useTitleTag={false}>{content.preview}</Preview>
        <Container
          style={{
            maxWidth: "520px",
            backgroundColor: theme.card,
            color: theme.cardForeground,
            border: `1px solid ${theme.border}`,
            borderRadius: "12px",
          }}
        >
          <Section
            style={{ padding: "32px 24px", overflowWrap: "anywhere", wordBreak: "break-word" }}
          >
            <Section style={{ textAlign: "center", marginBottom: "32px" }}>
              {logoUrl && (
                <Img
                  src={logoUrl}
                  alt=""
                  width="64"
                  height="64"
                  style={{
                    display: "block",
                    margin: "0 auto 16px",
                    border: 0,
                    objectFit: "contain",
                  }}
                />
              )}
              <Text style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>{brand.name}</Text>
            </Section>
            <Heading
              as="h1"
              style={{
                margin: "0 0 28px",
                fontFamily: theme.fontSerif,
                fontSize: "28px",
                lineHeight: "36px",
                fontWeight: 600,
                textAlign: "center",
              }}
            >
              {content.heading}
            </Heading>
            {[...(content.greeting ? [content.greeting] : []), ...content.paragraphs].map(
              (paragraph, index) => (
                <Text key={index} style={paragraphStyle}>
                  {paragraph.split("\n").map((line, lineIndex) => (
                    <Fragment key={lineIndex}>
                      {lineIndex > 0 && <br />}
                      {line}
                    </Fragment>
                  ))}
                </Text>
              ),
            )}
            {!!content.details?.length && (
              <Section
                style={{
                  margin: "8px 0 28px",
                  padding: "20px",
                  backgroundColor: theme.muted,
                  borderRadius: "8px",
                }}
              >
                <table width="100%" cellPadding="0" cellSpacing="0">
                  <tbody>
                    {content.details.map(({ label, value }, index) => (
                      <tr key={index}>
                        <th
                          scope="row"
                          align="left"
                          style={{
                            padding: "6px 16px 6px 0",
                            verticalAlign: "top",
                            fontSize: "14px",
                            lineHeight: "22px",
                            fontWeight: 400,
                            color: theme.mutedForeground,
                          }}
                        >
                          {label}
                        </th>
                        <td
                          align="right"
                          style={{
                            padding: "6px 0",
                            verticalAlign: "top",
                            fontSize: "14px",
                            lineHeight: "22px",
                            fontWeight: 600,
                          }}
                        >
                          {value}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>
            )}
            {content.action && (
              <>
                <Section style={{ textAlign: "center", margin: "4px 0 24px" }}>
                  <Button
                    href={actionUrl}
                    style={{
                      padding: "14px 24px",
                      backgroundColor: theme.primary,
                      color: theme.primaryForeground,
                      fontSize: "16px",
                      lineHeight: "24px",
                      fontWeight: 600,
                      textDecoration: "none",
                      borderRadius: "6px",
                    }}
                  >
                    {content.action.label}
                  </Button>
                </Section>
                <Text
                  style={{
                    margin: "0 0 24px",
                    fontSize: "12px",
                    lineHeight: "20px",
                    wordBreak: "break-all",
                  }}
                >
                  <Link
                    href={actionUrl}
                    style={{ color: theme.mutedForeground, textDecoration: "underline" }}
                  >
                    {content.action.url}
                  </Link>
                </Text>
              </>
            )}
            {content.footer && (
              <Text
                style={{
                  margin: "28px 0 0",
                  paddingTop: "20px",
                  borderTop: `1px solid ${theme.border}`,
                  color: theme.mutedForeground,
                  fontSize: "12px",
                  lineHeight: "20px",
                }}
              >
                {content.footer}
              </Text>
            )}
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
