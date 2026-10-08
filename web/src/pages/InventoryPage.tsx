import { useEffect, useState } from 'react';
import { api, post } from '../lib/api';
import { useTranslation } from '../lib/i18n';
import { ErrorBox, Modal, PageHeader, StatusBadge, SuccessBox } from '../components/ui';

interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  uom: string;
  costPrice: string;
  sellingPrice: string;
  taxRate: string;
  reorderLevel: string;
  currentStock: string;
  isLowStock: boolean;
  isActive: boolean;
}

interface Warehouse {
  id: string;
  code: string;
  name: string;
  address: string | null;
  isActive: boolean;
  uniqueItemCount: number;
  totalUnitsInStock: string;
}

interface StockMovement {
  id: string;
  movementType: string;
  quantity: string;
  unitCost: string;
  reference: string | null;
  notes: string | null;
  createdAt: string;
  sku: string;
  itemName: string;
  uom: string;
  warehouseName: string;
}

export default function InventoryPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'items' | 'movements' | 'warehouses'>('items');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modals
  const [showItemModal, setShowItemModal] = useState(false);
  const [showWarehouseModal, setShowWarehouseModal] = useState(false);
  const [showMovementModal, setShowMovementModal] = useState(false);

  // New Item Form
  const [itemForm, setItemForm] = useState({
    sku: '',
    name: '',
    category: '',
    uom: 'pcs',
    costPrice: 0,
    sellingPrice: 0,
    taxRate: 18,
    reorderLevel: 10,
  });

  // New Warehouse Form
  const [warehouseForm, setWarehouseForm] = useState({
    code: '',
    name: '',
    address: '',
  });

  // New Movement Form
  const [movementForm, setMovementForm] = useState({
    itemId: '',
    warehouseId: '',
    movementType: 'in',
    quantity: 1,
    unitCost: 0,
    reference: '',
    notes: '',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [itms, whs, movs] = await Promise.all([
        api<InventoryItem[]>('/inventory/items'),
        api<Warehouse[]>('/inventory/warehouses'),
        api<{ items: StockMovement[] }>('/inventory/movements').catch(() => ({ items: [] })),
      ]);
      setItems(itms);
      setWarehouses(whs);
      setMovements(movs.items);
      if (itms.length > 0 && !movementForm.itemId) {
        setMovementForm((f) => ({ ...f, itemId: itms[0].id, unitCost: Number(itms[0].costPrice) }));
      }
      if (whs.length > 0 && !movementForm.warehouseId) {
        setMovementForm((f) => ({ ...f, warehouseId: whs[0].id }));
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tab]);

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      await post('/inventory/items', itemForm);
      setSuccess('Inventory item added to catalog');
      setShowItemModal(false);
      setItemForm({
        sku: '',
        name: '',
        category: '',
        uom: 'pcs',
        costPrice: 0,
        sellingPrice: 0,
        taxRate: 18,
        reorderLevel: 10,
      });
      loadData();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleCreateWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      await post('/inventory/warehouses', warehouseForm);
      setSuccess('Warehouse created successfully');
      setShowWarehouseModal(false);
      setWarehouseForm({ code: '', name: '', address: '' });
      loadData();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleCreateMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      await post('/inventory/movements', movementForm);
      setSuccess('Stock movement registered successfully');
      setShowMovementModal(false);
      loadData();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('inventory.title', 'Inventory & Stock Control')}
        subtitle={t('inventory.subtitle', 'Item catalog, multi-warehouse stock levels, reorder tracking, and movements')}
      >
        <button className="btn-ghost" onClick={() => setShowMovementModal(true)}>
          {t('inventory.adjust_stock', '± Adjust Stock')}
        </button>
        {tab === 'items' && (
          <button className="btn" onClick={() => setShowItemModal(true)}>
            {t('inventory.new_item', '+ New Item')}
          </button>
        )}
        {tab === 'warehouses' && (
          <button className="btn" onClick={() => setShowWarehouseModal(true)}>
            {t('inventory.new_warehouse', '+ New Warehouse')}
          </button>
        )}
      </PageHeader>

      <ErrorBox message={error} />
      <SuccessBox message={success} />

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
            tab === 'items'
              ? 'border-indigo-600 text-indigo-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setTab('items')}
        >
          {t('inventory.items', 'Items Catalog & Stock')}
        </button>
        <button
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
            tab === 'movements'
              ? 'border-indigo-600 text-indigo-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setTab('movements')}
        >
          {t('inventory.movements', 'Stock Movements Ledger')}
        </button>
        <button
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
            tab === 'warehouses'
              ? 'border-indigo-600 text-indigo-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setTab('warehouses')}
        >
          {t('inventory.warehouses', 'Warehouses')}
        </button>
      </div>

      {/* TAB 1: Items */}
      {tab === 'items' && (
        <div className="card overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="th">{t('inventory.sku', 'SKU')}</th>
                <th className="th">{t('inventory.item_name', 'Item Name')}</th>
                <th className="th">{t('inventory.category', 'Category')}</th>
                <th className="th text-right">{t('inventory.cost_price', 'Cost Price')}</th>
                <th className="th text-right">{t('inventory.selling_price', 'Selling Price')}</th>
                <th className="th text-right">{t('inventory.in_stock', 'In Stock')}</th>
                <th className="th text-center">{t('common.status', 'Stock Level')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((i) => (
                <tr key={i.id} className="hover:bg-slate-50/70">
                  <td className="td font-mono font-medium text-indigo-600">{i.sku}</td>
                  <td className="td font-medium text-slate-900">{i.name}</td>
                  <td className="td text-slate-500">{i.category || 'General'}</td>
                  <td className="td text-right font-mono text-slate-600">
                    PKR {Number(i.costPrice).toLocaleString('en-PK')}
                  </td>
                  <td className="td text-right font-mono font-medium text-slate-900">
                    PKR {Number(i.sellingPrice).toLocaleString('en-PK')}
                  </td>
                  <td className="td text-right font-mono font-bold text-slate-900">
                    {Number(i.currentStock).toLocaleString()} {i.uom}
                  </td>
                  <td className="td text-center">
                    {i.isLowStock ? (
                      <span className="inline-flex items-center rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-800">
                        {t('inventory.low_stock', 'Low Stock')} (≤{i.reorderLevel})
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                        {t('inventory.optimal', 'Optimal')}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {items.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    {t('common.no_records', 'No inventory items found. Add your first product.')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: Movements */}
      {tab === 'movements' && (
        <div className="card overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="th">{t('common.date', 'Date')}</th>
                <th className="th">{t('inventory.item_name', 'Item SKU & Name')}</th>
                <th className="th">{t('inventory.warehouses', 'Warehouse')}</th>
                <th className="th">{t('accounting.type', 'Type')}</th>
                <th className="th text-right">{t('inventory.quantity', 'Quantity')}</th>
                <th className="th text-right">{t('inventory.unit_cost', 'Unit Cost')}</th>
                <th className="th">{t('inventory.reference_note', 'Reference')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {movements.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/70">
                  <td className="td text-slate-600">{m.createdAt.slice(0, 10)}</td>
                  <td className="td">
                    <span className="font-mono text-xs font-semibold text-indigo-600">{m.sku}</span> - {m.itemName}
                  </td>
                  <td className="td text-slate-700">{m.warehouseName}</td>
                  <td className="td">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${
                        m.movementType === 'in'
                          ? 'bg-emerald-100 text-emerald-800'
                          : m.movementType === 'out'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {m.movementType === 'in' ? t('inventory.stock_in', 'In') : m.movementType === 'out' ? t('inventory.stock_out', 'Out') : t('inventory.count_adj', 'Adjustment')}
                    </span>
                  </td>
                  <td className="td text-right font-mono font-bold text-slate-900">
                    {Number(m.quantity) > 0 ? `+${m.quantity}` : m.quantity} {m.uom}
                  </td>
                  <td className="td text-right font-mono text-slate-600">
                    PKR {Number(m.unitCost).toLocaleString()}
                  </td>
                  <td className="td text-slate-500">{m.reference || '—'}</td>
                </tr>
              ))}
              {movements.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    {t('common.no_records', 'No stock movements recorded yet.')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: Warehouses */}
      {tab === 'warehouses' && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {warehouses.map((w) => (
            <div key={w.id} className="card space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                  {w.code}
                </span>
                <StatusBadge status={w.isActive ? 'active' : 'inactive'} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">{w.name}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{w.address || 'Address not specified'}</p>
              </div>
              <div className="border-t border-slate-100 pt-3 flex justify-between text-xs text-slate-600">
                <span>{t('inventory.unique_products', 'Unique Products')}: <b>{w.uniqueItemCount}</b></span>
                <span>{t('inventory.total_units', 'Total Units')}: <b className="font-mono">{Number(w.totalUnitsInStock).toLocaleString()}</b></span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL: Create Item */}
      {showItemModal && (
        <Modal title={t('inventory.add_item_title', 'Add Item to Catalog')} onClose={() => setShowItemModal(false)}>
          <form onSubmit={handleCreateItem} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">{t('inventory.sku', 'SKU / Code')}</label>
                <input
                  type="text"
                  className="input"
                  required
                  placeholder="e.g. IT-DEV-001"
                  value={itemForm.sku}
                  onChange={(e) => setItemForm({ ...itemForm, sku: e.target.value })}
                />
              </div>
              <div>
                <label className="label">{t('inventory.category', 'Category')}</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Hardware"
                  value={itemForm.category}
                  onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="label">{t('inventory.item_name', 'Item Name')}</label>
              <input
                type="text"
                className="input"
                required
                placeholder="e.g. Dell Monitor 27-inch"
                value={itemForm.name}
                onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">{t('inventory.uom', 'Unit of Measure')}</label>
                <input
                  type="text"
                  className="input"
                  placeholder="pcs, kg, box"
                  value={itemForm.uom}
                  onChange={(e) => setItemForm({ ...itemForm, uom: e.target.value })}
                />
              </div>
              <div>
                <label className="label">{t('inventory.cost_price', 'Cost Price (PKR)')}</label>
                <input
                  type="number"
                  step="0.01"
                  className="input font-mono"
                  value={itemForm.costPrice}
                  onChange={(e) => setItemForm({ ...itemForm, costPrice: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label className="label">{t('inventory.selling_price', 'Selling Price')}</label>
                <input
                  type="number"
                  step="0.01"
                  className="input font-mono"
                  value={itemForm.sellingPrice}
                  onChange={(e) => setItemForm({ ...itemForm, sellingPrice: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">{t('inventory.tax_rate', 'Sales Tax Rate (%)')}</label>
                <input
                  type="number"
                  step="1"
                  className="input font-mono"
                  value={itemForm.taxRate}
                  onChange={(e) => setItemForm({ ...itemForm, taxRate: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label className="label">{t('inventory.reorder_level', 'Reorder Level Alert')}</label>
                <input
                  type="number"
                  step="1"
                  className="input font-mono"
                  value={itemForm.reorderLevel}
                  onChange={(e) => setItemForm({ ...itemForm, reorderLevel: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setShowItemModal(false)}>
                {t('common.cancel', 'Cancel')}
              </button>
              <button type="submit" className="btn">
                {t('common.save', 'Save Item')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: Create Warehouse */}
      {showWarehouseModal && (
        <Modal title={t('inventory.create_warehouse_title', 'Create Warehouse')} onClose={() => setShowWarehouseModal(false)}>
          <form onSubmit={handleCreateWarehouse} className="space-y-4">
            <div>
              <label className="label">{t('inventory.warehouse_code', 'Warehouse Code')}</label>
              <input
                type="text"
                className="input"
                required
                placeholder="e.g. WH-KHI-01"
                value={warehouseForm.code}
                onChange={(e) => setWarehouseForm({ ...warehouseForm, code: e.target.value })}
              />
            </div>
            <div>
              <label className="label">{t('inventory.warehouse_name', 'Warehouse Name')}</label>
              <input
                type="text"
                className="input"
                required
                placeholder="e.g. North Karachi Distribution Hub"
                value={warehouseForm.name}
                onChange={(e) => setWarehouseForm({ ...warehouseForm, name: e.target.value })}
              />
            </div>
            <div>
              <label className="label">{t('inventory.address', 'Address / Location')}</label>
              <input
                type="text"
                className="input"
                placeholder="Address..."
                value={warehouseForm.address}
                onChange={(e) => setWarehouseForm({ ...warehouseForm, address: e.target.value })}
              />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setShowWarehouseModal(false)}>
                {t('common.cancel', 'Cancel')}
              </button>
              <button type="submit" className="btn">
                {t('common.save', 'Save Warehouse')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: Stock Movement */}
      {showMovementModal && (
        <Modal title={t('inventory.movement_title', 'Record Stock Adjustment / Movement')} onClose={() => setShowMovementModal(false)}>
          <form onSubmit={handleCreateMovement} className="space-y-4">
            <div>
              <label className="label">{t('inventory.items', 'Item')}</label>
              <select
                className="input"
                required
                value={movementForm.itemId}
                onChange={(e) => {
                  const it = items.find((x) => x.id === e.target.value);
                  setMovementForm({
                    ...movementForm,
                    itemId: e.target.value,
                    unitCost: it ? Number(it.costPrice) : 0,
                  });
                }}
              >
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.sku} - {i.name} ({t('inventory.in_stock', 'In Stock')}: {i.currentStock})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">{t('inventory.warehouses', 'Warehouse')}</label>
                <select
                  className="input"
                  required
                  value={movementForm.warehouseId}
                  onChange={(e) => setMovementForm({ ...movementForm, warehouseId: e.target.value })}
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">{t('inventory.movement_type', 'Movement Type')}</label>
                <select
                  className="input"
                  value={movementForm.movementType}
                  onChange={(e) => setMovementForm({ ...movementForm, movementType: e.target.value })}
                >
                  <option value="in">{t('inventory.stock_in', 'Stock In (Receipt / Found)')}</option>
                  <option value="out">{t('inventory.stock_out', 'Stock Out (Issue / Scrap)')}</option>
                  <option value="adjustment">{t('inventory.count_adj', 'Count Adjustment')}</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">{t('inventory.quantity', 'Quantity')}</label>
                <input
                  type="number"
                  step="1"
                  required
                  className="input font-mono"
                  value={movementForm.quantity}
                  onChange={(e) => setMovementForm({ ...movementForm, quantity: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label className="label">{t('inventory.unit_cost', 'Unit Cost (PKR)')}</label>
                <input
                  type="number"
                  step="0.01"
                  className="input font-mono"
                  value={movementForm.unitCost}
                  onChange={(e) => setMovementForm({ ...movementForm, unitCost: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div>
              <label className="label">{t('inventory.reference_note', 'Reference / Note')}</label>
              <input
                type="text"
                className="input"
                placeholder="Reason or physical count note..."
                value={movementForm.reference}
                onChange={(e) => setMovementForm({ ...movementForm, reference: e.target.value })}
              />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setShowMovementModal(false)}>
                {t('common.cancel', 'Cancel')}
              </button>
              <button type="submit" className="btn">
                {t('common.save', 'Record Movement')}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
