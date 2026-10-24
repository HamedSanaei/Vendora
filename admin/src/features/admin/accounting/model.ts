/** Stable accounting contracts; numeric enums mirror the language-neutral API. */
export type DocumentKind = 0 | 1 | 2 | 3 | 4;
export type DocumentStatus = 0 | 1 | 2;
export interface Paged<T> { items: T[]; page: number; pageSize: number; total: number }
export interface InvoiceLine { id: string; productId: string; productCode: number; title: string; quantity: number; unitPrice: number; discount: number; tax: number; originalLineId: string | null; costToman: number | null; valuationDifferenceToman: number | null }
export interface Invoice { id: string; number: string; kind: DocumentKind; status: DocumentStatus; counterpartyId: string; currency: 0 | 1; exchangeRate: number; issuedAtUtc: string; postedAtUtc: string | null; version: number; freight: number; totalToman: number; notes: string; originalDocumentId: string | null; orderId: string | null; lines: InvoiceLine[]; purchaseTaxRecoverable: boolean; sellerSnapshotJson: string; buyerSnapshotJson: string }
export interface Draft { id: string | null; version: number; kind: DocumentKind; counterpartyId: string; currency: 0 | 1; exchangeRate: number; issuedAtUtc: string; lines: Array<Pick<InvoiceLine, 'productId' | 'quantity' | 'unitPrice' | 'discount' | 'tax' | 'originalLineId'>>; freight: number; purchaseTaxRecoverable: boolean; notes: string; originalDocumentId: string | null }
export interface Party { id: string; userId: string | null; name: string; phone: string; address: string; role: 0 | 1 | 2; isLegalEntity: boolean; registrationNumber: string | null; notes: string; version: number; balanceToman?: number }
export type PartyInput = Omit<Party, 'id'> & { id: string | null };
export interface Settlement { id: string; counterpartyId: string; direction: 0 | 1; method: 0 | 1 | 2 | 3; amountToman: number; allocatedToman: number; reference: string; occurredAtUtc: string; requiresReview: boolean }
export interface Ledger { counterpartyId: string; balanceToman: number; entries: Paged<{ id: string; documentId: string | null; settlementId: string | null; amountToman: number; postedAtUtc: string }> }
export interface Inventory { productId: string; productCode: number; title: string; onHand: number; reserved: number; available: number; valueToman: number; averageCostToman: number; version: number }
export interface Movement { id: string; productId: string; kind: number; quantityDelta: number; reservedDelta: number; valueDelta: number; postedAtUtc: string; sourceKey: string; reason: string }
export interface Overview { activated: boolean; postedSales: number; postedPurchases: number; salesNetToman: number; purchasesNetToman: number; inventoryValueToman: number; grossProfitKnownToman: number; unknownCostLines: number; receivablesToman: number; payablesToman: number; purchaseReturnDifferenceToman: number }
export interface SetupPreview { activated: boolean; fingerprint: string; products: Array<{ id: string; productCode: number; title: string; slug: string; stockQuantity: number }>; openOrderIds: string[]; activeReservations: number }
export interface HistoricalPayment { paymentId: string; orderId: string; orderNumber: string; amountToman: number; eligible: boolean; blocker: string | null; fingerprint: string }
export interface OrderContext { activated: boolean; hasServerVerification: boolean; paymentStatus: string; invoiceId: string | null; invoiceNumber: string | null; paymentRequiresReview: boolean; reservations: Array<{ id: string; productId: string; quantity: number; status: number; expiresAtUtc: string }> }
export interface PriceHistory { lineId: string; documentId: string; number: string; kind: DocumentKind; issuedAtUtc: string; counterpartyId: string; buyerSnapshotJson: string; quantity: number; currency: number; exchangeRate: number; unitPrice: number; discount: number; tax: number; capturedCostToman: number | null }

export const sections = ['overview', 'purchases', 'sales', 'quotes', 'counterparties', 'payments', 'movements', 'reports'] as const;
export type AccountingSection = typeof sections[number];
export const sectionLabels = { fa: ['نمای کلی', 'خرید', 'فروش', 'پیش‌فاکتور', 'طرف حساب‌ها', 'دریافت و پرداخت', 'گردش کالا', 'گزارش‌ها'], en: ['Overview', 'Purchases', 'Sales', 'Proformas', 'Counterparties', 'Receipts & payments', 'Stock movements', 'Reports'] };
export const kindLabels = { fa: ['خرید', 'فروش', 'پیش‌فاکتور', 'برگشت خرید', 'برگشت فروش'], en: ['Purchase', 'Sale', 'Proforma', 'Purchase return', 'Sales return'] };
export const statusLabels = { fa: ['پیش‌نویس', 'قطعی', 'باطل‌شده'], en: ['Draft', 'Posted', 'Voided'] };

/** Reads an immutable party snapshot safely; never silently substitutes live party records. */
export function partyName(json: string): string {
  try { const parsed: unknown = JSON.parse(json); if (parsed && typeof parsed === 'object' && 'Name' in parsed && typeof parsed.Name === 'string') return parsed.Name; } catch { /* Legacy invalid snapshots remain visibly unavailable. */ }
  return '—';
}
