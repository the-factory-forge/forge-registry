"use client";

import { Share2, Check } from "lucide-react";
import { useState, useRef } from "react";

import { cn } from "@/lib/forge/utils";

export interface ShareButtonProps {
  title: string;
  text: string;
  shareLabel?: string;
  copiedLabel?: string;
  url?: string;
  className?: string;
}

export function ShareButton({
  title,
  text,
  shareLabel = "Share",
  copiedLabel = "Link copied",
  url,
  className,
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const sharing = useRef(false);

  const handleShare = async () => {
    if (sharing.current) return;
    sharing.current = true;

    const shareUrl = url ?? window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({ title, text, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(`${text} : ${shareUrl}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      /* user cancelled — ignore */
    } finally {
      sharing.current = false;
    }
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      className={cn(
        "inline-flex items-center gap-2 text-sm font-semibold text-primary transition-colors hover:text-primary/80",
        className,
      )}
    >
      {copied ? (
        <>
          <Check className="h-4 w-4" />
          {copiedLabel}
        </>
      ) : (
        <>
          <Share2 className="h-4 w-4" />
          {shareLabel}
        </>
      )}
    </button>
  );
}
