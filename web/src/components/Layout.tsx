import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useTranslation } from '../lib/i18n';

interface NavItem {
  to: string;
  labelKey: string;
  defaultLabel: string;
  icon: string;
  end?: boolean;
  perm: string | null;
}

interface NavSection {
  titleKey: string;
  defaultTitle: string;
  items: NavItem[];
}

const SECTIONS: NavSection[] = [
  {
    titleKey: 'nav.main',
    defaultTitle: 'Main',
    items: [
      { to: '/', labelKey: 'nav.dashboard', defaultLabel: 'Dashboard', icon: '📊', end: true, perm: null },
    ],
  },
  {
    titleKey: 'nav.finance_sales',
    defaultTitle: 'Finance & Sales',
    items: [
      { to: '/accounting', labelKey: 'nav.accounting', defaultLabel: 'Accounting', icon: '⚖️', perm: 'accounting.accounts.read' },
      { to: '/sales', labelKey: 'nav.sales', defaultLabel: 'Sales & FBR Invoicing', icon: '🧾', perm: 'sales.invoices.read' },
      { to: '/purchase', labelKey: 'nav.purchase', defaultLabel: 'Purchase & Bills', icon: '🛍️', perm: 'purchase.bills.read' },
    ],
  },
  {
    titleKey: 'nav.operations',
    defaultTitle: 'Operations',
    items: [
      { to: '/inventory', labelKey: 'nav.inventory', defaultLabel: 'Inventory & Stock', icon: '📦', perm: 'inventory.items.read' },
      { to: '/assets', labelKey: 'nav.assets', defaultLabel: 'Fixed Assets', icon: '🏢', perm: 'assets.register.read' },
      { to: '/projects', labelKey: 'nav.projects', defaultLabel: 'Projects & Tasks', icon: '🎯', perm: 'projects.manage.read' },
    ],
  },
  {
    titleKey: 'nav.hr',
    defaultTitle: 'Human Resources',
    items: [
      { to: '/hr', labelKey: 'nav.hr_payroll', defaultLabel: 'HR & Payroll', icon: '💼', perm: 'hr.employees.read' },
      { to: '/attendance', labelKey: 'nav.attendance', defaultLabel: 'Attendance & Leaves', icon: '📅', perm: 'attendance.records.read' },
    ],
  },
  {
    titleKey: 'nav.admin',
    defaultTitle: 'System & Admin',
    items: [
      { to: '/users', labelKey: 'nav.users', defaultLabel: 'Users', icon: '👤', perm: 'core.users.read' },
      { to: '/roles', labelKey: 'nav.roles', defaultLabel: 'Roles & RBAC', icon: '🛡️', perm: 'core.roles.read' },
      { to: '/audit', labelKey: 'nav.audit', defaultLabel: 'Audit Trail', icon: '📜', perm: 'core.audit.read' },
      { to: '/settings', labelKey: 'nav.settings', defaultLabel: 'Settings & Series', icon: '⚙️', perm: 'core.settings.read' },
    ],
  },
];

