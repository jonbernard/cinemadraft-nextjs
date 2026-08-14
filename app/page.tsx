import Button from '@mui/material/Button';

/**
 * Placeholder home page. Phase 5 replaces this with the dashboard.
 *
 * Until then it doubles as the probe for the cascade layer contract (D29):
 * the two buttons below are what e2e/smoke.spec.ts asserts against. Keep
 * both test ids until that suite has a real page to point at.
 */
export default function Home() {
  return (
    <main className="p-8 flex flex-col items-start gap-4">
      <h1 className="text-2xl font-bold">Cinemadraft</h1>

      {/* Themed background proves Tailwind preflight did not strip MUI. */}
      <Button variant="contained" data-testid="mui-button">
        MUI button
      </Button>

      {/* Black background proves a Tailwind utility overrides MUI. */}
      <Button variant="contained" className="bg-black" data-testid="tailwind-wins">
        Tailwind overrides MUI
      </Button>
    </main>
  );
}
