import { useEffect, useState } from 'react';
import { api, post } from '../lib/api';
import { ErrorBox, Modal, PageHeader, StatusBadge, SuccessBox } from '../components/ui';
import { useTranslation } from '../lib/i18n';

interface Customer {
  id: string;
  name: string;
  ntn: string | null;
  strn: string | null;
  cnic: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  buyerType: string;
  totalSales: string;
}

interface Item {
  id: string;
  sku: string;
  name: string;
  sellingPrice: number;
  taxRate: number;
}

interface Warehouse {
  id: string;
  name: string;
}

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  taxAmount: number;
  total: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  status: string;
  subtotal: string;
  discount: string;
  salesTax: string;
  posFee: string;
  grandTotal: string;
  fbrInvoiceNumber: string | null;
  fbrStatus: string;
  fbrQrCode: string | null;
  customerName: string;
  customerNtn: string | null;
  buyerType: string;
}

export default function SalesPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'invoices' | 'customers'>('invoices');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modals
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);

  // New Customer Form
  const [customerForm, setCustomerForm] = useState({
    name: '',
    ntn: '',
    strn: '',
    cnic: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    buyerType: 'registered',
  });

  // New Invoice Form
  const [invoiceForm, setInvoiceForm] = useState({
    customerId: '',
    warehouseId: '',
    invoiceDate: new Date().toISOString().slice(0, 10),
    dueDate: '',
    discount: 0,
    posFee: 1.0,
    notes: '',
    items: [
      { itemId: '', description: '', quantity: 1, unitPrice: 0, taxRate: 18 },
    ],
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [invRes, custRes, itmRes, whRes] = await Promise.all([
        api<{ items: Invoice[] }>('/sales/invoices'),
        api<Customer[]>('/sales/customers'),
        api<Item[]>('/inventory/items').catch(() => []),
        api<Warehouse[]>('/inventory/warehouses').catch(() => []),
      ]);
      setInvoices(invRes.items);
      setCustomers(custRes);
      setItems(itmRes);
      setWarehouses(whRes);
      if (custRes.length > 0 && !invoiceForm.customerId) {
        setInvoiceForm((f) => ({ ...f, customerId: custRes[0].id }));
      }
      if (whRes.length > 0 && !invoiceForm.warehouseId) {
        setInvoiceForm((f) => ({ ...f, warehouseId: whRes[0].id }));
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      await post('/sales/customers', customerForm);
      setSuccess('Customer created successfully');
      setShowCustomerModal(false);
      setCustomerForm({
        name: '',
        ntn: '',
        strn: '',
        cnic: '',
        phone: '',
        email: '',
        address: '',
        city: '',
        buyerType: 'registered',
      });
      loadData();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      await post('/sales/invoices', invoiceForm);
      setSuccess('Sales invoice created and posted successfully');
      setShowInvoiceModal(false);
      loadData();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleFbrSync = async (invoiceId: string) => {
    try {
      setError(null);
      setLoading(true);
      const res = await post<any>(`/sales/invoices/${invoiceId}/fbr-sync`);
      setSuccess(`FBR Fiscalization verified! Invoice registered under: ${res.fbrInvoiceNumber}`);
      loadData();
      if (selectedInvoice && selectedInvoice.id === invoiceId) {
        viewInvoiceDetails(invoiceId);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const viewInvoiceDetails = async (id: string) => {
    try {
      const inv = await api<any>(`/sales/invoices/${id}`);
      setSelectedInvoice(inv);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const addInvoiceItem = () => {
    setInvoiceForm({
      ...invoiceForm,
      items: [...invoiceForm.items, { itemId: '', description: '', quantity: 1, unitPrice: 0, taxRate: 18 }],
    });
  };

  const removeInvoiceItem = (idx: number) => {
    if (invoiceForm.items.length <= 1) return;
    setInvoiceForm({
      ...invoiceForm,
      items: invoiceForm.items.filter((_, i) => i !== idx),
    });
  };

  const calcSubtotal = invoiceForm.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const calcTax = invoiceForm.items.reduce((sum, item) => sum + ((item.quantity * item.unitPrice * item.taxRate) / 100), 0);
  const calcGrandTotal = calcSubtotal + calcTax + invoiceForm.posFee - invoiceForm.discount;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('sales.title', 'Sales & FBR Digital Invoicing')}
        subtitle={t('sales.subtitle', 'Manage Customers, Invoices, and Instant FBR POS Digital Invoicing Synchronization')}
      >
        {tab === 'invoices' && (
          <button className="btn" onClick={() => setShowInvoiceModal(true)}>
            {t('sales.new_invoice', '+ New Sales Invoice')}
          </button>
        )}
        {tab === 'customers' && (
          <button className="btn" onClick={() => setShowCustomerModal(true)}>
            {t('sales.new_customer', '+ New Customer')}
          </button>
        )}
      </PageHeader>

      <ErrorBox message={error} />
      <SuccessBox message={success} />

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
            tab === 'invoices'
              ? 'border-indigo-600 text-indigo-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setTab('invoices')}
        >
          {t('sales.invoices', 'Sales Invoices & FBR Status')}
        </button>
        <button
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
            tab === 'customers'
              ? 'border-indigo-600 text-indigo-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setTab('customers')}
        >
          {t('sales.customers', 'Customers Directory')}
        </button>
      </div>

      {/* TAB 1: Invoices */}
      {tab === 'invoices' && (
        <div className="card overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="th">Invoice #</th>
                <th className="th">Date</th>
                <th className="th">Customer</th>
                <th className="th text-right">Subtotal</th>
                <th className="th text-right">Tax (18%)</th>
                <th className="th text-right">Total (PKR)</th>
                <th className="th text-center">FBR Status</th>
                <th className="th text-center">Status</th>
                <th className="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50/70">
                  <td className="td font-mono font-medium text-indigo-600">{inv.invoiceNumber}</td>
                  <td className="td text-slate-600">{inv.invoiceDate}</td>
                  <td className="td">
                    <div className="font-medium text-slate-900">{inv.customerName}</div>
                    {inv.customerNtn && <div className="text-xs text-slate-400">NTN: {inv.customerNtn}</div>}
                  </td>
                  <td className="td text-right font-mono text-slate-600">
                    {Number(inv.subtotal).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="td text-right font-mono text-slate-600">
                    {Number(inv.salesTax).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="td text-right font-mono font-bold text-slate-900">
                    PKR {Number(inv.grandTotal).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="td text-center">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${
                        inv.fbrStatus === 'reported'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {inv.fbrStatus === 'reported' ? '✓ FBR Verified' : 'Pending FBR'}
                    </span>
                  </td>
                  <td className="td text-center">
                    <StatusBadge status={inv.status} />
                  </td>
                  <td className="td text-right space-x-2">
                    <button
                      className="btn-ghost text-xs"
                      onClick={() => viewInvoiceDetails(inv.id)}
                    >
                      Receipt & QR
                    </button>
                    {inv.fbrStatus !== 'reported' && (
                      <button
                        className="btn bg-emerald-600 hover:bg-emerald-700 text-xs py-1 px-2.5"
                        onClick={() => handleFbrSync(inv.id)}
                      >
                        Sync FBR
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && !loading && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-500">
                    No sales invoices recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: Customers */}
      {tab === 'customers' && (
        <div className="card overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="th">Customer Name</th>
                <th className="th">NTN / CNIC</th>
                <th className="th">Buyer Type</th>
                <th className="th">Contact</th>
                <th className="th">City</th>
                <th className="th text-right">Total Invoiced</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customers.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/70">
                  <td className="td font-medium text-slate-900">{c.name}</td>
                  <td className="td font-mono text-slate-600">
                    {c.ntn || c.cnic || '—'}
                  </td>
                  <td className="td capitalize text-slate-700">{c.buyerType}</td>
                  <td className="td text-slate-600">
                    <div>{c.phone || '—'}</div>
                    <div className="text-xs text-slate-400">{c.email}</div>
                  </td>
                  <td className="td text-slate-600">{c.city || '—'}</td>
                  <td className="td text-right font-mono font-semibold text-slate-900">
                    PKR {Number(c.totalSales).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
              {customers.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    No customers found. Add your first customer.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL: Create Customer */}
      {showCustomerModal && (
        <Modal title="Add Customer / Client" onClose={() => setShowCustomerModal(false)}>
          <form onSubmit={handleCreateCustomer} className="space-y-4">
            <div>
              <label className="label">Customer / Business Name</label>
              <input
                type="text"
                className="input"
                required
                placeholder="e.g. Apex Corporation"
                value={customerForm.name}
                onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">NTN (National Tax Number)</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. 7234912-8"
                  value={customerForm.ntn}
                  onChange={(e) => setCustomerForm({ ...customerForm, ntn: e.target.value })}
                />
              </div>
              <div>
                <label className="label">STRN (Sales Tax Reg.)</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. 3277876123456"
                  value={customerForm.strn}
                  onChange={(e) => setCustomerForm({ ...customerForm, strn: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">CNIC (for Individual)</label>
                <input
                  type="text"
                  className="input"
                  placeholder="42101-1234567-1"
                  value={customerForm.cnic}
                  onChange={(e) => setCustomerForm({ ...customerForm, cnic: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Buyer Type</label>
                <select
                  className="input"
                  value={customerForm.buyerType}
                  onChange={(e) => setCustomerForm({ ...customerForm, buyerType: e.target.value })}
                >
                  <option value="registered">Registered Corporate</option>
                  <option value="unregistered">Unregistered Business</option>
                  <option value="individual">Individual Consumer</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Phone</label>
                <input
                  type="text"
                  className="input"
                  placeholder="+92-300-1234567"
                  value={customerForm.phone}
                  onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="label">City</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Karachi"
                  value={customerForm.city}
                  onChange={(e) => setCustomerForm({ ...customerForm, city: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="label">Address</label>
              <input
                type="text"
                className="input"
                placeholder="Full street address..."
                value={customerForm.address}
                onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
              />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setShowCustomerModal(false)}>
                Cancel
              </button>
              <button type="submit" className="btn">
                Save Customer
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: Create Invoice */}
      {showInvoiceModal && (
        <Modal title="Create FBR-Compliant Sales Invoice" maxWidth="max-w-3xl" onClose={() => setShowInvoiceModal(false)}>
          <form onSubmit={handleCreateInvoice} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Customer</label>
                <select
                  className="input"
                  required
                  value={invoiceForm.customerId}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, customerId: e.target.value })}
                >
                  <option value="">Select customer...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.ntn ? `(NTN: ${c.ntn})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Invoice Date</label>
                <input
                  type="date"
                  className="input"
                  required
                  value={invoiceForm.invoiceDate}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceDate: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Fulfill from Warehouse</label>
                <select
                  className="input"
                  value={invoiceForm.warehouseId}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, warehouseId: e.target.value })}
                >
                  <option value="">No stock deduction</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Line Items */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Invoice Items</span>
                <button type="button" className="text-xs text-indigo-600 font-semibold hover:underline" onClick={addInvoiceItem}>
                  + Add Line Item
                </button>
              </div>

              <div className="space-y-2">
                {invoiceForm.items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    {/* Item Catalog Picker */}
                    <select
                      className="input w-48 text-xs"
                      value={item.itemId}
                      onChange={(e) => {
                        const sel = items.find((i) => i.id === e.target.value);
                        const newItems = [...invoiceForm.items];
                        newItems[idx].itemId = e.target.value;
                        if (sel) {
                          newItems[idx].description = sel.name;
                          newItems[idx].unitPrice = Number(sel.sellingPrice);
                          newItems[idx].taxRate = Number(sel.taxRate);
                        }
                        setInvoiceForm({ ...invoiceForm, items: newItems });
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
                        const newItems = [...invoiceForm.items];
                        newItems[idx].description = e.target.value;
                        setInvoiceForm({ ...invoiceForm, items: newItems });
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
                        const newItems = [...invoiceForm.items];
                        newItems[idx].quantity = parseFloat(e.target.value) || 1;
                        setInvoiceForm({ ...invoiceForm, items: newItems });
                      }}
                    />

                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="input w-28 text-right font-mono"
                      placeholder="Unit Price"
                      value={item.unitPrice || ''}
                      onChange={(e) => {
                        const newItems = [...invoiceForm.items];
                        newItems[idx].unitPrice = parseFloat(e.target.value) || 0;
                        setInvoiceForm({ ...invoiceForm, items: newItems });
                      }}
                    />

                    <div className="w-16 text-right font-mono text-xs text-slate-500">
                      {item.taxRate}%
                    </div>

                    {invoiceForm.items.length > 1 && (
                      <button
                        type="button"
                        className="text-slate-400 hover:text-rose-600 px-1"
                        onClick={() => removeInvoiceItem(idx)}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Calculations Box */}
              <div className="mt-4 rounded-lg bg-slate-50 p-4 space-y-1.5 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span className="font-mono">PKR {calcSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Sales Tax (18% FBR Standard):</span>
                  <span className="font-mono">PKR {calcTax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>FBR Standard POS Service Fee:</span>
                  <span className="font-mono">PKR {invoiceForm.posFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-slate-900 text-base">
                  <span>Grand Total (PKR):</span>
                  <span className="font-mono text-indigo-700">PKR {calcGrandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setShowInvoiceModal(false)}>
                Cancel
              </button>
              <button type="submit" className="btn">
                Generate Invoice
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: Invoice Receipt & FBR QR Preview */}
      {selectedInvoice && (
        <Modal
          title={`Invoice ${selectedInvoice.invoiceNumber}`}
          maxWidth="max-w-2xl"
          onClose={() => setSelectedInvoice(null)}
        >
          <div className="space-y-6 print:p-0">
            {/* FBR Compliance Banner */}
            <div
              className={`rounded-lg p-4 border flex items-center justify-between ${
                selectedInvoice.fbrStatus === 'reported'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}
            >
              <div>
                <p className="font-bold text-sm">
                  {selectedInvoice.fbrStatus === 'reported'
                    ? '✓ OFFICIAL FBR DIGITAL INVOICE VERIFIED'
                    : '⚠ FBR FISCALIZATION PENDING'}
                </p>
                <p className="text-xs mt-0.5">
                  FBR Invoice No:{' '}
                  <span className="font-mono font-semibold">
                    {selectedInvoice.fbrInvoiceNumber || 'Not generated yet'}
                  </span>
                </p>
              </div>
              {selectedInvoice.fbrStatus !== 'reported' && (
                <button
                  className="btn bg-emerald-600 hover:bg-emerald-700 text-xs py-1.5"
                  onClick={() => handleFbrSync(selectedInvoice.id)}
                >
                  Transmit to FBR Now
                </button>
              )}
            </div>

            {/* Receipt Header */}
            <div className="border-b border-slate-200 pb-4 flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{selectedInvoice.company?.name || 'Company'}</h3>
                <p className="text-xs text-slate-500">{selectedInvoice.company?.address || 'Pakistan'}</p>
                <p className="text-xs text-slate-600 mt-1">
                  <b>STRN:</b> {selectedInvoice.company?.strn || '1700491238411'} | <b>NTN:</b>{' '}
                  {selectedInvoice.company?.ntn || '4912384-5'}
                </p>
              </div>
              <div className="text-right text-xs text-slate-600">
                <p className="font-mono font-bold text-slate-900 text-sm">{selectedInvoice.invoiceNumber}</p>
                <p>Date: {selectedInvoice.invoiceDate}</p>
                <p>Status: <b className="uppercase">{selectedInvoice.status}</b></p>
              </div>
            </div>

            {/* Customer Details */}
            <div className="text-xs text-slate-700 bg-slate-50 p-3 rounded">
              <p className="font-bold text-slate-900">Billed To:</p>
              <p className="font-medium">{selectedInvoice.customerName}</p>
              <p>NTN / CNIC: {selectedInvoice.customerNtn || selectedInvoice.customerCnic || 'Unregistered'}</p>
              <p>{selectedInvoice.customerAddress || selectedInvoice.customerCity}</p>
            </div>

            {/* Line Items Table */}
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                  <th className="py-2 text-left">Item Description</th>
                  <th className="py-2 text-right">Qty</th>
                  <th className="py-2 text-right">Price</th>
                  <th className="py-2 text-right">Tax</th>
                  <th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {selectedInvoice.items?.map((it: any) => (
                  <tr key={it.id}>
                    <td className="py-2 font-medium text-slate-800">{it.description}</td>
                    <td className="py-2 text-right font-mono">{it.quantity}</td>
                    <td className="py-2 text-right font-mono">{Number(it.unitPrice).toFixed(2)}</td>
                    <td className="py-2 text-right font-mono">{Number(it.taxAmount).toFixed(2)}</td>
                    <td className="py-2 text-right font-mono font-semibold">{Number(it.total).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals & QR Section */}
            <div className="flex justify-between items-end border-t border-slate-200 pt-4">
              {/* Simulated FBR QR Matrix */}
              <div className="flex items-center gap-3">
                <div className="w-24 h-24 border-2 border-slate-900 p-1 bg-white flex flex-col justify-between">
                  <div className="flex justify-between">
                    <div className="w-6 h-6 bg-slate-900" />
                    <div className="w-6 h-6 bg-slate-900" />
                  </div>
                  <div className="flex justify-center items-center font-mono text-[9px] font-bold text-center">
                    FBR-POS QR
                  </div>
                  <div className="flex justify-between">
                    <div className="w-6 h-6 bg-slate-900" />
                    <div className="w-2 h-2 bg-slate-900" />
                  </div>
                </div>
                <div className="text-[10px] text-slate-500 max-w-[200px]">
                  <p className="font-bold text-slate-700">FBR POS QR Code</p>
                  <p>Scan with FBR Tax Asaan App to verify tax invoice deduction.</p>
                </div>
              </div>

              {/* Totals */}
              <div className="text-right text-xs space-y-1 w-52">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span className="font-mono">PKR {Number(selectedInvoice.subtotal).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Sales Tax:</span>
                  <span className="font-mono">PKR {Number(selectedInvoice.salesTax).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>POS Fee:</span>
                  <span className="font-mono">PKR {Number(selectedInvoice.posFee).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-slate-900 border-t border-slate-200 pt-1">
                  <span>Grand Total:</span>
                  <span className="font-mono text-indigo-700">PKR {Number(selectedInvoice.grandTotal).toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button className="btn-ghost text-xs" onClick={() => window.print()}>
                Print Official Receipt
              </button>
              <button className="btn text-xs" onClick={() => setSelectedInvoice(null)}>
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
