import { pool, withTenant } from './pool';

async function seed() {
  const tenants = await pool.query('SELECT id, name FROM tenants');
  for (const t of tenants.rows) {
    console.log(`Seeding business data for tenant: ${t.name} (${t.id})`);
    await withTenant(t.id, async (db) => {
      // 1. Chart of Accounts
      const accounts = [
        { code: '1010', name: 'Cash on Hand', type: 'asset', subtype: 'current_asset' },
        { code: '1020', name: 'Bank - Meezan Bank Current', type: 'asset', subtype: 'current_asset' },
        { code: '1030', name: 'Accounts Receivable', type: 'asset', subtype: 'current_asset' },
        { code: '1040', name: 'Inventory Asset', type: 'asset', subtype: 'current_asset' },
        { code: '1510', name: 'Computer & Office Equipment', type: 'asset', subtype: 'fixed_asset' },
        { code: '2010', name: 'Accounts Payable', type: 'liability', subtype: 'current_liability' },
        { code: '2020', name: 'Sales Tax / FBR Payable', type: 'liability', subtype: 'current_liability' },
        { code: '2030', name: 'Payroll / Withholding Tax Payable', type: 'liability', subtype: 'current_liability' },
        { code: '2040', name: 'EOBI & Social Security Payable', type: 'liability', subtype: 'current_liability' },
        { code: '3010', name: "Owner's Equity / Capital", type: 'equity', subtype: 'equity' },
        { code: '4010', name: 'Sales Revenue', type: 'revenue', subtype: 'operating_revenue' },
        { code: '4020', name: 'Consulting / Project Revenue', type: 'revenue', subtype: 'operating_revenue' },
        { code: '5010', name: 'Cost of Goods Sold', type: 'expense', subtype: 'cogs' },
        { code: '6010', name: 'Salaries & Wages', type: 'expense', subtype: 'operating_expense' },
        { code: '6020', name: 'Office Rent & Utilities', type: 'expense', subtype: 'operating_expense' },
        { code: '6030', name: 'Depreciation Expense', type: 'expense', subtype: 'operating_expense' },
      ];

      for (const a of accounts) {
        await db.query(
          `INSERT INTO accounts (tenant_id, code, name, type, subtype)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (tenant_id, code) DO NOTHING`,
          [t.id, a.code, a.name, a.type, a.subtype]
        );
      }

      // 2. Default Warehouse
      const wh = await db.query(
        `INSERT INTO warehouses (tenant_id, code, name, address)
         VALUES ($1, 'WH-01', 'Main Central Warehouse', 'Plot 45-C, Industrial Estate, Karachi')
         ON CONFLICT (tenant_id, code) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [t.id]
      );
      const whId = wh.rows[0].id;

      // 3. Items
      const items = [
        { sku: 'IT-LAPTOP-5420', name: 'Dell Latitude 5420 i7 16GB', category: 'Laptops', uom: 'pcs', cost_price: 185000, selling_price: 225000, tax_rate: 18, reorder_level: 5 },
        { sku: 'IT-MONITOR-27', name: 'Samsung 27" IPS 100Hz Monitor', category: 'Displays', uom: 'pcs', cost_price: 42000, selling_price: 54000, tax_rate: 18, reorder_level: 10 },
        { sku: 'IT-KEYBOARD-MECH', name: 'Logitech MX Keys Wireless', category: 'Accessories', uom: 'pcs', cost_price: 24000, selling_price: 31500, tax_rate: 18, reorder_level: 15 },
      ];

      for (const item of items) {
        const itm = await db.query(
          `INSERT INTO items (tenant_id, sku, name, category, uom, cost_price, selling_price, tax_rate, reorder_level)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (tenant_id, sku) DO UPDATE SET name = EXCLUDED.name
           RETURNING id`,
          [t.id, item.sku, item.name, item.category, item.uom, item.cost_price, item.selling_price, item.tax_rate, item.reorder_level]
        );
        // Initial stock movement
        const hasMovement = await db.query('SELECT id FROM stock_movements WHERE tenant_id = $1 AND item_id = $2', [t.id, itm.rows[0].id]);
        if (hasMovement.rowCount === 0) {
          await db.query(
            `INSERT INTO stock_movements (tenant_id, item_id, warehouse_id, movement_type, quantity, unit_cost, reference, notes)
             VALUES ($1, $2, $3, 'in', 25, $4, 'INIT-STOCK', 'Initial warehouse stock count')`,
            [t.id, itm.rows[0].id, whId, item.cost_price]
          );
        }
      }

      // 4. Sample Customers
      const cust1 = await db.query(
        `INSERT INTO customers (tenant_id, name, ntn, strn, phone, email, address, city, buyer_type)
         VALUES ($1, 'Apex Solutions Pvt Ltd', '7234912-8', '3277876123456', '+92-21-34567890', 'finance@apexsolutions.pk', 'Suite 401, Business Avenue, Shahrah-e-Faisal', 'Karachi', 'corporate')
         RETURNING id`,
        [t.id]
      );
      const cust2 = await db.query(
        `INSERT INTO customers (tenant_id, name, ntn, phone, email, address, city, buyer_type)
         VALUES ($1, 'Syed Daniyal Haider', '9812401-2', '+92-300-1234567', 'daniyal@example.com', 'House 14, Street 9, F-7/2', 'Islamabad', 'individual')
         RETURNING id`,
        [t.id]
      );

      // 5. Sample Vendor
      const ven1 = await db.query(
        `INSERT INTO vendors (tenant_id, name, ntn, strn, contact_person, phone, email, address, city, payment_terms)
         VALUES ($1, 'Premier Tech Distributing Ltd', '4912384-5', '1700491238411', 'Kamran Sheikh', '+92-42-35789012', 'orders@premiertek.pk', '12-Industrial Area, Gulberg III', 'Lahore', 'Net 30')
         RETURNING id`,
        [t.id]
      );

      // 6. Sample Employees
      const emp1 = await db.query(
        `INSERT INTO employees (tenant_id, employee_code, full_name, cnic, email, phone, department, designation, joining_date, basic_salary, medical_allowance, conveyance_allowance, bank_account, status)
         VALUES ($1, 'EMP-00001', 'Zainab Malik', '42101-9876543-2', 'zainab.malik@givone.com', '+92-321-4567890', 'Software Engineering', 'Senior Fullstack Engineer', '2024-01-15', 220000, 22000, 18000, 'PK36MEZN00012345678901', 'active')
         ON CONFLICT (tenant_id, employee_code) DO NOTHING
         RETURNING id`,
        [t.id]
      );
      const emp2 = await db.query(
        `INSERT INTO employees (tenant_id, employee_code, full_name, cnic, email, phone, department, designation, joining_date, basic_salary, medical_allowance, conveyance_allowance, bank_account, status)
         VALUES ($1, 'EMP-00002', 'Hamza Tariq', '35202-1234567-8', 'hamza.tariq@givone.com', '+92-333-8765432', 'Finance & Accounts', 'Accounts Officer', '2024-03-01', 95000, 9500, 8000, 'PK40HABB00098765432101', 'active')
         ON CONFLICT (tenant_id, employee_code) DO NOTHING
         RETURNING id`,
        [t.id]
      );

      // 7. Fixed Assets
      await db.query(
        `INSERT INTO fixed_assets (tenant_id, asset_code, name, category, purchase_date, purchase_cost, salvage_value, useful_life_years, current_value, location, status)
         VALUES ($1, 'AST-00001', 'Dell PowerEdge R740 Server', 'it_equipment', '2024-01-10', 950000, 100000, 4.0, 789583, 'Server Room Karachi', 'active')
         ON CONFLICT (tenant_id, asset_code) DO NOTHING`,
        [t.id]
      );

      // 8. Projects
      const prj = await db.query(
        `INSERT INTO projects (tenant_id, code, name, client_id, start_date, end_date, budget, status, priority, progress_percent)
         VALUES ($1, 'PRJ-00001', 'Enterprise Portal Cloud Migration', $2, '2025-01-01', '2025-06-30', 3500000, 'in_progress', 'high', 45)
         ON CONFLICT (tenant_id, code) DO NOTHING
         RETURNING id`,
        [t.id, cust1.rows[0]?.id]
      );

      console.log(`Seeding complete for ${t.name}`);
    });
  }
  await pool.end();
}

seed().catch(err => {
  console.error('Seeding error:', err);
  process.exit(1);
});
