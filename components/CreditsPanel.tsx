import { LetterboxRule } from '@/components/LetterboxRule';
import { cn } from '@/lib/utils/cn';

export type CreditPerson = { name: string; job: string };
export type CreditDepartment = { department: string; people: CreditPerson[] };

/** How many names show before the reader has to ask for the rest. */
const VISIBLE = 4;

/**
 * Who made the film, grouped by department.
 *
 * 🔴 **Native `<details>` rather than the source's `+ More` button.** The source
 * held a visible-count in `useState` and grew it four at a time
 * (`src/pages/movie/credits.js:88`), which cost three things: the hidden names
 * were absent from the DOM so **find-in-page could not reach them**, the control
 * was a button with no expanded state for a screen reader, and it needed a
 * client component for what the platform does natively. `<details>` gives the
 * disclosure semantics, keyboard operation and find-in-page for free — and a
 * "Crew" department with 62 entries is exactly what find-in-page is for.
 *
 * It also means this whole panel is a **server component**. Nothing here is
 * interactive in a way React has to know about.
 *
 * Each person keeps their exact job — "Second Unit Director", "Script
 * Supervisor" — because that specificity is the reason the panel is worth
 * reading. Flattening to a department name would leave twenty-seven people
 * listed under "Art" with nothing distinguishing them.
 */
export function CreditsPanel({ departments }: { departments: CreditDepartment[] }) {
  if (departments.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      <LetterboxRule as="h2">Credits</LetterboxRule>

      <div className="flex flex-col gap-4">
        {departments.map((group) => (
          <Department key={group.department} group={group} />
        ))}
      </div>
    </section>
  );
}

function Department({ group }: { group: CreditDepartment }) {
  const visible = group.people.slice(0, VISIBLE);
  const hidden = group.people.slice(VISIBLE);

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-text-secondary text-xs uppercase tracking-wide">
        {group.department}
      </h3>

      <CreditList people={visible} />

      {hidden.length > 0 ? (
        <details className="group">
          {/* `list-none` on the marker and a written +/− instead: the native
              triangle is inconsistent across browsers and cannot be aligned
              with the type. The summary is still the real control. */}
          <summary className="text-accent-text focus-visible:outline-accent-fill flex min-h-11 cursor-pointer list-none items-center text-sm focus-visible:outline-2 [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">
              Show {hidden.length} more in {group.department}
            </span>
            <span className="hidden group-open:inline">Show fewer</span>
          </summary>

          <CreditList people={hidden} className="mt-1" />
        </details>
      ) : null}
    </div>
  );
}

/**
 * A list of names, in one place so the key rule is stated once.
 *
 * 🔴 The position is part of the key, and the suppression is deliberate. TMDB
 * really does return duplicate credits — the same person, the same job, twice —
 * so name-and-job is not unique. The usual objection to an index key is that
 * reordering scrambles component state, and neither applies here: this list is
 * derived from an immutable response, never sorted or filtered after render, and
 * holds no state of its own.
 */
function CreditList({
  people,
  className,
}: {
  people: readonly CreditPerson[];
  className?: string;
}) {
  return (
    <ul className={cn('flex flex-col gap-1', className)}>
      {people.map((person, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: TMDB returns duplicate credits, so name+job is not unique; this list never reorders and holds no state
        <li key={`${person.name}-${person.job}-${index}`} className="text-sm">
          <span className="text-text-primary">{person.name}</span>
          {person.job ? (
            <span className="text-text-dim pl-2 text-xs italic">{person.job}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
