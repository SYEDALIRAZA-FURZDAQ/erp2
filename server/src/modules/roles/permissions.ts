// Permission keys follow  module.entity.action.  '*' = everything, 'core.*' = whole module.
export const PERMISSIONS: { key: string; label: string; module: string }[] = [
  // Core
  { key: 'core.users.read', label: 'View users', module: 'Core' },
  { key: 'core.users.manage', label: 'Create / edit users', module: 'Core' },
  { key: 'core.roles.read', label: 'View roles', module: 'Core' },
  { key: 'core.roles.manage', label: 'Create / edit roles', module: 'Core' },
  { key: 'core.audit.read', label: 'View audit log', module: 'Core' },
  { key: 'core.settings.read', label: 'View company settings', module: 'Core' },
  { key: 'core.settings.manage', label: 'Edit company settings', module: 'Core' },
  { key: 'core.numbering.manage', label: 'Manage document numbering', module: 'Core' },

  // Accounting
  { key: 'accounting.accounts.read', label: 'View chart of accounts', module: 'Accounting' },
  { key: 'accounting.accounts.manage', label: 'Manage accounts', module: 'Accounting' },
  { key: 'accounting.vouchers.read', label: 'View journal vouchers', module: 'Accounting' },
  { key: 'accounting.vouchers.manage', label: 'Create journal vouchers', module: 'Accounting' },
  { key: 'accounting.reports.read', label: 'View financial reports', module: 'Accounting' },

  // Sales & FBR Digital Invoicing
  { key: 'sales.customers.read', label: 'View customers', module: 'Sales' },
  { key: 'sales.customers.manage', label: 'Manage customers', module: 'Sales' },
  { key: 'sales.invoices.read', label: 'View sales invoices', module: 'Sales' },
  { key: 'sales.invoices.manage', label: 'Create & manage invoices', module: 'Sales' },
  { key: 'sales.fbr.manage', label: 'Submit & sync with FBR Digital Invoicing', module: 'Sales' },

  // Inventory
  { key: 'inventory.items.read', label: 'View inventory items', module: 'Inventory' },
  { key: 'inventory.items.manage', label: 'Manage inventory items', module: 'Inventory' },
  { key: 'inventory.stock.manage', label: 'Manage stock adjustments & movements', module: 'Inventory' },
  { key: 'inventory.warehouses.manage', label: 'Manage warehouses', module: 'Inventory' },

  // Purchase
  { key: 'purchase.vendors.read', label: 'View suppliers / vendors', module: 'Purchase' },
  { key: 'purchase.vendors.manage', label: 'Manage vendors', module: 'Purchase' },
  { key: 'purchase.bills.read', label: 'View purchase bills', module: 'Purchase' },
  { key: 'purchase.bills.manage', label: 'Manage purchase bills', module: 'Purchase' },

  // HR & Payroll
  { key: 'hr.employees.read', label: 'View employee records', module: 'HR' },
  { key: 'hr.employees.manage', label: 'Manage employees', module: 'HR' },
  { key: 'hr.payroll.read', label: 'View payroll runs & payslips', module: 'HR' },
  { key: 'hr.payroll.manage', label: 'Process payroll & approve runs', module: 'HR' },

  // Attendance
  { key: 'attendance.records.read', label: 'View attendance records', module: 'Attendance' },
  { key: 'attendance.records.manage', label: 'Log & edit attendance', module: 'Attendance' },
  { key: 'attendance.leaves.read', label: 'View leave requests', module: 'Attendance' },
  { key: 'attendance.leaves.manage', label: 'Approve or reject leaves', module: 'Attendance' },

  // Fixed Assets
  { key: 'assets.register.read', label: 'View fixed assets register', module: 'Fixed Assets' },
  { key: 'assets.register.manage', label: 'Manage fixed assets', module: 'Fixed Assets' },
  { key: 'assets.depreciation.manage', label: 'Run asset depreciation', module: 'Fixed Assets' },

  // Projects
  { key: 'projects.manage.read', label: 'View projects & tasks', module: 'Projects' },
  { key: 'projects.manage.manage', label: 'Manage projects & tasks', module: 'Projects' },
  { key: 'projects.timesheets.manage', label: 'Log project timesheets & expenses', module: 'Projects' },
];

export const PERMISSION_KEYS = new Set(PERMISSIONS.map((p) => p.key));

export function hasPermission(granted: string[], required: string): boolean {
  return granted.some(
    (g) => g === '*' || g === required || (g.endsWith('.*') && required.startsWith(g.slice(0, -1))),
  );
}

export const SYSTEM_ROLES: { name: string; description: string; permissions: string[] }[] = [
  { name: 'Owner', description: 'Full access to everything', permissions: ['*'] },
  {
    name: 'Administrator',
    description: 'Manage users, roles and all ERP business operations',
    permissions: PERMISSIONS.map((p) => p.key),
  },
  {
    name: 'Staff',
    description: 'Basic operational read access',
    permissions: [
      'core.settings.read',
      'accounting.accounts.read',
      'accounting.vouchers.read',
      'sales.invoices.read',
      'inventory.items.read',
      'purchase.bills.read',
      'attendance.records.read',
      'projects.manage.read',
    ],
  },
];