function SidebarContent({ onNav }: { onNav?: () => void }) {
  const { session, logout, can } = useAuth();
  const { lang, setLang, t, isRtl } = useTranslation();

  return (
    <div className="flex h-full flex-col">
      {/* Logo / tenant */}
      <div className="mb-5 flex items-center justify-between px-2 pt-1">
        <div>
          <div className="text-sm font-bold text-white tracking-wide leading-tight">{session?.tenant.name}</div>
          <div className="text-[10px] font-mono text-indigo-400 uppercase tracking-wider">Enterprise ERP</div>
        </div>
        <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-300 border border-indigo-500/30">
          {t('nav.fbr_ready', 'FBR Ready')}
        </span>
      </div>

      {/* Language switcher inside sidebar (mobile-friendly) */}
      <div className="mb-4 flex items-center rounded-lg border border-slate-700 bg-slate-800/60 p-0.5 mx-2">
        <button
          type="button"
          onClick={() => setLang('en')}
          className={`flex flex-1 items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all ${
            lang === 'en'
              ? 'bg-white text-indigo-700 shadow-sm font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>🇬🇧</span>
          <span>EN</span>
        </button>
        <button
          type="button"
          onClick={() => setLang('ur')}
          className={`flex flex-1 items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all ${
            lang === 'ur'
              ? `bg-white text-indigo-700 shadow-sm font-bold ${isRtl ? 'font-urdu' : ''}`
              : 'text-slate-400 hover:text-slate-200 font-urdu'
          }`}
        >
          <span>🇵🇰</span>
          <span>اردو</span>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-5 overflow-y-auto pr-1 pb-2">
        {SECTIONS.map((sec) => {
          const visibleItems = sec.items.filter((item) => !item.perm || can(item.perm));
          if (visibleItems.length === 0) return null;

          return (
            <div key={sec.titleKey} className="space-y-0.5">
              <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {t(sec.titleKey, sec.defaultTitle)}
              </div>
              {visibleItems.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.end}
                  onClick={onNav}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    }`
                  }
                >
                  <span className="text-sm shrink-0">{n.icon}</span>
                  <span className="truncate">{t(n.labelKey, n.defaultLabel)}</span>
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>

      {/* User pill */}
      <div className="border-t border-slate-800 pt-3 pb-1 px-2 flex items-center justify-between text-xs">
        <div className="min-w-0 flex-1 mr-2">
          <p className="font-semibold text-white truncate">{session?.user.fullName}</p>
          <p className="text-[10px] text-slate-400 truncate">{session?.tenant.slug}</p>
        </div>
        <button
          onClick={() => void logout()}
          className="shrink-0 rounded-md px-2 py-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 text-xs transition-colors"
          title="Sign out"
        >
          {t('nav.sign_out', 'Sign out')}
        </button>
      </div>
    </div>
  );
}

export default function Layout() {
  const { isRtl, t } = useTranslation();
  const { session, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  // Prevent body scroll when drawer open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  return (
    <div className={`flex min-h-screen bg-slate-50 font-sans text-slate-800 ${isRtl ? 'font-urdu' : ''}`} dir={isRtl ? 'rtl' : 'ltr'}>

      {/* ── Desktop Sidebar ─────────────────────────────── */}
      <aside className="hidden md:flex w-60 lg:w-64 shrink-0 flex-col bg-slate-900 px-3 py-4 text-slate-300 border-e border-slate-800">
        <SidebarContent />
      </aside>

      {/* ── Mobile Drawer Overlay ────────────────────────── */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/70 backdrop-blur-sm md:hidden"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Mobile Drawer Panel ──────────────────────────── */}
      <aside
        className={`fixed top-0 z-50 h-full w-72 max-w-[85vw] bg-slate-900 px-3 py-4 text-slate-300 shadow-2xl transition-transform duration-300 ease-in-out md:hidden ${
          isRtl
            ? drawerOpen ? 'translate-x-0 right-0' : 'translate-x-full right-0'
            : drawerOpen ? 'translate-x-0 left-0' : '-translate-x-full left-0'
        }`}
        aria-label="Navigation drawer"
      >
        {/* Close button */}
        <button
          onClick={() => setDrawerOpen(false)}
          className="absolute top-3 end-3 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          aria-label="Close menu"
        >
          ✕
        </button>
        <SidebarContent onNav={() => setDrawerOpen(false)} />
      </aside>

      {/* ── Main content area ────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">

        {/* Top Header */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-xs gap-3">

          {/* Left: Hamburger (mobile) + Tenant label */}
          <div className="flex items-center gap-3 min-w-0">
            {/* Hamburger — mobile only */}
            <button
              id="mobile-menu-btn"
              className="md:hidden flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={drawerOpen}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <span className="hidden sm:block text-xs font-semibold text-slate-500 tracking-wide uppercase truncate">
              <b className="text-slate-800 font-mono normal-case">{session?.tenant.name}</b>
            </span>
            {/* Mobile: tenant name */}
            <span className="sm:hidden text-sm font-bold text-slate-800 truncate">
              {session?.tenant.name ?? 'ERP'}
            </span>
          </div>

          {/* Right: Status pill + User */}
          <div className="flex shrink-0 items-center gap-2 text-xs">
            <span className="hidden lg:flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700 font-medium border border-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Connected
            </span>

            <div className="flex items-center gap-2 border-s border-slate-200 ps-3">
              <span className="hidden sm:block font-medium text-slate-700 max-w-[130px] truncate">
                {session?.user.fullName}
              </span>
              <button
                className="rounded-md px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors"
                onClick={() => void logout()}
              >
                {t('nav.sign_out', 'Sign out')}
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
