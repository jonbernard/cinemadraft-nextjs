'use client';

import { useCallback, useId, useState, useTransition } from 'react';

import type { ActionResult } from '@/actions/result';
import { cn } from '@/lib/utils/cn';
import { Button } from './Button';

export type PostFeedItem = (input: { message: string }) => Promise<ActionResult<null>>;

/**
 * Post a line to your own feed (P10.T41).
 *
 * The action arrives as a prop, like `ReviewForm`'s: a component that reaches
 * for a Server Action by name cannot be rendered in a test or a story.
 */
export function FeedComposer({
  onPost,
  className,
}: {
  onPost: PostFeedItem;
  className?: string;
}) {
  const fieldId = useId();
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(event.target.value);
  }, []);

  const submit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      setStatus(null);

      startTransition(async () => {
        const result = await onPost({ message });
        if (!result.ok) {
          setStatus(result.message);
          return;
        }
        setMessage('');
        setStatus('Posted');
      });
    },
    [message, onPost],
  );

  return (
    <form onSubmit={submit} className={cn('flex flex-col gap-3', className)}>
      <label className="flex flex-col gap-2" htmlFor={fieldId}>
        <span className="text-text-primary text-sm">Say something on your profile</span>
        <textarea
          id={fieldId}
          value={message}
          onChange={onChange}
          rows={3}
          maxLength={2000}
          disabled={pending}
          placeholder="What are you watching?"
          className="border-border-rule bg-bg-raised text-text-primary focus-visible:outline-accent-fill font-prose w-full rounded-sm border px-3 py-2 text-base leading-relaxed focus-visible:outline-2"
        />
      </label>

      <p aria-live="polite" className="text-text-secondary min-h-5 text-sm">
        {status}
      </p>

      <div>
        <Button type="submit" disabled={pending || message.trim() === ''}>
          {pending ? 'Posting…' : 'Post'}
        </Button>
      </div>
    </form>
  );
}
