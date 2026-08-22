import { contrastRatio } from '../theme/contrast';
import { type ColorScheme, palettes } from '../theme/tokens';

/**
 * 🔴 The ratio is computed at render from the same function CI gates on. A
 * typed-in number is a number that goes stale the first time a token moves,
 * and a styleguide that lies about contrast is worse than no styleguide.
 */
export function TokenTable({
  scheme,
  ground = 'raised',
}: {
  scheme: ColorScheme;
  ground?: 'base' | 'surface' | 'raised';
}) {
  const p = palettes[scheme];
  const bg = p.bg[ground];
  const rows: [string, string, number | null][] = [
    ['bg.base', p.bg.base, null],
    ['bg.surface', p.bg.surface, null],
    ['bg.raised', p.bg.raised, null],
    ['border.rule', p.border.rule, null],
    ['text.primary', p.text.primary, 4.5],
    ['text.secondary', p.text.secondary, 4.5],
    ['text.dim', p.text.dim, 4.5],
    ['accent.text', p.accent.text, 4.5],
    ['brass.text', p.brass.text, 4.5],
    ['beam', p.beam, 4.5],
    ['score.high', p.score.high, 4.5],
    ['score.mid', p.score.mid, 4.5],
    ['score.low', p.score.low, 4.5],
  ];

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-text-dim text-left">
          <th className="py-1">Token</th>
          <th>Value</th>
          <th>vs bg.{ground}</th>
          <th>Threshold</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([name, value, threshold]) => {
          const ratio = threshold === null ? null : contrastRatio(value, bg);
          return (
            <tr key={name} className="border-border-rule border-t">
              <td className="py-2 font-sans">{name}</td>
              <td className="font-mono tabular">
                <span
                  aria-hidden="true"
                  className="mr-2 inline-block h-4 w-4 rounded-xs align-middle"
                  style={{ background: value }}
                />
                {value}
              </td>
              <td className="font-mono tabular">
                {ratio === null ? '—' : ratio.toFixed(2)}
              </td>
              <td className="text-text-dim font-mono tabular">
                {threshold === null ? 'surface' : threshold.toFixed(1)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
