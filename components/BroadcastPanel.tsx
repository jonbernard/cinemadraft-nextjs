'use client';

import { useCallback, useState, useTransition } from 'react';

import { broadcastNotification } from '@/actions/notifications/broadcast';

/**
 * Send one notification to every member (T45).
 *
 * 🔴 This is irreversible from the UI: notification deletion was not rebuilt
 * (R8), so every send is permanent for every recipient. The same standard the
 * relink page was held to — the form states exactly what will go out and to
 * how many people, and nothing sends without a deliberate confirmation naming
 * both.
 */
export function BroadcastPanel({ recipientCount }: { recipientCount: number }) {
  const [message, setMessage] = useState('');
  const [icon, setIcon] = useState('');
  const [link, setLink] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const send = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      const trimmed = message.trim();
      if (trimmed === '') {
        setFeedback('Write a message first.');
        return;
      }

      const people = recipientCount === 1 ? '1 person' : `${recipientCount} people`;
      if (
        !window.confirm(
          `Send "${trimmed}" to ${people}? This cannot be undone or recalled once sent.`,
        )
      ) {
        return;
      }

      setFeedback(null);
      startTransition(async () => {
        const result = await broadcastNotification({
          message: trimmed,
          icon: icon.trim() === '' ? null : icon.trim(),
          link: link.trim() === '' ? null : link.trim(),
        });
        if (!result.ok) {
          setFeedback(result.message);
          return;
        }
        setMessage('');
        setIcon('');
        setLink('');
        setFeedback(
          result.data === 1 ? 'Sent to 1 person.' : `Sent to ${result.data} people.`,
        );
      });
    },
    [message, icon, link, recipientCount],
  );

  return (
    <form onSubmit={send} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-text-dim text-xs">Message</span>
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={3}
          placeholder="What every member will see"
          className="border-border-rule bg-bg-raised text-text-primary w-full border p-3 text-sm"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-text-dim text-xs">Icon (optional)</span>
        <input
          type="text"
          value={icon}
          onChange={(event) => setIcon(event.target.value)}
          className="border-border-rule bg-bg-raised text-text-primary min-h-11 w-full border px-3 text-sm"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-text-dim text-xs">Link (optional)</span>
        <input
          type="text"
          value={link}
          onChange={(event) => setLink(event.target.value)}
          placeholder="/award-shows/asc"
          className="border-border-rule bg-bg-raised text-text-primary min-h-11 w-full border px-3 text-sm"
        />
      </label>

      <p className="text-text-secondary text-sm">
        Sends to every member —{' '}
        {recipientCount === 1 ? '1 person' : `${recipientCount} people`} today. There is
        no way to delete or recall a sent notification.
      </p>

      <button
        type="submit"
        disabled={pending}
        className="bg-accent-fill min-h-11 w-fit px-4 text-sm text-white disabled:opacity-60"
      >
        Send to everyone
      </button>

      <p aria-live="polite" className="text-text-secondary min-h-5 text-sm">
        {pending ? 'Sending…' : (feedback ?? '')}
      </p>
    </form>
  );
}
