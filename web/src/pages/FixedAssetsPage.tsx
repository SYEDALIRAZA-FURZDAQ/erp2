import { useEffect, useState } from 'react';
import { api, post } from '../lib/api';
import { useTranslation } from '../lib/i18n';
import { ErrorBox, Modal, PageHeader, StatCard, StatusBadge, SuccessBox } from '../components/ui';

interface FixedAsset {
  id: string;
  assetCode: string;
  name: string;
  category: string;
  purchaseDate: string;
  purchaseCost: string;
  salvageValue: string;
  usefulLifeYears: string;
  accumulatedDepreciation: string;
  currentValue: string;
  location: string | null;
  status: string;
  depreciationCount: number;
}

export default function FixedAssetsPage() {
  const { t } = useTranslation();
  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [assetForm, setAssetForm] = useState({
    name: '',
    category: 'it_equipment',
    purchaseDate: new Date().toISOString().slice(0, 10),
    purchaseCost: 150000,
    salvageValue: 15000,
    usefulLifeYears: 4,
    location: 'Head Office',
  });

  const loadAssets = async () => {
    try {
      setLoading(true);
      const res = await api<FixedAsset[]>('/assets');
      setAssets(res);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssets();
  }, []);

  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      await post('/assets', assetForm);
      setSuccess('Asset added to register');
      setShowAddModal(false);
      loadAssets();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleRunDepreciation = async (assetId: string) => {
    try {
      setError(null);
      const res = await post<any>(`/assets/${assetId}/depreciate`);
      setSuccess(`Depreciation run executed: PKR ${Number(res.amount).toFixed(2)} recorded and posted to General Ledger!`);
      loadAssets();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const totalCost = assets.reduce((s, a) => s + Number(a.purchaseCost), 0);
  const totalBookValue = assets.reduce((s, a) => s + Number(a.currentValue), 0);
  const totalDepreciation = assets.reduce((s, a) => s + Number(a.accumulatedDepreciation), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('assets.title', 'Fixed Assets & Depreciation')}
        subtitle={t('assets.subtitle', 'Asset register, straight-line depreciation engine, and automatic ledger posting')}
      >
        <button className="btn" onClick={() => setShowAddModal(true)}>
          {t('assets.add', '+ Add Fixed Asset')}
        </button>
      </PageHeader>

      <ErrorBox message={error} />
      <SuccessBox message={success} />

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          title={t('assets.total_cost', 'Total Assets Cost')}
          value={`PKR ${totalCost.toLocaleString('en-PK', { minimumFractionDigits: 2 })}`}
          icon="🏢"
        />
        <StatCard
          title={t('assets.accumulated_depreciation', 'Accumulated Depreciation')}
          value={`PKR ${totalDepreciation.toLocaleString('en-PK', { minimumFractionDigits: 2 })}`}
          icon="📉"
        />
        <StatCard
          title={t('assets.book_value', 'Current Net Book Value')}
          value={`PKR ${totalBookValue.toLocaleString('en-PK', { minimumFractionDigits: 2 })}`}
          icon="💼"
          badge={t('assets.net_worth', 'Net Asset Worth')}
        />
      </div>

      {/* Assets Register Table */}
      <div className="card overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="th">{t('assets.asset_code', 'Asset Code')}</th>
              <th className="th">{t('assets.asset_name', 'Asset Name')}</th>
              <th className="th">{t('assets.category', 'Category')}</th>
              <th className="th">{t('common.date', 'Purchase Date')}</th>
              <th className="th text-right">{t('assets.cost', 'Cost (PKR)')}</th>
              <th className="th text-right">{t('assets.depreciation_col', 'Depreciation')}</th>
              <th className="th text-right">{t('assets.book_value_col', 'Book Value')}</th>
              <th className="th text-center">{t('common.status', 'Status')}</th>
              <th className="th text-right">{t('common.actions', 'Actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {assets.map((a) => (
              <tr key={a.id} className="hover:bg-slate-50/70">
                <td className="td font-mono font-medium text-indigo-600">{a.assetCode}</td>
                <td className="td">
                  <div className="font-medium text-slate-900">{a.name}</div>
                  <div className="text-xs text-slate-400">{a.location || 'HQ'}</div>
                </td>
                <td className="td uppercase text-xs text-slate-600 font-semibold">{a.category.replace(/_/g, ' ')}</td>
                <td className="td text-slate-600">{a.purchaseDate}</td>
                <td className="td text-right font-mono text-slate-900">
                  {Number(a.purchaseCost).toLocaleString('en-PK')}
                </td>
                <td className="td text-right font-mono text-rose-600">
                  {Number(a.accumulatedDepreciation).toLocaleString('en-PK')}
                </td>
                <td className="td text-right font-mono font-bold text-emerald-800">
                  PKR {Number(a.currentValue).toLocaleString('en-PK')}
                </td>
                <td className="td text-center">
                  <StatusBadge status={a.status} />
                </td>
                <td className="td text-right">
                  <button
                    className="btn bg-indigo-600 hover:bg-indigo-700 text-xs py-1 px-2.5"
                    onClick={() => handleRunDepreciation(a.id)}
                  >
                    {t('assets.run_depreciation', 'Run Depreciation')}
                  </button>
                </td>
              </tr>
            ))}
            {assets.length === 0 && !loading && (
              <tr>
                <td colSpan={9} className="p-8 text-center text-slate-500">
                  {t('common.no_records', 'No fixed assets registered yet. Add your first asset.')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL: Add Fixed Asset */}
      {showAddModal && (
        <Modal title={t('assets.add_modal_title', 'Add Fixed Asset')} maxWidth="max-w-2xl" onClose={() => setShowAddModal(false)}>
          <form onSubmit={handleCreateAsset} className="space-y-4">
            <div>
              <label className="label">Asset Name / Description</label>
              <input
                type="text"
                className="input"
                required
                placeholder="e.g. Dell PowerEdge Server R740"
                value={assetForm.name}
                onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Category</label>
                <select
                  className="input"
                  value={assetForm.category}
                  onChange={(e) => setAssetForm({ ...assetForm, category: e.target.value })}
                >
                  <option value="it_equipment">IT & Electronics Equipment</option>
                  <option value="vehicles">Motor Vehicles</option>
                  <option value="machinery">Plant & Machinery</option>
                  <option value="furniture">Furniture & Fixtures</option>
                  <option value="building">Office Building</option>
                  <option value="other">Other Asset</option>
                </select>
              </div>
              <div>
                <label className="label">Purchase Date</label>
                <input
                  type="date"
                  className="input"
                  required
                  value={assetForm.purchaseDate}
                  onChange={(e) => setAssetForm({ ...assetForm, purchaseDate: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Purchase Cost (PKR)</label>
                <input
                  type="number"
                  step="1000"
                  required
                  className="input font-mono"
                  value={assetForm.purchaseCost}
                  onChange={(e) => setAssetForm({ ...assetForm, purchaseCost: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label className="label">Salvage Value</label>
                <input
                  type="number"
                  step="1000"
                  className="input font-mono"
                  value={assetForm.salvageValue}
                  onChange={(e) => setAssetForm({ ...assetForm, salvageValue: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label className="label">Useful Life (Years)</label>
                <input
                  type="number"
                  step="0.5"
                  required
                  className="input font-mono"
                  value={assetForm.usefulLifeYears}
                  onChange={(e) => setAssetForm({ ...assetForm, usefulLifeYears: parseFloat(e.target.value) || 1 })}
                />
              </div>
            </div>
            <div>
              <label className="label">Physical Location</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Server Room Karachi"
                value={assetForm.location}
                onChange={(e) => setAssetForm({ ...assetForm, location: e.target.value })}
              />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setShowAddModal(false)}>
                Cancel
              </button>
              <button type="submit" className="btn">
                Save Asset
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
