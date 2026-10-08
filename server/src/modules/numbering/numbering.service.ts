import { Db } from '../../db/pool';

export function formatDocNumber(prefix: string, fiscalYear: string, padding: number, n: number): string {
  return `${prefix}${fiscalYear ? fiscalYear + '-' : ''}${String(n).padStart(padding, '0')}`;
}

/**
 * Allocate the next number for a document type. MUST be called inside the same
 * transaction that saves the document: the UPDATE row-lock serialises concurrent
 * callers and a rollback releases the number, so there are no gaps.
 */
export async function nextDocNumber(db: Db, tenantId: string, docType: string, fiscalYear = ''): Promise<string> {
  const { rows } = await db.query(
    `UPDATE number_series SET next_number = next_number + 1
      WHERE tenant_id = $1 AND doc_type = $2 AND fiscal_year = $3
      RETURNING prefix, padding, next_number - 1 AS n`,
    [tenantId, docType, fiscalYear],
  );
  if (!rows[0]) throw new Error(`No number series configured for ${docType} ${fiscalYear}`.trim());
  return formatDocNumber(rows[0].prefix, fiscalYear, rows[0].padding, Number(rows[0].n));
}

export const DEFAULT_SERIES: { docType: string; prefix: string }[] = [
  { docType: 'journal_voucher', prefix: 'JV-' },
  { docType: 'payment_voucher', prefix: 'PV-' },
  { docType: 'receipt_voucher', prefix: 'RV-' },
  { docType: 'sales_invoice', prefix: 'SI-' },
  { docType: 'purchase_invoice', prefix: 'PI-' },
  { docType: 'purchase_bill', prefix: 'BILL-' },
  { docType: 'purchase_order', prefix: 'PO-' },
  { docType: 'sales_order', prefix: 'SO-' },
  { docType: 'grn', prefix: 'GRN-' },
  { docType: 'employee', prefix: 'EMP-' },
  { docType: 'fixed_asset', prefix: 'AST-' },
  { docType: 'project', prefix: 'PRJ-' },
  { docType: 'payroll_run', prefix: 'PR-' },
];
