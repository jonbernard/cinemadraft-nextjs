import { type Page, test } from '@playwright/test';

/**
 * 🔴 Seconds of deliberate pause per beat. Zero unless asked.
 *
 * A permanently slow suite is a suite nobody runs, and a hardcoded
 * `waitForTimeout` is a defect everywhere else in this repository — so the
 * pacing is a knob rather than a property of the specs. `DEMO_PACE=1` turns
 * the same file into something a person can sit and watch; unset, CI pays
 * nothing and the journeys are ordinary assertions.
 *
 * Read from the TEST process. Playwright's config and specs run here; the app
 * under test knows nothing about pacing and must not.
 */
export const DEMO_PACE = Math.max(0, Number(process.env.DEMO_PACE ?? 0) || 0);

/** The key the caption is stashed under, so a navigation can repaint it. */
const CAPTION_KEY = 'journey-caption';

/**
 * Paint the caption on every document load.
 *
 * 🔴 An init script rather than a per-beat `evaluate`, because a beat that
 * navigates would otherwise lose its own caption halfway through — which is
 * exactly the beat a viewer most needs labelled. `sessionStorage` is per-tab
 * and per-origin, and every journey stays on http://localhost:3000, so the
 * text survives the trip.
 *
 * Wrapped in try/catch at both ends: `about:blank` has no accessible
 * storage, and a journey whose captions fail to paint must still pass. The
 * caption is for the viewer, never for an assertion.
 */
function paintCaption(key: string): void {
  const render = (text: string) => {
    let node = document.getElementById('journey-caption');
    if (!node) {
      node = document.createElement('div');
      node.id = 'journey-caption';
      node.setAttribute('data-testid', 'journey-caption');
      node.setAttribute('aria-hidden', 'true');
      node.style.cssText = [
        'position:fixed',
        'left:0',
        'bottom:0',
        'width:100%',
        'z-index:2147483647',
        'pointer-events:none',
        'padding:10px 16px',
        'background:rgba(10,9,16,0.86)',
        'color:#F2EFE9',
        'font:500 15px/1.4 system-ui,sans-serif',
        'letter-spacing:0.01em',
      ].join(';');
      document.body.appendChild(node);
    }
    node.textContent = text;
  };

  /**
   * 🔴 Published on `window` so `beat` can repaint without owning a second
   * copy of the markup.
   *
   * The first draft had `beat` update an existing node and do nothing when
   * there was none — and on the first beat of a journey there never is one:
   * this script runs at document load, finds the storage key empty, and
   * returns before creating anything. The caption then stayed blank until the
   * journey happened to navigate, which is to say the opening beat of every
   * journey was unlabelled. One painter, called from both ends, is what fixes
   * it; two copies of the styling is what it is worth avoiding.
   */
  Object.assign(window, { __journeyCaption: render });

  try {
    const text = sessionStorage.getItem(key);
    if (!text) return;
    if (document.body) render(text);
    else
      document.addEventListener('DOMContentLoaded', () => render(text), { once: true });
  } catch {
    // No storage on this document. Nothing to paint, nothing to report.
  }
}

/**
 * Install the caption on this page. Call once, before the first navigation.
 *
 * 🔴 At pace 0 nothing is installed at all. Not "installed and invisible":
 * absent. An overlay that exists only in paced runs could be the thing that
 * makes a paced run pass, and then CI would be asserting against a DOM no
 * viewer ever sees. The cheapest way to be sure the two runs agree is for
 * there to be nothing to disagree about.
 */
export async function startJourney(page: Page): Promise<void> {
  if (DEMO_PACE === 0) return;
  await page.addInitScript(paintCaption, CAPTION_KEY);
}

/**
 * One beat of the journey: a caption, some work, and a pause.
 *
 * 🔴 **The only place in `e2e/` allowed to wait on a clock.** Every deliberate
 * pause in every journey goes through here — `scripts/layering.sh` enforces it
 * — so the whole suite's pacing is one number and no journey can quietly
 * acquire a sleep of its own.
 *
 * Wrapped in `test.step` so the caption is also the label in the HTML report
 * and the trace viewer: the same sentence names the beat on screen, in the
 * report, and in the source.
 */
export async function beat<T>(
  page: Page,
  caption: string,
  work: () => Promise<T>,
): Promise<T> {
  if (DEMO_PACE > 0) {
    await page
      .evaluate(
        ([key, text]) => {
          try {
            sessionStorage.setItem(key as string, text as string);
          } catch {
            // Not a document that can hold a caption. Carry on.
          }
          // The init script's painter, if this document has run one. It
          // creates the node as well as updating it, which is what makes the
          // very first beat of a journey visible.
          (
            window as unknown as { __journeyCaption?: (text: string) => void }
          ).__journeyCaption?.(text as string);
        },
        [CAPTION_KEY, caption],
      )
      .catch(() => {
        // Navigating, or not on a page yet. The init script repaints on load.
      });
  }

  const result = await test.step(caption, work);

  if (DEMO_PACE > 0) await page.waitForTimeout(DEMO_PACE * 1000);
  return result;
}
