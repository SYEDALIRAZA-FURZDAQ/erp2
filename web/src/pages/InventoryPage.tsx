import { useEffect, useState } from 'react';
import { api, post, put, del } from '../lib/api';
import { useTranslation } from '../lib/i18n';
import { ErrorBox, Modal, PageHeader, StatusBadge, SuccessBox } from '../components/ui';
import { useAuth } from '../lib/auth';

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
  const { session } = useAuth();
  const isOwner = session?.user?.isOwner ?? false;
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
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<InventoryItem | null>(null);

  // Delete Warehouse State (password-protected)
  const [deletingWarehouse, setDeletingWarehouse] = useState<Warehouse | null>(null);
  const [deleteWhPassword, setDeleteWhPassword] = useState('');
  const [deleteWhLoading, setDeleteWhLoading] = useState(false);

  // Edit Item Form
  const [editForm, setEditForm] = useState({
    sku: '',
    name: '',
    category: '',
    uom: 'pcs',
    costPrice: 0,
    sellingPrice: 0,
    taxRate: 18,
    reorderLevel: 10,
  });

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

  const openEditModal = (item: InventoryItem) => {
    setEditingItem(item);
    setEditForm({
      sku: item.sku,
      name: item.name,
      category: item.category || '',
      uom: item.uom,
      costPrice: Number(item.costPrice),
      sellingPrice: Number(item.sellingPrice),
      taxRate: Number(item.taxRate),
      reorderLevel: Number(item.reorderLevel),
    });
  };

  const handleUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    try {
      setError(null);
      await put(`/inventory/items/${editingItem.id}`, {
        ...editForm,
        category: editForm.category || null,
      });
      setSuccess(`Item '${editForm.name}' updated successfully`);
      setEditingItem(null);
      loadData();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDeleteItem = async () => {
    if (!deletingItem) return;
    try {
      setError(null);
      await del(`/inventory/items/${deletingItem.id}`);
      setSuccess(`Item '${deletingItem.name}' has been deleted`);
      setDeletingItem(null);
      loadData();
    } catch (e: any) {
      setError(e.message);
      setDeletingItem(null);
    }
  };

  const handleToggleActive = async (item: InventoryItem) => {
    try {
      setError(null);
      await put(`/inventory/items/${item.id}`, { isActive: !item.isActive });
      setSuccess(`Item '${item.name}' ${item.isActive ? 'deactivated' : 'activated'} successfully`);
      loadData();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDeleteWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deletingWarehouse) return;
    try {
      setDeleteWhLoading(true);
      setError(null);
      const res = await del<{ success: boolean; message: string }>(`/inventory/warehouses/${deletingWarehouse.id}`, {
        password: deleteWhPassword,
      });
      setSuccess(res.message);
      setDeletingWarehouse(null);
      setDeleteWhPassword('');
      loadData();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDeleteWhLoading(false);
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
                <th className="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((i) => (
                <tr key={i.id} className={`hover:bg-slate-50/70 ${!i.isActive ? 'opacity-50' : ''}`}>
                  <td className="td font-mono font-medium text-indigo-600">{i.sku}</td>
                  <td className="td font-medium text-slate-900">
                    <div className="flex items-center gap-2">
                      {i.name}
                      {!i.isActive && (
                        <span className="inline-flex items-center rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 uppercase">
                          Inactive
                        </span>
                      )}
                    </div>
                  </td>
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
                  <td className="td text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 transition-colors"
                        title="Edit item"
                        onClick={() => openEditModal(i)}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                        Edit
                      </button>
                      <button
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                          i.isActive
                            ? 'text-amber-600 hover:bg-amber-50'
                            : 'text-emerald-600 hover:bg-emerald-50'
                        }`}
                        title={i.isActive ? 'Deactivate item' : 'Activate item'}
                        onClick={() => handleToggleActive(i)}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                          {i.isActive ? (
                            <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                          ) : (
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          )}
                        </svg>
                        {i.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Delete item"
                        onClick={() => setDeletingItem(i)}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
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
                <div className="flex items-center gap-2">
                  <StatusBadge status={w.isActive ? 'active' : 'inactive'} />
                  {isOwner && (
                    <button
                      className="rounded-md p-1 text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Delete warehouse (owner only)"
                      onClick={() => { setDeletingWarehouse(w); setDeleteWhPassword(''); }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  )}
                </div>
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
          {warehouses.length === 0 && !loading && (
            <div className="col-span-3 p-8 text-center text-slate-500">
              {t('common.no_records', 'No warehouses found. Add your first warehouse.')}
            </div>
          )}
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

      {/* MODAL: Edit Item */}
      {editingItem && (
        <Modal title={`Edit Item: ${editingItem.sku}`} onClose={() => setEditingItem(null)}>
          <form onSubmit={handleUpdateItem} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">{t('inventory.sku', 'SKU / Code')}</label>
                <input
                  type="text"
                  className="input"
                  required
                  value={editForm.sku}
                  onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })}
                />
              </div>
              <div>
                <label className="label">{t('inventory.category', 'Category')}</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Hardware"
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="label">{t('inventory.item_name', 'Item Name')}</label>
              <input
                type="text"
                className="input"
                required
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">{t('inventory.uom', 'Unit of Measure')}</label>
                <input
                  type="text"
                  className="input"
                  value={editForm.uom}
                  onChange={(e) => setEditForm({ ...editForm, uom: e.target.value })}
                />
              </div>
              <div>
                <label className="label">{t('inventory.cost_price', 'Cost Price (PKR)')}</label>
                <input
                  type="number"
                  step="0.01"
                  className="input font-mono"
                  value={editForm.costPrice}
                  onChange={(e) => setEditForm({ ...editForm, costPrice: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label className="label">{t('inventory.selling_price', 'Selling Price')}</label>
                <input
                  type="number"
                  step="0.01"
                  className="input font-mono"
                  value={editForm.sellingPrice}
                  onChange={(e) => setEditForm({ ...editForm, sellingPrice: parseFloat(e.target.value) || 0 })}
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
                  value={editForm.taxRate}
                  onChange={(e) => setEditForm({ ...editForm, taxRate: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label className="label">{t('inventory.reorder_level', 'Reorder Level Alert')}</label>
                <input
                  type="number"
                  step="1"
                  className="input font-mono"
                  value={editForm.reorderLevel}
                  onChange={(e) => setEditForm({ ...editForm, reorderLevel: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setEditingItem(null)}>
                {t('common.cancel', 'Cancel')}
              </button>
              <button type="submit" className="btn">
                {t('common.save', 'Update Item')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: Delete Confirmation */}
      {deletingItem && (
        <Modal title="Confirm Deletion" onClose={() => setDeletingItem(null)}>
          <div className="space-y-4">
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-4">
              <p className="text-sm text-rose-800">
                <span className="font-bold">Warning:</span> You are about to permanently delete the item:
              </p>
              <div className="mt-3 flex items-center gap-3">
                <span className="font-mono text-xs font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded">
                  {deletingItem.sku}
                </span>
                <span className="font-semibold text-rose-900">{deletingItem.name}</span>
              </div>
              <p className="mt-3 text-xs text-rose-600">
                Items with stock movements or invoice references cannot be deleted — they can only be deactivated.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setDeletingItem(null)}>
                Cancel
              </button>
              <button
                className="btn bg-rose-600 hover:bg-rose-700"
                onClick={handleDeleteItem}
              >
                Delete Permanently
              </button>
            </div>
          </div>
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

      {/* MODAL: Delete Warehouse (Owner Password-Protected) */}
      {deletingWarehouse && (
        <Modal
          title={`Delete Warehouse: ${deletingWarehouse.code}`}
          onClose={() => { if (!deleteWhLoading) { setDeletingWarehouse(null); setDeleteWhPassword(''); } }}
        >
          <form onSubmit={handleDeleteWarehouse} className="space-y-4 text-xs">
            {/* Danger warning */}
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-rose-800 space-y-1">
              <p className="font-bold flex items-center gap-1.5 text-rose-900">
                ⚠️ Permanent Deletion Warning
              </p>
              <p>
                This will permanently delete the warehouse from the system.
                Warehouses with stock movement history or linked purchase bills cannot be deleted.
              </p>
            </div>

            {/* Warehouse summary */}
            <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                    {deletingWarehouse.code}
                  </span>
                  <p className="font-semibold text-slate-800 mt-1.5">{deletingWarehouse.name}</p>
                  <p className="text-slate-500 mt-0.5">{deletingWarehouse.address || 'No address'}</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-500">Unique Products: <b>{deletingWarehouse.uniqueItemCount}</b></p>
                  <p className="text-slate-500">Total Units: <b className="font-mono">{Number(deletingWarehouse.totalUnitsInStock).toLocaleString()}</b></p>
                </div>
              </div>
              {(deletingWarehouse.uniqueItemCount > 0 || Number(deletingWarehouse.totalUnitsInStock) !== 0) && (
                <p className="mt-2 text-amber-700 font-semibold">
                  ⚠️ This warehouse has existing stock records. Deletion will be blocked by the server.
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="label text-xs font-semibold text-slate-800">
                Owner Account Password *
              </label>
              <input
                id="delete-warehouse-password"
                type="password"
                required
                className="input"
                placeholder="Enter owner password to authorize deletion..."
                value={deleteWhPassword}
                onChange={(e) => setDeleteWhPassword(e.target.value)}
                autoFocus
                autoComplete="current-password"
              />
              <p className="text-[11px] text-slate-400 mt-0.5">
                Company owner authentication is required to delete warehouses.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                className="btn-ghost text-xs"
                disabled={deleteWhLoading}
                onClick={() => { setDeletingWarehouse(null); setDeleteWhPassword(''); }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn bg-rose-600 hover:bg-rose-700 text-xs py-2 px-4 shadow-sm font-medium"
                disabled={deleteWhLoading}
              >
                {deleteWhLoading ? 'Verifying & Deleting…' : '🗑️ Confirm Delete Warehouse'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
