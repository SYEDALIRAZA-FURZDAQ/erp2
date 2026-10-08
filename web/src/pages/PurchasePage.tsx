import { useEffect, useState } from 'react';
import { api, post } from '../lib/api';
import { ErrorBox, Modal, PageHeader, StatusBadge, SuccessBox } from '../components/ui';

interface Vendor {
  id: string;
  name: string;
  ntn: string | null;
  strn: string | null;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  paymentTerms: string | null;
  totalBilled: string;
}

interface PurchaseBill {
  id: string;
  billNumber: string;
  billDate: string;
  dueDate: string | null;
  status: string;
  subtotal: string;
  taxAmount: string;
  grandTotal: string;
  vendorName: string;
  vendorNtn: string | null;
}

interface Item {
  id: string;
  sku: string;
  name: string;
  costPrice: number;
}

interface Warehouse {
  id: string;
  name: string;
}

export default function PurchasePage() {
  const [tab, setTab] = useState<'bills' | 'vendors'>('bills');
  const [bills, setBills] = useState<PurchaseBill[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modals
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [showBillModal, setShowBillModal] = useState(false);
  const [selectedBill, setSelectedBill] = useState<any | null>(null);

  // New Vendor Form
  const [vendorForm, setVendorForm] = useState({
    name: '',
    ntn: '',
    strn: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    paymentTerms: 'Net 30',
  });

  // New Bill Form
  const [billForm, setBillForm] = useState({
    vendorId: '',
    warehouseId: '',
    billDate: new Date().toISOString().slice(0, 10),
    dueDate: '',
    notes: '',
    items: [{ itemId: '', description: '', quantity: 1, unitCost: 0, taxRate: 0 }],
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [billsRes, vensRes, itms, whs] = await Promise.all([
        api<{ items: PurchaseBill[] }>('/purchase/bills'),
        api<Vendor[]>('/purchase/vendors'),
        api<Item[]>('/inventory/items').catch(() => []),
        api<Warehouse[]>('/inventory/warehouses').catch(() => []),
      ]);
      setBills(billsRes.items);
      setVendors(vensRes);
      setItems(itms);
      setWarehouses(whs);
      if (vensRes.length > 0 && !billForm.vendorId) {
        setBillForm((f) => ({ ...f, vendorId: vensRes[0].id }));
      }
      if (whs.length > 0 && !billForm.warehouseId) {
        setBillForm((f) => ({ ...f, warehouseId: whs[0].id }));
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

  const handleCreateVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      await post('/purchase/vendors', vendorForm);
      setSuccess('Supplier / Vendor added successfully');
      setShowVendorModal(false);
      setVendorForm({
        name: '',
        ntn: '',
        strn: '',
        contactPerson: '',
        phone: '',
        email: '',
        address: '',
        city: '',
        paymentTerms: 'Net 30',
      });
      loadData();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleCreateBill = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      await post('/purchase/bills', billForm);
      setSuccess('Purchase bill created and stock received successfully');
      setShowBillModal(false);
      loadData();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const viewBillDetails = async (id: string) => {
    try {
      const b = await api<any>(`/purchase/bills/${id}`);
      setSelectedBill(b);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      await post(`/purchase/bills/${id}/status`, { status });
      setSuccess(`Bill marked as ${status}`);
      loadData();
      if (selectedBill) viewBillDetails(id);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const addBillItem = () => {
    setBillForm({
      ...billForm,
      items: [...billForm.items, { itemId: '', description: '', quantity: 1, unitCost: 0, taxRate: 0 }],
    });
  };

  const removeBillItem = (idx: number) => {
    if (billForm.items.length <= 1) return;
    setBillForm({
      ...billForm,
      items: billForm.items.filter((_, i) => i !== idx),
    });
  };

  const calcSubtotal = billForm.items.reduce((s, i) => s + (i.quantity * i.unitCost), 0);
  const calcTax = billForm.items.reduce((s, i) => s + ((i.quantity * i.unitCost * i.taxRate) / 100), 0);
  const calcTotal = calcSubtotal + calcTax;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase & Supplier Management"
        subtitle="Manage Vendors, Purchase Orders, Bills, and automated inventory receiving"
      >
        {tab === 'bills' && (
          <button className="btn" onClick={() => setShowBillModal(true)}>
            + New Purchase Bill
          </button>
        )}
        {tab === 'vendors' && (
          <button className="btn" onClick={() => setShowVendorModal(true)}>
            + New Supplier
          </button>
        )}
      </PageHeader>

      <ErrorBox message={error} />
      <SuccessBox message={success} />

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
            tab === 'bills'
              ? 'border-indigo-600 text-indigo-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setTab('bills')}
        >
          Purchase Bills
        </button>
        <button
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
            tab === 'vendors'
              ? 'border-indigo-600 text-indigo-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setTab('vendors')}
        >
          Suppliers / Vendors Directory
        </button>
      </div>

      {/* TAB 1: Bills */}
      {tab === 'bills' && (
        <div className="card overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="th">Bill #</th>
                <th className="th">Date</th>
                <th className="th">Supplier</th>
                <th className="th text-right">Subtotal</th>
                <th className="th text-right">Tax</th>
                <th className="th text-right">Total (PKR)</th>
                <th className="th text-center">Status</th>
                <th className="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bills.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50/70">
                  <td className="td font-mono font-medium text-indigo-600">{b.billNumber}</td>
                  <td className="td text-slate-600">{b.billDate}</td>
                  <td className="td">
                    <div className="font-medium text-slate-900">{b.vendorName}</div>
                    {b.vendorNtn && <div className="text-xs text-slate-400">NTN: {b.vendorNtn}</div>}
                  </td>
                  <td className="td text-right font-mono text-slate-600">
                    {Number(b.subtotal).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="td text-right font-mono text-slate-600">
                    {Number(b.taxAmount).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="td text-right font-mono font-bold text-slate-900">
                    PKR {Number(b.grandTotal).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="td text-center">
                    <StatusBadge status={b.status} />
                  </td>
                  <td className="td text-right space-x-2">
                    <button className="btn-ghost text-xs" onClick={() => viewBillDetails(b.id)}>
                      View Details
                    </button>
                    {b.status !== 'paid' && (
                      <button
                        className="btn bg-emerald-600 hover:bg-emerald-700 text-xs py-1 px-2.5"
                        onClick={() => handleUpdateStatus(b.id, 'paid')}
                      >
                        Mark Paid
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {bills.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    No purchase bills recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: Vendors */}
      {tab === 'vendors' && (
        <div className="card overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="th">Vendor Name</th>
                <th className="th">NTN / STRN</th>
                <th className="th">Contact Person</th>
                <th className="th">Phone & Email</th>
                <th className="th">City</th>
                <th className="th">Payment Terms</th>
                <th className="th text-right">Total Purchases</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {vendors.map((v) => (
                <tr key={v.id} className="hover:bg-slate-50/70">
                  <td className="td font-medium text-slate-900">{v.name}</td>
                  <td className="td font-mono text-slate-600">
                    <div>{v.ntn || '—'}</div>
                    {v.strn && <div className="text-xs text-slate-400">STRN: {v.strn}</div>}
                  </td>
                  <td className="td text-slate-700">{v.contactPerson || '—'}</td>
                  <td className="td text-slate-600">
                    <div>{v.phone || '—'}</div>
                    <div className="text-xs text-slate-400">{v.email}</div>
                  </td>
                  <td className="td text-slate-600">{v.city || '—'}</td>
                  <td className="td">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                      {v.paymentTerms || 'Standard'}
                    </span>
                  </td>
                  <td className="td text-right font-mono font-bold text-slate-900">
                    PKR {Number(v.totalBilled).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
              {vendors.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No suppliers found. Add your first vendor.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL: Create Vendor */}
      {showVendorModal && (
        <Modal title="Add Supplier / Vendor" onClose={() => setShowVendorModal(false)}>
          <form onSubmit={handleCreateVendor} className="space-y-4">
            <div>
              <label className="label">Company / Vendor Name</label>
              <input
                type="text"
                className="input"
                required
                placeholder="e.g. Premier Tech Distributing"
                value={vendorForm.name}
                onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">NTN</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. 4912384-5"
                  value={vendorForm.ntn}
                  onChange={(e) => setVendorForm({ ...vendorForm, ntn: e.target.value })}
                />
              </div>
              <div>
                <label className="label">STRN</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. 1700491238411"
                  value={vendorForm.strn}
                  onChange={(e) => setVendorForm({ ...vendorForm, strn: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Contact Person</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Kamran Sheikh"
                  value={vendorForm.contactPerson}
                  onChange={(e) => setVendorForm({ ...vendorForm, contactPerson: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Payment Terms</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Net 30"
                  value={vendorForm.paymentTerms}
                  onChange={(e) => setVendorForm({ ...vendorForm, paymentTerms: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Phone</label>
                <input
                  type="text"
                  className="input"
                  placeholder="+92-42-35789012"
                  value={vendorForm.phone}
                  onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="label">City</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Lahore"
                  value={vendorForm.city}
                  onChange={(e) => setVendorForm({ ...vendorForm, city: e.target.value })}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setShowVendorModal(false)}>
                Cancel
              </button>
              <button type="submit" className="btn">
                Save Vendor
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: Create Purchase Bill */}
      {showBillModal && (
        <Modal title="Create Purchase Bill" maxWidth="max-w-3xl" onClose={() => setShowBillModal(false)}>
          <form onSubmit={handleCreateBill} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Supplier / Vendor</label>
                <select
                  className="input"
                  required
                  value={billForm.vendorId}
                  onChange={(e) => setBillForm({ ...billForm, vendorId: e.target.value })}
                >
                  <option value="">Select vendor...</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} {v.ntn ? `(NTN: ${v.ntn})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Bill Date</label>
                <input
                  type="date"
                  className="input"
                  required
                  value={billForm.billDate}
                  onChange={(e) => setBillForm({ ...billForm, billDate: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Receive into Warehouse</label>
                <select
                  className="input"
                  value={billForm.warehouseId}
                  onChange={(e) => setBillForm({ ...billForm, warehouseId: e.target.value })}
                >
                  <option value="">No automatic stock add</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Bill Lines */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Bill Items</span>
                <button type="button" className="text-xs text-indigo-600 font-semibold hover:underline" onClick={addBillItem}>
                  + Add Line Item
                </button>
              </div>

              <div className="space-y-2">
                {billForm.items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <select
                      className="input w-48 text-xs"
                      value={item.itemId}
                      onChange={(e) => {
                        const sel = items.find((i) => i.id === e.target.value);
                        const newItems = [...billForm.items];
                        newItems[idx].itemId = e.target.value;
                        if (sel) {
                          newItems[idx].description = sel.name;
                          newItems[idx].unitCost = Number(sel.costPrice);
                        }
                        setBillForm({ ...billForm, items: newItems });
                      }}
                    >
                      <option value="">Catalog Item...</option>
                      {items.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.sku} - {i.name}
                        </option>
                      ))}
                    </select>

                    <input
                      type="text"
                      className="input flex-1 text-sm"
                      placeholder="Item description..."
                      required
                      value={item.description}
                      onChange={(e) => {
                        const newItems = [...billForm.items];
                        newItems[idx].description = e.target.value;
                        setBillForm({ ...billForm, items: newItems });
                      }}
                    />

                    <input
                      type="number"
                      step="1"
                      min="1"
                      className="input w-20 text-right font-mono"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => {
                        const newItems = [...billForm.items];
                        newItems[idx].quantity = parseFloat(e.target.value) || 1;
                        setBillForm({ ...billForm, items: newItems });
                      }}
                    />

                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="input w-28 text-right font-mono"
                      placeholder="Unit Cost"
                      value={item.unitCost || ''}
                      onChange={(e) => {
                        const newItems = [...billForm.items];
                        newItems[idx].unitCost = parseFloat(e.target.value) || 0;
                        setBillForm({ ...billForm, items: newItems });
                      }}
                    />

                    {billForm.items.length > 1 && (
                      <button
                        type="button"
                        className="text-slate-400 hover:text-rose-600 px-1"
                        onClick={() => removeBillItem(idx)}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Totals Box */}
              <div className="mt-4 rounded-lg bg-slate-50 p-4 flex justify-between items-center text-sm">
                <div>
                  <span className="text-slate-500">Subtotal:</span>{' '}
                  <b className="font-mono text-slate-800">PKR {calcSubtotal.toFixed(2)}</b>
                </div>
                <div className="text-right">
                  <span className="text-slate-500">Total Billed:</span>{' '}
                  <b className="font-mono text-indigo-700 text-base">PKR {calcTotal.toFixed(2)}</b>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setShowBillModal(false)}>
                Cancel
              </button>
              <button type="submit" className="btn">
                Receive & Save Bill
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: View Bill Details */}
      {selectedBill && (
        <Modal title={`Purchase Bill ${selectedBill.billNumber}`} onClose={() => setSelectedBill(null)}>
          <div className="space-y-4">
            <div className="flex justify-between border-b pb-3">
              <div>
                <p className="text-xs text-slate-500">Supplier</p>
                <p className="font-bold text-slate-900">{selectedBill.vendorName}</p>
                <p className="text-xs text-slate-600">NTN: {selectedBill.vendorNtn || '—'}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">Date: {selectedBill.billDate}</p>
                <StatusBadge status={selectedBill.status} />
              </div>
            </div>

            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-slate-500">
                  <th className="py-2 text-left">Item Description</th>
                  <th className="py-2 text-right">Qty</th>
                  <th className="py-2 text-right">Cost</th>
                  <th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {selectedBill.items?.map((it: any) => (
                  <tr key={it.id}>
                    <td className="py-2">{it.description}</td>
                    <td className="py-2 text-right font-mono">{it.quantity}</td>
                    <td className="py-2 text-right font-mono">{Number(it.unitCost).toFixed(2)}</td>
                    <td className="py-2 text-right font-mono font-semibold">{Number(it.total).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-between border-t pt-3 font-bold text-slate-900">
              <span>Grand Total:</span>
              <span className="font-mono text-indigo-700">PKR {Number(selectedBill.grandTotal).toFixed(2)}</span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
