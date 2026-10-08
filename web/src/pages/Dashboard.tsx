import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { PageHeader, StatCard, StatusBadge } from '../components/ui';

export default function Dashboard() {
  const { session } = useAuth();
  const [stats, setStats] = useState({
    totalSales: 0,
    invoiceCount: 0,
    totalItems: 0,
    lowStockCount: 0,
    totalEmployees: 0,
    presentToday: 0,
    activeProjects: 0,
  });
  const [recentInvoices, setRecentInvoices] = useState<any[]>([]);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const [invRes, itms, emps, attSum, prjs] = await Promise.all([
          api<{ items: any[] }>('/sales/invoices').catch(() => ({ items: [] })),
          api<any[]>('/inventory/items').catch(() => []),
          api<any[]>('/hr/employees').catch(() => []),
          api<any>('/attendance/summary').catch(() => ({ present: 0 })),
          api<any[]>('/projects').catch(() => []),
        ]);

        const totalSales = invRes.items.reduce((s, i) => s + Number(i.grandTotal), 0);
        const lowStockCount = itms.filter((i) => i.isLowStock).length;
        const activeProjects = prjs.filter((p) => p.status === 'in_progress').length;

        setStats({
          totalSales,
          invoiceCount: invRes.items.length,
          totalItems: itms.length,
          lowStockCount,
          totalEmployees: emps.length,
          presentToday: attSum.present || 0,
          activeProjects,
        });

        setRecentInvoices(invRes.items.slice(0, 5));
      } catch {
        // fail silently for initial loads
      }
    }
    fetchDashboardData();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${session?.user.fullName}`}
        subtitle={`${session?.tenant.name} • ERP Operations Hub`}
      >
        <Link to="/sales" className="btn bg-indigo-600 hover:bg-indigo-700">
          + Create Sales Invoice
        </Link>
        <Link to="/accounting" className="btn-ghost">
          Financial Ledger
        </Link>
      </PageHeader>

      {/* KPI Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Sales (PKR)"
          value={`PKR ${stats.totalSales.toLocaleString('en-PK', { minimumFractionDigits: 2 })}`}
          subtext={`${stats.invoiceCount} invoices recorded`}
          icon="💰"
          badge="FBR POS Sync Active"
        />
        <StatCard
          title="Inventory Items"
          value={stats.totalItems}
          subtext={stats.lowStockCount > 0 ? `${stats.lowStockCount} item(s) low stock` : 'Healthy stock levels'}
          icon="📦"
          badge={stats.lowStockCount > 0 ? '⚠️ Restock Required' : '✓ Stocked'}
        />
        <StatCard
          title="Staff & Attendance"
          value={`${stats.presentToday} / ${stats.totalEmployees}`}
          subtext="Employees present today"
          icon="👥"
          badge="HR & Payroll Online"
        />
        <StatCard
          title="Active Projects"
          value={stats.activeProjects}
          subtext="Ongoing client engagements"
          icon="🚀"
          badge="Operations"
        />
      </div>

      {/* Quick Launchpad & Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Quick Launchpad */}
        <div className="card space-y-4">
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2">Business Modules</h2>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Link
              to="/accounting"
              className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-indigo-50 hover:border-indigo-200 transition-all block font-medium text-slate-800"
            >
              <div className="text-lg mb-1">📊</div>
              <div>Accounting</div>
              <div className="text-[10px] text-slate-400 font-normal">Chart of Accounts, JV, Reports</div>
            </Link>
            <Link
              to="/sales"
              className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-indigo-50 hover:border-indigo-200 transition-all block font-medium text-slate-800"
            >
              <div className="text-lg mb-1">🧾</div>
              <div>Sales & FBR</div>
              <div className="text-[10px] text-slate-400 font-normal">Digital Invoicing, QR code</div>
            </Link>
            <Link
              to="/inventory"
              className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-indigo-50 hover:border-indigo-200 transition-all block font-medium text-slate-800"
            >
              <div className="text-lg mb-1">📦</div>
              <div>Inventory</div>
              <div className="text-[10px] text-slate-400 font-normal">Warehouses & Stock movements</div>
            </Link>
            <Link
              to="/purchase"
              className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-indigo-50 hover:border-indigo-200 transition-all block font-medium text-slate-800"
            >
              <div className="text-lg mb-1">🛍️</div>
              <div>Purchase</div>
              <div className="text-[10px] text-slate-400 font-normal">Suppliers & Bills</div>
            </Link>
            <Link
              to="/hr"
              className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-indigo-50 hover:border-indigo-200 transition-all block font-medium text-slate-800"
            >
              <div className="text-lg mb-1">👥</div>
              <div>HR & Payroll</div>
              <div className="text-[10px] text-slate-400 font-normal">Salaries, Tax, EOBI & Slips</div>
            </Link>
            <Link
              to="/attendance"
              className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-indigo-50 hover:border-indigo-200 transition-all block font-medium text-slate-800"
            >
              <div className="text-lg mb-1">📅</div>
              <div>Attendance</div>
              <div className="text-[10px] text-slate-400 font-normal">Daily Check-ins & Leaves</div>
            </Link>
            <Link
              to="/assets"
              className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-indigo-50 hover:border-indigo-200 transition-all block font-medium text-slate-800"
            >
              <div className="text-lg mb-1">🏢</div>
              <div>Fixed Assets</div>
              <div className="text-[10px] text-slate-400 font-normal">Register & Depreciation</div>
            </Link>
            <Link
              to="/projects"
              className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-indigo-50 hover:border-indigo-200 transition-all block font-medium text-slate-800"
            >
              <div className="text-lg mb-1">🎯</div>
              <div>Projects</div>
              <div className="text-[10px] text-slate-400 font-normal">Tasks & Timesheets</div>
            </Link>
          </div>
        </div>

        {/* Recent Invoices Activity */}
        <div className="lg:col-span-2 card space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h2 className="text-base font-bold text-slate-900">Recent Sales & Invoicing</h2>
            <Link to="/sales" className="text-xs font-semibold text-indigo-600 hover:underline">
              View all invoices →
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b text-slate-500 font-semibold">
                  <th className="py-2">Invoice #</th>
                  <th className="py-2">Customer</th>
                  <th className="py-2 text-right">Amount (PKR)</th>
                  <th className="py-2 text-center">FBR Status</th>
                  <th className="py-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 font-mono font-medium text-indigo-600">{inv.invoiceNumber}</td>
                    <td className="py-2.5 font-medium text-slate-800">{inv.customerName}</td>
                    <td className="py-2.5 text-right font-mono font-bold text-slate-900">
                      PKR {Number(inv.grandTotal).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 text-center">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          inv.fbrStatus === 'reported' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {inv.fbrStatus === 'reported' ? '✓ FBR Verified' : 'Pending FBR'}
                      </span>
                    </td>
                    <td className="py-2.5 text-center">
                      <StatusBadge status={inv.status} />
                    </td>
                  </tr>
                ))}
                {recentInvoices.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      No invoices recorded yet. Start by generating an invoice.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
