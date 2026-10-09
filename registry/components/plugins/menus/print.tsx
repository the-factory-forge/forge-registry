"use client";

import { ArrowLeftIcon, PrinterIcon } from "lucide-react";
import { useEffect, useId, useRef, useState, type ComponentType, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { Image, type ImageProps } from "@/components/image";
import { Link, type LinkProps } from "@/components/link";
import { NativeSelect } from "@/components/native-select";
import { MenuLabelBadge } from "@/components/plugins/menus/label-badge";
import { menusLabels, type MenusLabels } from "@/components/plugins/menus/labels";
import { MenuSpiceBadge } from "@/components/plugins/menus/spice-badge";
import type { MenuViewCategory } from "@/components/plugins/menus/types";
import { cn } from "@/components/utils/cn";

export interface MenuPrintPageProps {
  sections: readonly MenuViewCategory[];
  locale: string;
  currency: string;
  restaurantName: string;
  logo?: Pick<ImageProps, "src" | "alt" | "width" | "height" | "srcSet" | "sizes">;
  initialTitle?: string;
  initialFooter?: string;
  backHref: string;
  linkComponent?: ComponentType<LinkProps>;
  labels?: Partial<MenusLabels>;
  className?: string;
}

const field =
  "min-h-10 w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-base text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";
const button =
  "inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

function PaperPreview({ children, title }: { children: ReactNode; title: string }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [body, setBody] = useState<HTMLElement>();
  useEffect(() => {
    const frame = frameRef.current;
    const target = frame?.contentDocument;
    if (!frame || !target) return;
    // A light class below a dark root cannot undo already-resolved theme variables.
    target.documentElement.className = "light";
    const base = target.createElement("base");
    base.href = document.baseURI;
    target.head.append(base);
    for (const style of document.querySelectorAll('style, link[rel="stylesheet"]'))
      target.head.append(style.cloneNode(true));
    const geometry = target.createElement("style");
    geometry.textContent =
      "html { color-scheme: light; scrollbar-gutter: auto; } body { margin: 0; min-height: 0; height: fit-content; }";
    target.head.append(geometry);
    setBody(target.body);
    const observer = new ResizeObserver(() => {
      frame.style.height = `${Math.ceil(target.body.getBoundingClientRect().height)}px`;
    });
    observer.observe(target.body);
    return () => observer.disconnect();
  }, []);
  return (
    <>
      {body ? createPortal(children, body) : children}
      <iframe
        ref={frameRef}
        title={title}
        data-menu-preview-frame
        className={cn("mx-auto w-full max-w-[210mm] border-0 shadow-md", !body && "hidden")}
      />
    </>
  );
}

export function MenuPrintPage({
  sections,
  locale,
  currency,
  restaurantName,
  logo,
  initialTitle,
  initialFooter = "",
  backHref,
  linkComponent: HostLink = Link,
  labels: overrides,
  className,
}: MenuPrintPageProps) {
  const labels = { ...menusLabels, ...overrides };
  const [paperSize, setPaperSize] = useState<"A4" | "A5">("A4");
  const [title, setTitle] = useState(initialTitle ?? labels.menu);
  const [footer, setFooter] = useState(initialFooter);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const paperRef = useRef<HTMLElement>(null);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const preparing = useRef(false);
  const id = `factory-menu-print-${useId()}`;
  const visibleSections = sections
    .map((section) => ({ ...section, items: section.items.filter((item) => item.visible) }))
    .filter((section) => section.items.length);
  const formatter = new Intl.NumberFormat(locale, { style: "currency", currency });
  const divisor = 10 ** (formatter.resolvedOptions().maximumFractionDigits ?? 2);
  const price = (minor: number) => formatter.format(minor / divisor);

  useEffect(() => () => frameRef.current?.remove(), []);

  async function print() {
    if (preparing.current || !paperRef.current || !visibleSections.length) return;
    preparing.current = true;
    setBusy(true);
    setError(false);
    const trigger = document.activeElement;
    frameRef.current?.remove();
    const frame = document.createElement("iframe");
    frameRef.current = frame;
    frame.title = labels.printMenu;
    frame.setAttribute("aria-hidden", "true");
    frame.setAttribute("data-menu-print-frame", "");
    frame.tabIndex = -1;
    // Keep a rendered document for browser printing without taking layout space.
    frame.style.cssText = "position:fixed;left:-10000px;top:0;width:210mm;height:297mm;border:0";
    document.body.append(frame);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const target = frame.contentDocument;
      const targetWindow = frame.contentWindow;
      if (!target || !targetWindow) throw new Error("Print document unavailable");
      target.documentElement.className = "light";
      target.documentElement.lang = locale;
      target.title = `${restaurantName} - ${title}`;
      const base = target.createElement("base");
      base.href = document.baseURI;
      target.head.append(base);
      const styles = [...document.querySelectorAll('style, link[rel="stylesheet"]')].map(
        (source) => {
          const copy = source.cloneNode(true);
          const loaded = new Promise<void>((resolve, reject) => {
            if (source.tagName === "LINK") {
              copy.addEventListener("load", () => resolve(), { once: true });
              copy.addEventListener("error", () => reject(new Error("Print stylesheet failed")), {
                once: true,
              });
            } else resolve();
          });
          target.head.append(copy);
          return loaded;
        },
      );
      const printStyle = target.createElement("style");
      printStyle.textContent = `
        @page { size: ${paperSize} ${paperSize === "A4" ? "portrait" : "landscape"}; margin: ${paperSize === "A4" ? "12mm" : "10mm"}; }
        html { color-scheme: light; scrollbar-gutter: auto; }
        body { margin: 0; background: var(--background); color: var(--foreground); }
        [data-menu-paper] { width: auto; max-width: none; min-height: 0; margin: 0; padding: 0; border: 0; box-shadow: none; }
        [data-menu-paper] h3 { break-after: avoid; }
        [data-menu-paper] p { orphans: 3; widows: 3; }
      `;
      target.head.append(printStyle);
      target.body.append(paperRef.current.cloneNode(true));
      await Promise.race([
        (async () => {
          await Promise.all(styles);
          target.body.getBoundingClientRect();
          await target.fonts.ready;
          if ([...target.fonts].some((font) => font.status === "error"))
            throw new Error("Print font failed");
          await Promise.all([...target.images].map((image) => image.decode()));
        })(),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error("Print preparation timed out")), 15000);
        }),
      ]);
      if (!frame.isConnected) return;
      targetWindow.addEventListener(
        "afterprint",
        () => {
          frame.remove();
          requestAnimationFrame(() => {
            if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
          });
        },
        { once: true },
      );
      targetWindow.focus();
      targetWindow.print();
    } catch {
      if (frame.isConnected) setError(true);
      frame.remove();
    } finally {
      clearTimeout(timeout);
      preparing.current = false;
      setBusy(false);
    }
  }

  return (
    <section
      className={cn("mx-auto w-full max-w-5xl space-y-6 px-4 py-8 text-foreground", className)}
    >
      <HostLink
        href={backHref}
        className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-md px-3 text-sm font-medium text-foreground transition-colors outline-none hover:bg-primary/5 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring md:min-h-8"
      >
        <ArrowLeftIcon aria-hidden="true" className="size-4 shrink-0" />
        {labels.back}
      </HostLink>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{labels.printMenu}</h1>
        <button
          type="button"
          disabled={busy || !visibleSections.length}
          onClick={() => void print()}
          className={cn(button, "bg-primary text-primary-foreground enabled:hover:bg-primary/90")}
        >
          <PrinterIcon aria-hidden="true" className="size-4 shrink-0" />
          {busy ? labels.preparingPrint : labels.print}
        </button>
      </header>
      <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-[8rem_1fr]">
        <legend className="sr-only">{labels.printSettings}</legend>
        <div className="space-y-2 text-sm font-medium">
          <label className="block" htmlFor={`${id}-size`}>
            {labels.paperSize}
          </label>
          <NativeSelect
            id={`${id}-size`}
            value={paperSize}
            onChange={(event) => setPaperSize(event.target.value === "A5" ? "A5" : "A4")}
            className={field}
          >
            <option value="A4">A4</option>
            <option value="A5">A5</option>
          </NativeSelect>
        </div>
        <div className="space-y-2 text-sm font-medium">
          <label className="block" htmlFor={`${id}-title`}>
            {labels.menuTitle}
          </label>
          <input
            id={`${id}-title`}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className={field}
          />
        </div>
        <div className="space-y-2 text-sm font-medium sm:col-span-2">
          <label className="block" htmlFor={`${id}-footer`}>
            {labels.footerText}
          </label>
          <textarea
            id={`${id}-footer`}
            value={footer}
            onChange={(event) => setFooter(event.target.value)}
            rows={2}
            className={field}
          />
        </div>
      </fieldset>
      <p className="text-sm text-muted-foreground">{labels.printHelp}</p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {labels.printError}
        </p>
      )}
      {!visibleSections.length ? (
        <output className="block">{labels.emptyPrintMenu}</output>
      ) : (
        <section className="min-w-0 bg-muted py-6 sm:px-6" aria-label={labels.printPreview}>
          <PaperPreview title={labels.printPreview}>
            <article
              ref={paperRef}
              data-menu-paper={paperSize}
              lang={locale}
              className={cn(
                "light mx-auto w-[210mm] max-w-full bg-background font-sans text-[11pt] leading-relaxed wrap-anywhere text-foreground [color-scheme:light]",
                paperSize === "A4" ? "min-h-[297mm] p-[12mm]" : "min-h-[148mm] p-[10mm]",
              )}
            >
              <header className="mb-8 break-after-avoid space-y-3 text-center">
                {logo && (
                  <Image
                    {...logo}
                    alt={logo.alt}
                    loading="eager"
                    className="mx-auto h-16 w-auto max-w-full object-contain"
                  />
                )}
                <p className="font-serif text-[24pt] leading-tight font-semibold">
                  {restaurantName}
                </p>
                {title && <h2 className="text-[14pt] whitespace-pre-wrap">{title}</h2>}
              </header>
              {visibleSections.map((section) => (
                <section key={section.id} className="mb-7">
                  <h3 className="mb-4 break-after-avoid border-b border-border pb-2 font-serif text-[16pt] font-semibold">
                    {section.name}
                  </h3>
                  {section.items.map((item) => (
                    <article key={item.id} className="mb-5 break-inside-avoid">
                      <div className="flex items-start justify-between gap-3">
                        <h4 className="min-w-0 font-semibold">{item.name}</h4>
                        {item.soldOut && (
                          <span className="max-w-[45%] shrink-0 rounded-full bg-status-pending px-2 py-0.5 text-[9pt] font-medium text-status-pending-foreground">
                            {labels.soldOut}
                          </span>
                        )}
                        {!item.sizes?.length && !item.soldOut && (
                          <span className="shrink-0 tabular-nums">{price(item.priceMinor)}</span>
                        )}
                      </div>
                      {item.description && (
                        <p className="mt-1 whitespace-pre-wrap">{item.description}</p>
                      )}
                      {item.sizes?.length ? (
                        <dl className="mt-2 space-y-1">
                          {item.sizes.map((size) => (
                            <div key={size.id} className="flex justify-between gap-3">
                              <dt>{size.name}</dt>
                              <dd className="shrink-0 tabular-nums">{price(size.priceMinor)}</dd>
                            </div>
                          ))}
                        </dl>
                      ) : item.soldOut ? (
                        <p className="mt-1 text-right tabular-nums">{price(item.priceMinor)}</p>
                      ) : null}
                      {(item.labels.length > 0 || !!item.spiceLevel) && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {item.labels.map((label) => (
                            <MenuLabelBadge key={label.id} label={label} />
                          ))}
                          {!!item.spiceLevel && (
                            <MenuSpiceBadge level={item.spiceLevel} labels={labels} />
                          )}
                        </div>
                      )}
                    </article>
                  ))}
                </section>
              ))}
              {footer && (
                <footer className="mt-8 border-t border-border pt-4 text-center text-[10pt] whitespace-pre-wrap">
                  {footer}
                </footer>
              )}
            </article>
          </PaperPreview>
        </section>
      )}
    </section>
  );
}
