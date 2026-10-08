import React, { createContext, useContext, useEffect, useState } from 'react';

export type Language = 'en' | 'ur';

interface I18nContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  isRtl: boolean;
  t: (key: string, defaultText?: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    // Nav
    'nav.main': 'Main',
    'nav.dashboard': 'Dashboard',
    'nav.finance_sales': 'Finance & Sales',
    'nav.accounting': 'Accounting',
    'nav.sales': 'Sales & FBR Invoicing',
    'nav.purchase': 'Purchase & Bills',
    'nav.operations': 'Operations',
    'nav.inventory': 'Inventory & Stock',
    'nav.assets': 'Fixed Assets',
    'nav.projects': 'Projects & Tasks',
    'nav.hr': 'Human Resources',
    'nav.hr_payroll': 'HR & Payroll',
    'nav.attendance': 'Attendance & Leaves',
    'nav.admin': 'System & Admin',
    'nav.users': 'Users',
    'nav.roles': 'Roles & RBAC',
    'nav.audit': 'Audit Trail',
    'nav.settings': 'Settings & Series',
    'nav.sign_out': 'Sign out',
    'nav.fbr_ready': 'FBR Ready',
    'nav.connected': 'Connected & Synchronized',

    // Common
    'common.add': 'Add',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.close': 'Close',
    'common.edit': 'Edit',
    'common.delete': 'Delete',
    'common.actions': 'Actions',
    'common.status': 'Status',
    'common.date': 'Date',
    'common.name': 'Name',
    'common.code': 'Code',
    'common.description': 'Description',
    'common.total': 'Total',
    'common.subtotal': 'Subtotal',
    'common.previous': 'Previous',
    'common.next': 'Next',
    'common.page': 'Page',
    'common.records': 'record(s)',
    'common.success': 'Success',
    'common.error': 'Error',
    'common.all': 'All',
    'common.details': 'Details',

    // Status
    'status.active': 'Active',
    'status.inactive': 'Inactive',
    'status.draft': 'Draft',
    'status.posted': 'Posted',
    'status.paid': 'Paid',
    'status.received': 'Received',
    'status.approved': 'Approved',
    'status.pending': 'Pending',
    'status.rejected': 'Rejected',
    'status.completed': 'Completed',
    'status.in_progress': 'In Progress',
    'status.todo': 'To Do',
    'status.present': 'Present',
    'status.absent': 'Absent',
    'status.late': 'Late',
    'status.on_leave': 'On Leave',

    // Accounting
    'accounting.title': 'Accounting & General Ledger',
    'accounting.subtitle': 'Double-entry ledger, Chart of Accounts, Journal Vouchers, and Financial Statements',
    'accounting.chart_of_accounts': 'Chart of Accounts',
    'accounting.journal_vouchers': 'Journal Vouchers',
    'accounting.general_ledger': 'General Ledger',
    'accounting.financial_reports': 'Financial Reports',
    'accounting.new_account': '+ New Account',
    'accounting.new_voucher': '+ New Journal Voucher',
    'accounting.balance': 'Current Balance',
    'accounting.type': 'Type',
    'accounting.subtype': 'Subtype',
    'accounting.debit': 'Debit (PKR)',
    'accounting.credit': 'Credit (PKR)',
    'accounting.running_balance': 'Running Balance',
    'accounting.trial_balance': 'Trial Balance',
    'accounting.p_and_l': 'Profit & Loss Statement (P&L)',
    'accounting.revenues': 'Revenues',
    'accounting.expenses': 'Expenses',
    'accounting.net_profit': 'Net Profit / (Loss)',

    // Sales
    'sales.title': 'Sales & FBR Digital Invoicing',
    'sales.subtitle': 'Manage Customers, Invoices, and Instant FBR POS Digital Invoicing Synchronization',
    'sales.invoices': 'Sales Invoices & FBR Status',
    'sales.customers': 'Customers Directory',
    'sales.new_invoice': '+ New Sales Invoice',
    'sales.new_customer': '+ New Customer',
    'sales.fbr_status': 'FBR Status',
    'sales.fbr_verified': '✓ FBR Verified',
    'sales.fbr_pending': 'Pending FBR',
    'sales.sync_fbr': 'Sync FBR',
    'sales.receipt_qr': 'Receipt & QR',
    'sales.pos_fee': 'POS Fee',
    'sales.sales_tax': 'Sales Tax (18%)',
    'sales.grand_total': 'Grand Total (PKR)',
    'sales.transmit_fbr': 'Transmit to FBR Now',
    'sales.official_receipt': 'Print Official Receipt',

    // Inventory
    'inventory.title': 'Inventory & Stock Control',
    'inventory.subtitle': 'Item catalog, multi-warehouse stock levels, reorder tracking, and movements',
    'inventory.items': 'Items Catalog & Stock',
    'inventory.movements': 'Stock Movements Ledger',
    'inventory.warehouses': 'Warehouses',
    'inventory.adjust_stock': '± Adjust Stock',
    'inventory.new_item': '+ New Item',
    'inventory.new_warehouse': '+ New Warehouse',
    'inventory.in_stock': 'In Stock',
    'inventory.cost_price': 'Cost Price',
    'inventory.selling_price': 'Selling Price',
    'inventory.low_stock': 'Low Stock',
    'inventory.optimal': 'Optimal',

    // Purchase
    'purchase.title': 'Purchase & Supplier Management',
    'purchase.subtitle': 'Manage Vendors, Purchase Orders, Bills, and automated inventory receiving',
    'purchase.bills': 'Purchase Bills',
    'purchase.vendors': 'Suppliers / Vendors Directory',
    'purchase.new_bill': '+ New Purchase Bill',
    'purchase.new_vendor': '+ New Supplier',
    'purchase.supplier': 'Supplier',
    'purchase.mark_paid': 'Mark Paid',

    // HR & Payroll
    'hr.title': 'HR & Payroll (Pakistan Compliant)',
    'hr.subtitle': 'Manage employees, salary structures, income tax calculation, EOBI social security, and payslips',
    'hr.employees': 'Employees Directory',
    'hr.payroll': 'Payroll Runs & Disbursements',
    'hr.add_employee': '+ Add Employee',
    'hr.generate_payroll': '⚡ Generate Monthly Payroll',
    'hr.basic_salary': 'Basic Salary',
    'hr.gross_salary': 'Gross Salary',
    'hr.income_tax': 'Income Tax',
    'hr.eobi': 'EOBI Deduct',
    'hr.net_salary': 'Net Payable',
    'hr.view_payslip': 'View Payslip',
    'hr.approve': 'Approve',
    'hr.disburse': 'Disburse / Pay',

    // Attendance
    'attendance.title': 'Attendance & Leave Management',
    'attendance.subtitle': 'Track daily employee check-ins, punctuality, and staff leave approvals',
    'attendance.sheet': 'Daily Attendance Sheet',
    'attendance.leaves': 'Leave Applications & Approvals',
    'attendance.apply_leave': '+ Apply for Leave',
    'attendance.total_staff': 'Total Staff',
    'attendance.present_today': 'Present Today',
    'attendance.late_checkins': 'Late Check-ins',
    'attendance.on_leave': 'On Approved Leave',
    'attendance.check_in': 'Check In',
    'attendance.check_out': 'Check Out',

    // Assets
    'assets.title': 'Fixed Assets & Depreciation',
    'assets.subtitle': 'Asset register, straight-line depreciation engine, and automatic ledger posting',
    'assets.add_asset': '+ Add Fixed Asset',
    'assets.total_cost': 'Total Assets Cost',
    'assets.accumulated_dep': 'Accumulated Depreciation',
    'assets.net_book_value': 'Current Net Book Value',
    'assets.run_dep': 'Run Depreciation',

    // Projects
    'projects.title': 'Projects & Tasks Management',
    'projects.subtitle': 'Track client projects, milestones, task statuses, hours, and project expenditures',
    'projects.new_project': '+ New Project',
    'projects.budget': 'Budget',
    'projects.progress': 'Progress',
    'projects.tasks': 'Tasks & Milestones',
    'projects.timesheets': 'Timesheets & Expenses',
  },

  ur: {
    // Nav
    'nav.main': 'مرکزی',
    'nav.dashboard': 'ڈیش بورڈ',
    'nav.finance_sales': 'مالیات اور فروخت',
    'nav.accounting': 'کھاتہ داری (اکاؤنٹنگ)',
    'nav.sales': 'فروخت اور ایف بی آر',
    'nav.purchase': 'خریداری اور بلز',
    'nav.operations': 'آپریشنز اور اسٹاک',
    'nav.inventory': 'گودام اور اسٹاک',
    'nav.assets': 'مستقل اثاثہ جات',
    'nav.projects': 'منصوبے اور کام',
    'nav.hr': 'انسانی وسائل (HR)',
    'nav.hr_payroll': 'تنخواہیں اور ملازمین',
    'nav.attendance': 'حاضری اور رخصت',
    'nav.admin': 'سسٹم اور انتظامیہ',
    'nav.users': 'صارفین',
    'nav.roles': 'کردار اور اختیارات',
    'nav.audit': 'آڈٹ لاگ',
    'nav.settings': 'کمپنی ترتیبات',
    'nav.sign_out': 'لاگ آؤٹ',
    'nav.fbr_ready': 'ایف بی آر فعال',
    'nav.connected': 'منسلک اور ہم آہنگ',

    // Common
    'common.add': 'شامل کریں',
    'common.save': 'محفوظ کریں',
    'common.cancel': 'منسوخ کریں',
    'common.close': 'بند کریں',
    'common.edit': 'ترمیم',
    'common.delete': 'حذف کریں',
    'common.actions': 'اقدامات',
    'common.status': 'حیثیت (اسٹیٹس)',
    'common.date': 'تاریخ',
    'common.name': 'نام',
    'common.code': 'کوڈ',
    'common.description': 'تفصیل',
    'common.total': 'کل رقم',
    'common.subtotal': 'ذیلی میزان',
    'common.previous': 'پچھلا',
    'common.next': 'اگلا',
    'common.page': 'صفحہ',
    'common.records': 'ریکارڈز',
    'common.success': 'کامیابی',
    'common.error': 'خرابی',
    'common.all': 'تمام',
    'common.details': 'تفصیلات دیکھیں',

    // Status
    'status.active': 'فعال',
    'status.inactive': 'غیر فعال',
    'status.draft': 'ڈرافٹ',
    'status.posted': 'پوسٹ شدہ',
    'status.paid': 'ادا شدہ',
    'status.received': 'موصول شدہ',
    'status.approved': 'منظور شدہ',
    'status.pending': 'زیر التواء',
    'status.rejected': 'مسترد شدہ',
    'status.completed': 'مکمل',
    'status.in_progress': 'جاری ہے',
    'status.todo': 'کرنے کا کام',
    'status.present': 'حاضر',
    'status.absent': 'غیر حاضر',
    'status.late': 'تاخیر سے',
    'status.on_leave': 'رخصت پر',

    // Accounting
    'accounting.title': 'کھاتہ داری اور جنرل لیجر',
    'accounting.subtitle': 'ڈبل انٹری بک کیپنگ، چارٹ آف اکاؤنٹس، جرنل واؤچرز اور مالیاتی گوشوارے',
    'accounting.chart_of_accounts': 'چارٹ آف اکاؤنٹس',
    'accounting.journal_vouchers': 'جرنل واؤچرز',
    'accounting.general_ledger': 'جنرل لیجر (کھاتہ)',
    'accounting.financial_reports': 'مالیاتی رپورٹس',
    'accounting.new_account': '+ نیا کھاتہ',
    'accounting.new_voucher': '+ نیا جرنل واؤچر',
    'accounting.balance': 'موجودہ بیلنس',
    'accounting.type': 'قسم',
    'accounting.subtype': 'ذیلی قسم',
    'accounting.debit': 'بنام / ڈیبٹ (روپے)',
    'accounting.credit': 'جمع / کریڈٹ (روپے)',
    'accounting.running_balance': 'رننگ بیلنس',
    'accounting.trial_balance': 'میزان پڑتال (ٹرائل بیلنس)',
    'accounting.p_and_l': 'نفع و نقصان کا گوشوارہ (P&L)',
    'accounting.revenues': 'آمدنی / ریونیو',
    'accounting.expenses': 'اخراجات',
    'accounting.net_profit': 'خالص منافع / (نقصان)',

    // Sales
    'sales.title': 'فروخت اور ایف بی آر ڈیجیٹل انوائسنگ',
    'sales.subtitle': 'گاہکوں کا انتظام، انوائسنگ اور فوری ایف بی آر پی او ایس ڈیجیٹل انوائسنگ سنکرونائزیشن',
    'sales.invoices': 'سیلز انوائسز اور ایف بی آر اسٹیٹس',
    'sales.customers': 'گاہکوں کی فہرست',
    'sales.new_invoice': '+ نئی سیلز انوائس',
    'sales.new_customer': '+ نیا گاہک',
    'sales.fbr_status': 'ایف بی آر حیثیت',
    'sales.fbr_verified': '✓ ایف بی آر تصدیق شدہ',
    'sales.fbr_pending': 'زیر التواء ایف بی آر',
    'sales.sync_fbr': 'ایف بی آر سے بھیجیں',
    'sales.receipt_qr': 'رسید اور کیو آر',
    'sales.pos_fee': 'پی او ایس فیس',
    'sales.sales_tax': 'سیلز ٹیکس (18%)',
    'sales.grand_total': 'کل رقم (روپے)',
    'sales.transmit_fbr': 'ابھی ایف بی آر کو ارسال کریں',
    'sales.official_receipt': 'سرکاری رسید پرنٹ کریں',

    // Inventory
    'inventory.title': 'اسٹاک اور انوینٹری کنٹرول',
    'inventory.subtitle': 'مصنوعات کیٹلاگ، کثیر گودام اسٹاک، ری آرڈر لیول اور نقل و حرکت',
    'inventory.items': 'اشیاء کی فہرست اور اسٹاک',
    'inventory.movements': 'اسٹاک نقل و حرکت لیجر',
    'inventory.warehouses': 'گودام / ویئر ہاؤسز',
    'inventory.adjust_stock': '± اسٹاک ایڈجسٹمنٹ',
    'inventory.new_item': '+ نئی چیز شامل کریں',
    'inventory.new_warehouse': '+ نیا گودام',
    'inventory.in_stock': 'دستیاب اسٹاک',
    'inventory.cost_price': 'لاگت قیمت',
    'inventory.selling_price': 'فروخت قیمت',
    'inventory.low_stock': 'کم اسٹاک',
    'inventory.optimal': 'مناسب',

    // Purchase
    'purchase.title': 'خریداری اور سپلائر کا انتظام',
    'purchase.subtitle': 'سپلائرز، پرچیز آرڈرز، خریداری بلز اور خودکار اسٹاک آمد',
    'purchase.bills': 'خریداری کے بلز',
    'purchase.vendors': 'سپلائرز کی ڈائرکٹری',
    'purchase.new_bill': '+ نیا خریداری بل',
    'purchase.new_vendor': '+ نیا سپلائر',
    'purchase.supplier': 'سپلائر / وینڈر',
    'purchase.mark_paid': 'ادا شدہ نشان زد کریں',

    // HR & Payroll
    'hr.title': 'عملہ اور تنخواہیں (پاکستانی قوانین کے مطابق)',
    'hr.subtitle': 'ملازمین کا ریکارڈ، سیلری اسٹرکچر، انکم ٹیکس کا حساب، ای او بی آئی اور پے سلپس',
    'hr.employees': 'ملازمین کی ڈائرکٹری',
    'hr.payroll': 'ماہانہ تنخواہیں اور ترسیل',
    'hr.add_employee': '+ نیا ملازم شامل کریں',
    'hr.generate_payroll': '⚡ ماہانہ تنخواہوں کا حساب کریں',
    'hr.basic_salary': 'بنیادی تنخواہ',
    'hr.gross_salary': 'مجموعی تنخواہ',
    'hr.income_tax': 'انکم ٹیکس کٹوتی',
    'hr.eobi': 'ای او بی آئی کٹوتی',
    'hr.net_salary': 'خالص تنخواہ',
    'hr.view_payslip': 'پے سلپ دیکھیں',
    'hr.approve': 'منظور کریں',
    'hr.disburse': 'تنخواہیں ادا کریں',

    // Attendance
    'attendance.title': 'حاضری اور رخصت کا نظام',
    'attendance.subtitle': 'روزانہ ملازمین کی آمد و رفت، وقت کی پابندی اور چھٹیوں کی منظوری',
    'attendance.sheet': 'روزانہ حاضری شیٹ',
    'attendance.leaves': 'چھٹیوں کی درخواستیں',
    'attendance.apply_leave': '+ چھٹی کی درخواست دیں',
    'attendance.total_staff': 'کل عملہ',
    'attendance.present_today': 'آج حاضر',
    'attendance.late_checkins': 'دیر سے آئے',
    'attendance.on_leave': 'رخصت پر',
    'attendance.check_in': 'آمد کا وقت',
    'attendance.check_out': 'روانگی کا وقت',

    // Assets
    'assets.title': 'مستقل اثاثہ جات اور فرسودگی',
    'assets.subtitle': 'اثاثہ جات رجسٹر، فرسودگی کا حساب اور لیجر میں خودکار اندراج',
    'assets.add_asset': '+ نیا اثاثہ درج کریں',
    'assets.total_cost': 'اثاثوں کی کل لاگت',
    'assets.accumulated_dep': 'مجموعی فرسودگی',
    'assets.net_book_value': 'خالص دفتری قیمت (بک ویلیو)',
    'assets.run_dep': 'فرسودگی کا اندراج کریں',

    // Projects
    'projects.title': 'منصوبے اور کام کا انتظام',
    'projects.subtitle': 'گاہکوں کے پروجیکٹس، اہم مراحل، کام کی صورتحال اور اخراجات کا سراغ',
    'projects.new_project': '+ نیا منصوبہ',
    'projects.budget': 'مختص بجٹ',
    'projects.progress': 'پیش رفت',
    'projects.tasks': 'کام اور مراحل',
    'projects.timesheets': 'ٹائم شیٹس اور اخراجات',
  },
};

const I18nContext = createContext<I18nContextType>({
  lang: 'en',
  setLang: () => {},
  isRtl: false,
  t: (key: string, def?: string) => def || key,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    return (localStorage.getItem('erp_language') as Language) || 'en';
  });

  const isRtl = lang === 'ur';

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem('erp_language', newLang);
  };

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    if (isRtl) {
      document.body.classList.add('font-urdu');
    } else {
      document.body.classList.remove('font-urdu');
    }
  }, [lang, isRtl]);

  const t = (key: string, defaultText?: string): string => {
    return translations[lang]?.[key] || defaultText || key;
  };

  return (
    <I18nContext.Provider value={{ lang, setLang, isRtl, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  return useContext(I18nContext);
}
