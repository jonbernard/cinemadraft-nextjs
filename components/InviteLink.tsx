'use client';

import { useCallback, useState } from 'react';

import { cn } from '@/lib/utils/cn';

/**
 * The invite link, with a copy button.
 *
 * The link is the join credential — holding it is what lets someone seat
 * themselves — so it is shown only to owners, and the value is visible rather
 * than hidden behind the button alone: someone on a phone with a clipboard
 * that misbehaves still needs to be able to select it.
 *
 * The confirmation is a live region rather than a toast, because a toast that
 * appears beside the thing you just clicked is a second place to look for an
 * answer to a question you already asked.
 */
export function InviteLink({ url, className }: { url: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      // Long enough to read, short enough that it is gone before the next
      // interaction.
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // A clipboard the browser refuses is why the value is on screen.
      setCopied(false);
    }
  }, [url]);

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <code className="border-border-rule bg-bg-raised text-text-secondary min-w-0 flex-1 overflow-x-auto border px-3 py-2 font-mono text-xs">
          {url}
        </code>
        <button
          type="button"
          onClick={copy}
          className="border-border-rule text-text-primary hover:bg-bg-raised focus-visible:outline-accent-fill flex min-h-11 items-center border px-4 text-sm focus-visible:outline-2"
        >
          Copy
        </button>
      </div>

      <p aria-live="polite" className="text-text-secondary min-h-5 text-xs">
        {copied ? 'Copied. Send it to whoever is playing.' : ''}
      </p>
    </div>
  );
}
