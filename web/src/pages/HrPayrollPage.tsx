import { useEffect, useState } from 'react';
import { api, post, put, del } from '../lib/api';
import { ErrorBox, Modal, PageHeader, StatusBadge, SuccessBox } from '../components/ui';
import { useAuth } from '../lib/auth';

interface Employee {
  id: string;
  employeeCode: string;
  fullName: string;
  cnic: string;
  email: string | null;
  phone: string | null;
  department: string;
  designation: string;
  joiningDate: string;
  basicSalary: string;
  medicalAllowance: string;
  conveyanceAllowance: string;
  bankAccount: string | null;
  status: string;
}

interface PayrollRun {
  id: string;
  runNumber: string;
  month: number;
  year: number;
  status: string;
  totalGross: string;
  totalTax: string;
  totalEobi: string;
  totalNet: string;
  paymentDate: string | null;
  employeeCount: number;
  reversedAt?: string | null;
  reversalReason?: string | null;
  declinedAt?: string | null;
  declineReason?: string | null;
}

interface Payslip {
  id: string;
  employeeCode: string;
  fullName: string;
  cnic: string;
  department: string;
  designation: string;
  basicSalary: string;
  allowances: string;
  grossSalary: string;
  incomeTax: string;
  eobiDeduction: string;
  netSalary: string;
  bankAccount: string | null;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function HrPayrollPage() {
  const { session } = useAuth();
  const isOwner = session?.user?.isOwner ?? false;

  const [tab, setTab] = useState<'employees' | 'payroll'>('employees');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modals
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedRun, setSelectedRun] = useState<{ run: PayrollRun; payslips: Payslip[] } | null>(null);
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);

  // Payroll Reversal State
  const [reversingRun, setReversingRun] = useState<PayrollRun | null>(null);
  const [reversePassword, setReversePassword] = useState('');
  const [reverseReason, setReverseReason] = useState('');
  const [reverseLoading, setReverseLoading] = useState(false);

  // Payroll Decline State
  const [decliningRun, setDecliningRun] = useState<PayrollRun | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [declineLoading, setDeclineLoading] = useState(false);

  // Payroll Deletion State (Owner only)
  const [deletingRun, setDeletingRun] = useState<PayrollRun | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Edit Employee State
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editEmployeeForm, setEditEmployeeForm] = useState({
    fullName: '',
    cnic: '',
    email: '',
    phone: '',
    department: '',
    designation: '',
    joiningDate: '',
    basicSalary: 0,
    medicalAllowance: 0,
    conveyanceAllowance: 0,
    bankAccount: '',
    status: 'active',
  });
  const [editLoading, setEditLoading] = useState(false);

  // New Employee Form
  const [employeeForm, setEmployeeForm] = useState({
    fullName: '',
    cnic: '',
    email: '',
    phone: '',
    department: 'Engineering',
    designation: 'Software Engineer',
    joiningDate: new Date().toISOString().slice(0, 10),
    basicSalary: 100000,
    medicalAllowance: 10000,
    conveyanceAllowance: 8000,
    bankAccount: '',
  });

  // Generate Payroll Form
  const now = new Date();
  const [genForm, setGenForm] = useState({
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [emps, prs] = await Promise.all([
        api<Employee[]>('/hr/employees'),
        api<PayrollRun[]>('/hr/payroll'),
      ]);
      setEmployees(emps);
      setPayrollRuns(prs);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tab]);

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      await post('/hr/employees', employeeForm);
      setSuccess('Employee record saved');
      setShowEmployeeModal(false);
      loadData();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const startEditEmployee = (emp: Employee) => {
    setError(null);
    setEditingEmployee(emp);
    setEditEmployeeForm({
      fullName: emp.fullName,
      cnic: emp.cnic,
      email: emp.email || '',
      phone: emp.phone || '',
      department: emp.department,
      designation: emp.designation,
      joiningDate: emp.joiningDate ? emp.joiningDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
      basicSalary: Number(emp.basicSalary) || 0,
      medicalAllowance: Number(emp.medicalAllowance) || 0,
      conveyanceAllowance: Number(emp.conveyanceAllowance) || 0,
      bankAccount: emp.bankAccount || '',
      status: emp.status || 'active',
    });
  };

  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;
    try {
      setEditLoading(true);
      setError(null);
      await put(`/hr/employees/${editingEmployee.id}`, editEmployeeForm);
      setSuccess(`Employee ${editEmployeeForm.fullName} updated successfully`);
      setEditingEmployee(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to update employee');
    } finally {
      setEditLoading(false);
    }
  };

  const handleGeneratePayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      await post('/hr/payroll/generate', genForm);
      setSuccess(`Payroll for ${MONTHS[genForm.month - 1]} ${genForm.year} generated successfully`);
      setShowGenerateModal(false);
      loadData();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const viewPayrollRun = async (id: string) => {
    try {
      const data = await api<any>(`/hr/payroll/${id}`);
      setSelectedRun({ run: data, payslips: data.payslips });
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleUpdateStatus = async (runId: string, status: string, reason?: string) => {
    try {
      setError(null);
      await post(`/hr/payroll/${runId}/status`, { status, reason });
      setSuccess(`Payroll status changed to ${status}`);
      await loadData();
      if (selectedRun?.run.id === runId) {
        viewPayrollRun(runId);
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDeclinePayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!decliningRun) return;
    try {
      setDeclineLoading(true);
      setError(null);
      await post(`/hr/payroll/${decliningRun.id}/status`, {
        status: 'declined',
        reason: declineReason || 'Declined during review',
      });
      setSuccess(`Payroll run ${decliningRun.runNumber} marked as Declined.`);
      const runId = decliningRun.id;
      setDecliningRun(null);
      setDeclineReason('');
      await loadData();
      if (selectedRun?.run.id === runId) {
        viewPayrollRun(runId);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to decline payroll run');
    } finally {
      setDeclineLoading(false);
    }
  };

  const handleDeletePayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deletingRun) return;
    try {
      setDeleteLoading(true);
      setError(null);
      const res = await del<{ success: boolean; message: string }>(`/hr/payroll/${deletingRun.id}`, {
        password: deletePassword,
      });
      setSuccess(res.message);
      if (selectedRun?.run.id === deletingRun.id) {
        setSelectedRun(null);
      }
      setDeletingRun(null);
      setDeletePassword('');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete payroll run');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleReversePayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reversingRun) return;
    try {
      setReverseLoading(true);
      setError(null);
      const res = await post<{ success: boolean; message: string }>(`/hr/payroll/${reversingRun.id}/reverse`, {
        password: reversePassword,
        reason: reverseReason,
      });
      setSuccess(res.message);
      setReversingRun(null);
      setReversePassword('');
      setReverseReason('');
      await loadData();
      if (selectedRun?.run.id === reversingRun.id) {
        setSelectedRun(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to reverse payroll run');
    } finally {
      setReverseLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="HR & Payroll (Pakistan Compliant)"
        subtitle="Manage employees, salary structures, income tax calculation, EOBI social security, and payslips"
      >
        {tab === 'employees' && (
          <button className="btn" onClick={() => setShowEmployeeModal(true)}>
            + Add Employee
          </button>
        )}
        {tab === 'payroll' && (
          <button className="btn" onClick={() => setShowGenerateModal(true)}>
            ⚡ Generate Monthly Payroll
          </button>
        )}
      </PageHeader>

      <ErrorBox message={error} />
      <SuccessBox message={success} />

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
            tab === 'employees'
              ? 'border-indigo-600 text-indigo-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setTab('employees')}
        >
          Employees Directory
        </button>
        <button
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
            tab === 'payroll'
              ? 'border-indigo-600 text-indigo-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setTab('payroll')}
        >
          Payroll Runs & Disbursements
        </button>
      </div>

      {/* TAB 1: Employees */}
      {tab === 'employees' && (
        <div className="card overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="th">Emp Code</th>
                <th className="th">Full Name</th>
                <th className="th">CNIC</th>
                <th className="th">Department / Role</th>
                <th className="th text-right">Basic Salary</th>
                <th className="th text-right">Allowances</th>
                <th className="th text-right">Gross Salary</th>
                <th className="th text-center">Status</th>
                <th className="th text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employees.map((emp) => {
                const basic = Number(emp.basicSalary);
                const allowances = Number(emp.medicalAllowance) + Number(emp.conveyanceAllowance);
                const gross = basic + allowances;
                return (
                  <tr key={emp.id} className="hover:bg-slate-50/70">
                    <td className="td font-mono font-medium text-indigo-600">{emp.employeeCode}</td>
                    <td className="td">
                      <div className="font-medium text-slate-900">{emp.fullName}</div>
                      <div className="text-xs text-slate-400">{emp.email || emp.phone}</div>
                    </td>
                    <td className="td font-mono text-slate-600">{emp.cnic}</td>
                    <td className="td text-slate-700">
                      <div>{emp.department}</div>
                      <div className="text-xs text-slate-500">{emp.designation}</div>
                    </td>
                    <td className="td text-right font-mono text-slate-600">
                      PKR {basic.toLocaleString('en-PK')}
                    </td>
                    <td className="td text-right font-mono text-slate-600">
                      PKR {allowances.toLocaleString('en-PK')}
                    </td>
                    <td className="td text-right font-mono font-bold text-slate-900">
                      PKR {gross.toLocaleString('en-PK')}
                    </td>
                    <td className="td text-center">
                      <StatusBadge status={emp.status} />
                    </td>
                    <td className="td text-right">
                      <button
                        className="btn bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs py-1 px-2.5 font-medium border border-indigo-200 shadow-2xs"
                        onClick={() => startEditEmployee(emp)}
                      >
                        ✏️ Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
              {employees.length === 0 && !loading && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-500">
                    No employees registered yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: Payroll */}
      {tab === 'payroll' && (
        <div className="card overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="th">Run #</th>
                <th className="th">Period</th>
                <th className="th text-center">Staff Count</th>
                <th className="th text-right">Total Gross</th>
                <th className="th text-right">Tax Withheld</th>
                <th className="th text-right">EOBI Deduct</th>
                <th className="th text-right">Net Payable</th>
                <th className="th text-center">Status</th>
                <th className="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payrollRuns.map((pr) => (
                <tr key={pr.id} className="hover:bg-slate-50/70">
                  <td className="td font-mono font-medium text-indigo-600">{pr.runNumber}</td>
                  <td className="td font-medium text-slate-900">
                    {MONTHS[pr.month - 1]} {pr.year}
                  </td>
                  <td className="td text-center">{pr.employeeCount}</td>
                  <td className="td text-right font-mono text-slate-600">
                    PKR {Number(pr.totalGross).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="td text-right font-mono text-rose-600">
                    PKR {Number(pr.totalTax).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="td text-right font-mono text-slate-600">
                    PKR {Number(pr.totalEobi).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="td text-right font-mono font-bold text-slate-900">
                    PKR {Number(pr.totalNet).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="td text-center">
                    <div className="flex flex-col items-center gap-0.5">
                      <StatusBadge status={pr.status} />
                      {pr.status === 'declined' && pr.declineReason && (
                        <span className="text-[10px] text-rose-600 max-w-[130px] truncate" title={pr.declineReason}>
                          {pr.declineReason}
                        </span>
                      )}
                      {pr.status === 'draft' && pr.reversalReason && (
                        <span className="text-[10px] text-amber-600 max-w-[130px] truncate" title={pr.reversalReason}>
                          Reversed
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="td text-right space-x-1.5 whitespace-nowrap">
                    <button className="btn-ghost text-xs py-1 px-2" onClick={() => viewPayrollRun(pr.id)}>
                      Payslips
                    </button>
                    {pr.status === 'draft' && (
                      <>
                        <button
                          className="btn bg-blue-600 hover:bg-blue-700 text-xs py-1 px-2.5 font-medium"
                          onClick={() => handleUpdateStatus(pr.id, 'approved')}
                          title="Approve this payroll run for disbursement"
                        >
                          Approve
                        </button>
                        <button
                          className="btn bg-amber-600 hover:bg-amber-700 text-xs py-1 px-2.5 font-medium"
                          onClick={() => {
                            setError(null);
                            setDecliningRun(pr);
                            setDeclineReason('');
                          }}
                          title="Decline this payroll run if adjustments are needed"
                        >
                          Decline
                        </button>
                      </>
                    )}
                    {pr.status === 'approved' && (
                      <>
                        <button
                          className="btn bg-emerald-600 hover:bg-emerald-700 text-xs py-1 px-2.5 font-medium"
                          onClick={() => handleUpdateStatus(pr.id, 'paid')}
                          title="Disburse salaries and post balanced journal vouchers to General Ledger"
                        >
                          Disburse / Pay
                        </button>
                        <button
                          className="btn bg-amber-600 hover:bg-amber-700 text-xs py-1 px-2.5 font-medium"
                          onClick={() => {
                            setError(null);
                            setDecliningRun(pr);
                            setDeclineReason('');
                          }}
                          title="Decline this payroll run"
                        >
                          Decline
                        </button>
                      </>
                    )}
                    {pr.status === 'declined' && (
                      <button
                        className="btn bg-blue-600 hover:bg-blue-700 text-xs py-1 px-2.5 font-medium"
                        onClick={() => handleUpdateStatus(pr.id, 'approved')}
                        title="Re-approve payroll run once checked"
                      >
                        Re-Approve
                      </button>
                    )}
                    {pr.status === 'paid' && isOwner && (
                      <button
                        className="btn bg-rose-600 hover:bg-rose-700 text-xs py-1 px-2.5 shadow-2xs font-medium"
                        title="Reverse paid payroll (Owner only)"
                        onClick={() => {
                          setError(null);
                          setReversingRun(pr);
                        }}
                      >
                        🔄 Reverse
                      </button>
                    )}
                    {isOwner && (
                      <button
                        className="btn bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 text-xs py-1 px-2 font-medium"
                        title="Delete monthly payroll to adjust allowances or basic pay and regenerate"
                        onClick={() => {
                          setError(null);
                          setDeletingRun(pr);
                          setDeletePassword('');
                        }}
                      >
                        🗑️ Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {payrollRuns.length === 0 && !loading && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-500">
                    No payroll runs generated yet. Click "Generate Monthly Payroll" to start.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL: Add Employee */}
      {showEmployeeModal && (
        <Modal title="Add Employee to Directory" maxWidth="max-w-2xl" onClose={() => setShowEmployeeModal(false)}>
          <form onSubmit={handleCreateEmployee} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Full Name</label>
                <input
                  type="text"
                  className="input"
                  required
                  placeholder="e.g. Asad Ullah"
                  value={employeeForm.fullName}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, fullName: e.target.value })}
                />
              </div>
              <div>
                <label className="label">CNIC (National ID)</label>
                <input
                  type="text"
                  className="input"
                  required
                  placeholder="42101-1234567-1"
                  value={employeeForm.cnic}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, cnic: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Department</label>
                <input
                  type="text"
                  className="input"
                  required
                  placeholder="e.g. Sales, Finance, IT"
                  value={employeeForm.department}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, department: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Designation / Title</label>
                <input
                  type="text"
                  className="input"
                  required
                  placeholder="e.g. Sales Manager"
                  value={employeeForm.designation}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, designation: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Basic Salary (PKR)</label>
                <input
                  type="number"
                  step="1000"
                  required
                  className="input font-mono"
                  value={employeeForm.basicSalary}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, basicSalary: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label className="label">Medical Allowance</label>
                <input
                  type="number"
                  step="1000"
                  className="input font-mono"
                  value={employeeForm.medicalAllowance}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, medicalAllowance: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label className="label">Conveyance Allowance</label>
                <input
                  type="number"
                  step="1000"
                  className="input font-mono"
                  value={employeeForm.conveyanceAllowance}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, conveyanceAllowance: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Bank Account / IBAN</label>
                <input
                  type="text"
                  className="input font-mono"
                  placeholder="PK36MEZN000..."
                  value={employeeForm.bankAccount}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, bankAccount: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Joining Date</label>
                <input
                  type="date"
                  className="input"
                  required
                  value={employeeForm.joiningDate}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, joiningDate: e.target.value })}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setShowEmployeeModal(false)}>
                Cancel
              </button>
              <button type="submit" className="btn">
                Save Employee
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: Edit Employee */}
      {editingEmployee && (
        <Modal
          title={`Edit Employee: ${editingEmployee.fullName} (${editingEmployee.employeeCode})`}
          maxWidth="max-w-2xl"
          onClose={() => {
            if (!editLoading) setEditingEmployee(null);
          }}
        >
          <form onSubmit={handleUpdateEmployee} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Full Name *</label>
                <input
                  type="text"
                  className="input"
                  required
                  placeholder="e.g. Asad Ullah"
                  value={editEmployeeForm.fullName}
                  onChange={(e) => setEditEmployeeForm({ ...editEmployeeForm, fullName: e.target.value })}
                />
              </div>
              <div>
                <label className="label">CNIC (National ID) *</label>
                <input
                  type="text"
                  className="input"
                  required
                  placeholder="42101-1234567-1"
                  value={editEmployeeForm.cnic}
                  onChange={(e) => setEditEmployeeForm({ ...editEmployeeForm, cnic: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Department *</label>
                <input
                  type="text"
                  className="input"
                  required
                  placeholder="e.g. Sales, Finance, IT"
                  value={editEmployeeForm.department}
                  onChange={(e) => setEditEmployeeForm({ ...editEmployeeForm, department: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Designation / Title *</label>
                <input
                  type="text"
                  className="input"
                  required
                  placeholder="e.g. Senior Manager"
                  value={editEmployeeForm.designation}
                  onChange={(e) => setEditEmployeeForm({ ...editEmployeeForm, designation: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Employment Status</label>
                <select
                  className="input"
                  value={editEmployeeForm.status}
                  onChange={(e) => setEditEmployeeForm({ ...editEmployeeForm, status: e.target.value })}
                >
                  <option value="active">Active</option>
                  <option value="on_leave">On Leave</option>
                  <option value="resigned">Resigned</option>
                  <option value="terminated">Terminated</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Official / Personal Email</label>
                <input
                  type="email"
                  className="input"
                  placeholder="employee@company.com"
                  value={editEmployeeForm.email}
                  onChange={(e) => setEditEmployeeForm({ ...editEmployeeForm, email: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Phone Number</label>
                <input
                  type="tel"
                  className="input"
                  placeholder="+92 300 1234567"
                  value={editEmployeeForm.phone}
                  onChange={(e) => setEditEmployeeForm({ ...editEmployeeForm, phone: e.target.value })}
                />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-3">
              <div className="flex justify-between items-center border-b border-slate-200/80 pb-2">
                <span className="text-xs font-semibold text-slate-800">Compensation & Allowances (PKR)</span>
                <span className="text-xs font-mono font-bold text-slate-900">
                  Gross: PKR {(editEmployeeForm.basicSalary + editEmployeeForm.medicalAllowance + editEmployeeForm.conveyanceAllowance).toLocaleString('en-PK')}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label text-[11px]">Basic Salary *</label>
                  <input
                    type="number"
                    step="500"
                    min={0}
                    required
                    className="input font-mono"
                    value={editEmployeeForm.basicSalary}
                    onChange={(e) => setEditEmployeeForm({ ...editEmployeeForm, basicSalary: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="label text-[11px]">Medical Allowance</label>
                  <input
                    type="number"
                    step="500"
                    min={0}
                    className="input font-mono"
                    value={editEmployeeForm.medicalAllowance}
                    onChange={(e) => setEditEmployeeForm({ ...editEmployeeForm, medicalAllowance: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="label text-[11px]">Conveyance Allowance</label>
                  <input
                    type="number"
                    step="500"
                    min={0}
                    className="input font-mono"
                    value={editEmployeeForm.conveyanceAllowance}
                    onChange={(e) => setEditEmployeeForm({ ...editEmployeeForm, conveyanceAllowance: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Bank Account / IBAN</label>
                <input
                  type="text"
                  className="input font-mono"
                  placeholder="PK36MEZN000..."
                  value={editEmployeeForm.bankAccount}
                  onChange={(e) => setEditEmployeeForm({ ...editEmployeeForm, bankAccount: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Joining Date</label>
                <input
                  type="date"
                  className="input"
                  required
                  value={editEmployeeForm.joiningDate}
                  onChange={(e) => setEditEmployeeForm({ ...editEmployeeForm, joiningDate: e.target.value })}
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                className="btn-ghost"
                disabled={editLoading}
                onClick={() => setEditingEmployee(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn bg-indigo-600 hover:bg-indigo-700"
                disabled={editLoading}
              >
                {editLoading ? 'Saving Changes…' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: Generate Payroll */}
      {showGenerateModal && (
        <Modal title="Generate Monthly Payroll" onClose={() => setShowGenerateModal(false)}>
          <form onSubmit={handleGeneratePayroll} className="space-y-4">
            <p className="text-xs text-slate-600">
              Automatically calculates Gross Salary, Pakistan Salaried Income Tax brackets, and statutory EOBI deductions
              for all active employees.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Month</label>
                <select
                  className="input"
                  value={genForm.month}
                  onChange={(e) => setGenForm({ ...genForm, month: parseInt(e.target.value) })}
                >
                  {MONTHS.map((m, idx) => (
                    <option key={m} value={idx + 1}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Year</label>
                <input
                  type="number"
                  className="input"
                  value={genForm.year}
                  onChange={(e) => setGenForm({ ...genForm, year: parseInt(e.target.value) })}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setShowGenerateModal(false)}>
                Cancel
              </button>
              <button type="submit" className="btn">
                Run Payroll Calculation
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: View Payroll Run Payslips */}
      {selectedRun && (
        <Modal
          title={`Payroll Period: ${MONTHS[selectedRun.run.month - 1]} ${selectedRun.run.year}`}
          maxWidth="max-w-4xl"
          onClose={() => setSelectedRun(null)}
        >
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-50 p-3 rounded text-xs gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span>Run: <b>{selectedRun.run.runNumber}</b></span> | <span>Status: <StatusBadge status={selectedRun.run.status} /></span>
                {selectedRun.run.status === 'declined' && selectedRun.run.declineReason && (
                  <span className="text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                    Reason: {selectedRun.run.declineReason}
                  </span>
                )}
                {selectedRun.run.status === 'draft' && (
                  <>
                    <button
                      className="btn bg-blue-600 hover:bg-blue-700 text-[11px] py-0.5 px-2 font-medium"
                      onClick={() => handleUpdateStatus(selectedRun.run.id, 'approved')}
                    >
                      Approve
                    </button>
                    <button
                      className="btn bg-amber-600 hover:bg-amber-700 text-[11px] py-0.5 px-2 font-medium"
                      onClick={() => {
                        setError(null);
                        setDecliningRun(selectedRun.run);
                        setDeclineReason('');
                      }}
                    >
                      Decline
                    </button>
                  </>
                )}
                {selectedRun.run.status === 'approved' && (
                  <>
                    <button
                      className="btn bg-emerald-600 hover:bg-emerald-700 text-[11px] py-0.5 px-2 font-medium"
                      onClick={() => handleUpdateStatus(selectedRun.run.id, 'paid')}
                    >
                      Disburse / Pay
                    </button>
                    <button
                      className="btn bg-amber-600 hover:bg-amber-700 text-[11px] py-0.5 px-2 font-medium"
                      onClick={() => {
                        setError(null);
                        setDecliningRun(selectedRun.run);
                        setDeclineReason('');
                      }}
                    >
                      Decline
                    </button>
                  </>
                )}
                {selectedRun.run.status === 'declined' && (
                  <button
                    className="btn bg-blue-600 hover:bg-blue-700 text-[11px] py-0.5 px-2 font-medium"
                    onClick={() => handleUpdateStatus(selectedRun.run.id, 'approved')}
                  >
                    Re-Approve
                  </button>
                )}
                {selectedRun.run.status === 'paid' && isOwner && (
                  <button
                    className="btn bg-rose-600 hover:bg-rose-700 text-[11px] py-0.5 px-2 font-medium"
                    onClick={() => {
                      setError(null);
                      setReversingRun(selectedRun.run);
                    }}
                  >
                    🔄 Reverse Run
                  </button>
                )}
                {isOwner && (
                  <button
                    className="btn bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] py-0.5 px-2 font-medium"
                    onClick={() => {
                      setError(null);
                      setDeletingRun(selectedRun.run);
                      setDeletePassword('');
                    }}
                  >
                    🗑️ Delete Run
                  </button>
                )}
              </div>
              <div className="flex gap-4 font-mono">
                <span>Total Gross: <b>PKR {Number(selectedRun.run.totalGross).toLocaleString('en-PK')}</b></span>
                <span>Total Net: <b className="text-emerald-700">PKR {Number(selectedRun.run.totalNet).toLocaleString('en-PK')}</b></span>
              </div>
            </div>

            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b text-slate-500">
                  <th className="py-2">Emp Code</th>
                  <th className="py-2">Employee</th>
                  <th className="py-2 text-right">Gross Salary</th>
                  <th className="py-2 text-right">Income Tax</th>
                  <th className="py-2 text-right">EOBI</th>
                  <th className="py-2 text-right">Net Payable</th>
                  <th className="py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {selectedRun.payslips.map((ps) => (
                  <tr key={ps.id}>
                    <td className="py-2 font-mono text-indigo-600 font-medium">{ps.employeeCode}</td>
                    <td className="py-2 font-medium">{ps.fullName}</td>
                    <td className="py-2 text-right font-mono">{Number(ps.grossSalary).toLocaleString('en-PK')}</td>
                    <td className="py-2 text-right font-mono text-rose-600">{Number(ps.incomeTax).toLocaleString('en-PK')}</td>
                    <td className="py-2 text-right font-mono text-slate-500">{Number(ps.eobiDeduction).toLocaleString('en-PK')}</td>
                    <td className="py-2 text-right font-mono font-bold text-slate-900">
                      PKR {Number(ps.netSalary).toLocaleString('en-PK')}
                    </td>
                    <td className="py-2 text-right">
                      <button
                        className="btn-ghost text-[10px] py-0.5 px-2"
                        onClick={() => setSelectedPayslip(ps)}
                      >
                        View Payslip
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}

      {/* MODAL: Printable Official Payslip */}
      {selectedPayslip && (
        <Modal title="Official Salary Slip" maxWidth="max-w-lg" onClose={() => setSelectedPayslip(null)}>
          <div className="space-y-4 print:p-0 text-xs">
            <div className="border-b pb-3 text-center">
              <h3 className="font-bold text-base text-slate-900">OFFICIAL PAYSLIP</h3>
              <p className="text-slate-500">CONFIDENTIAL SALARY STATEMENT</p>
            </div>

            <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded">
              <div>
                <p className="text-slate-500">Employee Name:</p>
                <p className="font-bold text-slate-900">{selectedPayslip.fullName}</p>
                <p className="text-slate-500 mt-1">Designation:</p>
                <p className="font-medium">{selectedPayslip.designation}</p>
              </div>
              <div className="text-right">
                <p className="text-slate-500">Employee Code:</p>
                <p className="font-mono font-bold">{selectedPayslip.employeeCode}</p>
                <p className="text-slate-500 mt-1">CNIC:</p>
                <p className="font-mono">{selectedPayslip.cnic}</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="font-bold text-slate-700">Earnings</p>
              <div className="flex justify-between border-b pb-1 text-slate-600">
                <span>Basic Salary</span>
                <span className="font-mono">PKR {Number(selectedPayslip.basicSalary).toLocaleString('en-PK')}</span>
              </div>
              <div className="flex justify-between border-b pb-1 text-slate-600">
                <span>Medical & Conveyance Allowances</span>
                <span className="font-mono">PKR {Number(selectedPayslip.allowances).toLocaleString('en-PK')}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-900 pt-1">
                <span>Gross Earnings</span>
                <span className="font-mono">PKR {Number(selectedPayslip.grossSalary).toLocaleString('en-PK')}</span>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t">
              <p className="font-bold text-slate-700">Deductions</p>
              <div className="flex justify-between border-b pb-1 text-rose-700">
                <span>Income Tax (FBR Salary Slab)</span>
                <span className="font-mono">PKR {Number(selectedPayslip.incomeTax).toLocaleString('en-PK')}</span>
              </div>
              <div className="flex justify-between border-b pb-1 text-slate-600">
                <span>EOBI (Employees' Old-Age Benefits)</span>
                <span className="font-mono">PKR {Number(selectedPayslip.eobiDeduction).toLocaleString('en-PK')}</span>
              </div>
            </div>

            <div className="rounded bg-emerald-50 border border-emerald-200 p-3 flex justify-between items-center text-emerald-950 font-bold text-sm">
              <span>Net Take-Home Pay:</span>
              <span className="font-mono text-base text-emerald-800">
                PKR {Number(selectedPayslip.netSalary).toLocaleString('en-PK')}
              </span>
            </div>

            {selectedPayslip.bankAccount && (
              <p className="text-[11px] text-slate-500">Disbursed to IBAN: <b className="font-mono">{selectedPayslip.bankAccount}</b></p>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button className="btn-ghost text-xs" onClick={() => window.print()}>
                Print Slip
              </button>
              <button className="btn text-xs" onClick={() => setSelectedPayslip(null)}>
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: Owner Payroll Reversal Dialog */}
      {reversingRun && (
        <Modal
          title={`Confirm Payroll Reversal: ${reversingRun.runNumber}`}
          onClose={() => {
            if (!reverseLoading) setReversingRun(null);
          }}
        >
          <form onSubmit={handleReversePayroll} className="space-y-4 text-xs">
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-rose-800 space-y-1">
              <p className="font-bold flex items-center gap-1.5 text-rose-900">
                ⚠️ Financial Impact Notice
              </p>
              <p>
                Reversing this paid payroll run will reset its status to <strong>Draft</strong>, void any linked
                Salary Expense and Bank Disbursement journal vouchers, and restore GL balances.
              </p>
            </div>

            <div className="bg-slate-50 p-2.5 rounded border border-slate-200 flex justify-between items-center">
              <div>
                <span className="text-slate-500">Period:</span>
                <p className="font-semibold text-slate-800">
                  {MONTHS[reversingRun.month - 1]} {reversingRun.year}
                </p>
              </div>
              <div className="text-right">
                <span className="text-slate-500">Total Net Amount:</span>
                <p className="font-mono font-bold text-slate-900 text-sm">
                  PKR {Number(reversingRun.totalNet).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            <div>
              <label className="label text-xs font-semibold text-slate-800">
                Owner Account Password *
              </label>
              <input
                type="password"
                required
                className="input"
                placeholder="Enter owner password to authorize..."
                value={reversePassword}
                onChange={(e) => setReversePassword(e.target.value)}
                autoFocus
              />
              <p className="text-[11px] text-slate-400 mt-0.5">
                Cryptographic authentication is required to execute a financial reversal.
              </p>
            </div>

            <div>
              <label className="label text-xs font-semibold text-slate-800">
                Reason for Reversal *
              </label>
              <textarea
                required
                rows={2}
                className="input"
                placeholder="e.g., Accidental disbursement, incorrect deduction calculation, adjustment needed..."
                value={reverseReason}
                onChange={(e) => setReverseReason(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                className="btn-ghost text-xs"
                disabled={reverseLoading}
                onClick={() => setReversingRun(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn bg-rose-600 hover:bg-rose-700 text-xs py-2 px-4 shadow-sm"
                disabled={reverseLoading}
              >
                {reverseLoading ? 'Verifying & Reversing…' : 'Authorize & Reverse Payroll'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: Decline Payroll Dialog */}
      {decliningRun && (
        <Modal
          title={`Decline Payroll Run: ${decliningRun.runNumber}`}
          onClose={() => {
            if (!declineLoading) setDecliningRun(null);
          }}
        >
          <form onSubmit={handleDeclinePayroll} className="space-y-4 text-xs">
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-amber-800 space-y-1">
              <p className="font-bold flex items-center gap-1.5 text-amber-900">
                ⚠️ Payroll Decline Notice
              </p>
              <p>
                Marking this payroll run as <strong>Declined</strong> will halt disbursement. If allowances or basic pay
                have mistakes, the owner can delete this run with password to regenerate it, or you can adjust and re-approve.
              </p>
            </div>

            <div className="bg-slate-50 p-2.5 rounded border border-slate-200 flex justify-between items-center">
              <div>
                <span className="text-slate-500">Period:</span>
                <p className="font-semibold text-slate-800">
                  {MONTHS[decliningRun.month - 1]} {decliningRun.year}
                </p>
              </div>
              <div className="text-right">
                <span className="text-slate-500">Total Net Amount:</span>
                <p className="font-mono font-bold text-slate-900 text-sm">
                  PKR {Number(decliningRun.totalNet).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            <div>
              <label className="label text-xs font-semibold text-slate-800">
                Reason for Declining *
              </label>
              <textarea
                required
                rows={2}
                className="input"
                placeholder="e.g., Allowance mistake in Engineering dept, basic pay adjustment required..."
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                className="btn-ghost text-xs"
                disabled={declineLoading}
                onClick={() => setDecliningRun(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn bg-amber-600 hover:bg-amber-700 text-xs py-2 px-4 font-medium"
                disabled={declineLoading}
              >
                {declineLoading ? 'Declining…' : 'Confirm Decline'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: Owner Payroll Deletion Dialog (To Regenerate after fixing allowances/basic pay) */}
      {deletingRun && (
        <Modal
          title={`Delete Monthly Payroll: ${deletingRun.runNumber}`}
          onClose={() => {
            if (!deleteLoading) setDeletingRun(null);
          }}
        >
          <form onSubmit={handleDeletePayroll} className="space-y-4 text-xs">
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-rose-800 space-y-1">
              <p className="font-bold flex items-center gap-1.5 text-rose-900">
                ⚠️ Financial Records Deletion Notice
              </p>
              <p>
                Deleting this monthly payroll will permanently remove this payroll run, all generated payslips,
                and any linked accounting journal vouchers in the General Ledger.
              </p>
              <p className="font-semibold text-rose-950 mt-1">
                This unlocks the month of {MONTHS[deletingRun.month - 1]} {deletingRun.year} so you can fix any
                mistakes in basic pay or allowances in the Employees Directory, then regenerate the payroll cleanly!
              </p>
            </div>

            <div className="bg-slate-50 p-2.5 rounded border border-slate-200 flex justify-between items-center">
              <div>
                <span className="text-slate-500">Period:</span>
                <p className="font-semibold text-slate-800">
                  {MONTHS[deletingRun.month - 1]} {deletingRun.year}
                </p>
              </div>
              <div className="text-right">
                <span className="text-slate-500">Status & Net Amount:</span>
                <p className="font-mono font-bold text-slate-900 text-sm">
                  PKR {Number(deletingRun.totalNet).toLocaleString('en-PK', { minimumFractionDigits: 2 })} ({deletingRun.status.toUpperCase()})
                </p>
              </div>
            </div>

            <div>
              <label className="label text-xs font-semibold text-slate-800">
                Owner Account Password *
              </label>
              <input
                type="password"
                required
                className="input"
                placeholder="Enter owner password to authorize deletion..."
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                autoFocus
              />
              <p className="text-[11px] text-slate-400 mt-0.5">
                Company owner authentication is required to delete financial and payroll records.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                className="btn-ghost text-xs"
                disabled={deleteLoading}
                onClick={() => setDeletingRun(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn bg-rose-600 hover:bg-rose-700 text-xs py-2 px-4 shadow-sm font-medium"
                disabled={deleteLoading}
              >
                {deleteLoading ? 'Verifying & Deleting…' : '🗑️ Delete Payroll & Enable Regeneration'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
