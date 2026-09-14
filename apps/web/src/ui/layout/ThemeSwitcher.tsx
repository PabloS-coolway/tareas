import type { Theme } from '../useTheme';

const THEMES: { id: Theme; label: string }[] = [
  { id: 'violet', label: 'Violeta' },
  { id: 'midnight', label: 'Midnight' },
  { id: 'dark', label: 'Dark' },
];

export function ThemeSwitcher({ theme, setTheme }: { theme: Theme; setTheme: (t: Theme) => void }) {
  return (
    <div className="theme-switch" role="group" aria-label="Tema de color">
      {THEMES.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`theme-dot t-${t.id} ${theme === t.id ? 'on' : ''}`}
          onClick={() => setTheme(t.id)}
          aria-pressed={theme === t.id}
          aria-label={`Tema ${t.label}`}
          title={t.label}
        />
      ))}
    </div>
  );
}
