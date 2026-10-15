import { useEffect, useRef, useState } from 'react';
import { BookOpen, BriefcaseMedical, Compass, Ellipsis, FileText, Gauge, LayoutDashboard, Microscope, Stethoscope, UserRoundCog, type LucideIcon } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Experiences from './pages/Experiences';
import Outputs from './pages/Outputs';
import Research from './pages/Research';
import Gaps from './pages/Gaps';
import Opportunities from './pages/Opportunities';
import Guides from './pages/Guides';
import Settings from './pages/Settings';
import { useAnalysis } from './engine/useAnalysis';
import { HAS_RESEARCH_DATA } from './data/privateData';

const ALL_PAGES: readonly { id: string; label: string; icon: LucideIcon }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'experiences', label: 'Experiences', icon: BriefcaseMedical },
  { id: 'research', label: 'Research targeting', icon: Microscope },
  { id: 'outputs', label: 'Research output', icon: FileText },
  { id: 'gaps', label: 'Gap analysis', icon: Gauge },
  { id: 'opportunities', label: 'Opportunities', icon: Compass },
  { id: 'guides', label: 'Guides', icon: BookOpen },
  { id: 'settings', label: 'Profile & academics', icon: UserRoundCog },
] as const;

/** Research targeting needs the local-only tracker data, so the public site leaves it out. */
const PAGES = ALL_PAGES.filter((p) => p.id !== 'research' || HAS_RESEARCH_DATA);

/** Phone tab bar: three main pages plus "More" for the rest. */
const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  ...(HAS_RESEARCH_DATA ? [{ id: 'research', label: 'Research' }] : [{ id: 'outputs', label: 'Outputs' }]),
  { id: 'experiences', label: 'Experiences' },
];
const MORE = PAGES.filter((p) => !TABS.some((t) => t.id === p.id));

type PageId = 'dashboard' | 'experiences' | 'research' | 'outputs' | 'gaps' | 'opportunities' | 'guides' | 'settings';

function currentPage(): PageId {
  const h = window.location.hash.slice(1);
  return (PAGES.find((p) => p.id === h)?.id ?? 'dashboard') as PageId;
}

const ICON = { size: 18, strokeWidth: 1.75, 'aria-hidden': true } as const;

export default function App() {
  const [page, setPage] = useState<PageId>(currentPage);
  const [moreOpen, setMoreOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const { gaps } = useAnalysis();
  const behind = gaps.filter((g) => g.severity === 'critical').length;

  useEffect(() => {
    const onHash = () => {
      setPage(currentPage());
      setMoreOpen(false);
      window.scrollTo(0, 0);
      // Move focus to the new page's heading so screen readers announce it.
      requestAnimationFrame(() => {
        const h1 = mainRef.current?.querySelector('h1');
        if (h1) {
          h1.setAttribute('tabindex', '-1');
          h1.focus({ preventScroll: true });
        }
      });
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    const label = PAGES.find((p) => p.id === page)?.label;
    document.title = page === 'dashboard' ? 'Med School Planner' : `${label} · Med School Planner`;
  }, [page]);

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMoreOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moreOpen]);

  const go = (p: string) => {
    window.location.hash = p;
  };

  const badge = (id: string) =>
    id === 'gaps' && behind > 0 ? (
      <span className="nav-count" title={`${behind} ${behind === 1 ? 'area' : 'areas'} behind`}>
        {behind}
        <span className="visually-hidden"> behind</span>
      </span>
    ) : null;

  const moreActive = MORE.some((p) => p.id === page);

  return (
    <div className="app">
      <nav className="sidebar" aria-label="Main">
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            <Stethoscope size={16} strokeWidth={2} />
          </span>
          <span>Med School Planner</span>
        </div>
        <ul>
          {PAGES.map((p) => (
            <li key={p.id}>
              <a href={`#${p.id}`} className={page === p.id ? 'active' : ''} aria-current={page === p.id ? 'page' : undefined}>
                <span className="nav-icon">
                  <p.icon {...ICON} />
                </span>
                <span className="nav-label">{p.label}</span>
                {badge(p.id)}
              </a>
            </li>
          ))}
        </ul>
        <p className="sidebar-foot muted small">Your data stays in this browser. Back it up from Profile & academics.</p>
      </nav>

      <main ref={mainRef}>
        {page === 'dashboard' && <Dashboard go={go} />}
        {page === 'experiences' && <Experiences />}
        {page === 'research' && HAS_RESEARCH_DATA && <Research />}
        {page === 'outputs' && <Outputs go={go} />}
        {page === 'gaps' && <Gaps go={go} />}
        {page === 'opportunities' && <Opportunities />}
        {page === 'guides' && <Guides />}
        {page === 'settings' && <Settings />}
      </main>

      {moreOpen && <div className="sheet-backdrop" onClick={() => setMoreOpen(false)} aria-hidden />}
      {moreOpen && (
        <div className="sheet" id="more-sheet" role="dialog" aria-modal="false" aria-label="More pages">
          <ul>
            {MORE.map((p) => (
              <li key={p.id}>
                <a href={`#${p.id}`} className={page === p.id ? 'active' : ''} aria-current={page === p.id ? 'page' : undefined}>
                  <p.icon {...ICON} />
                  <span>{p.label}</span>
                  {badge(p.id)}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <nav className="tabbar" aria-label="Main (phone)">
        {TABS.map((t) => {
          const Icon = PAGES.find((p) => p.id === t.id)!.icon;
          return (
            <a key={t.id} href={`#${t.id}`} className={page === t.id && !moreOpen ? 'active' : ''} aria-current={page === t.id ? 'page' : undefined}>
              <Icon size={22} strokeWidth={1.75} aria-hidden />
              <span>{t.label}</span>
            </a>
          );
        })}
        <button
          type="button"
          className={moreActive || moreOpen ? 'active' : ''}
          aria-expanded={moreOpen}
          aria-controls="more-sheet"
          onClick={() => setMoreOpen((o) => !o)}
        >
          <span className="tab-icon">
            <Ellipsis size={22} strokeWidth={1.75} aria-hidden />
            {behind > 0 && <span className="tab-dot" aria-hidden />}
          </span>
          <span>More</span>
          {behind > 0 && <span className="visually-hidden">, {behind} areas behind in Gap analysis</span>}
        </button>
      </nav>
    </div>
  );
}
