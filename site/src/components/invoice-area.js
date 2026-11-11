"use client";

import { Table, Thead, Tbody, Tr, Th, Td } from 'react-super-responsive-table';
import 'react-super-responsive-table/dist/SuperResponsiveTableStyle.css';
import { formatDate, formatNumber, formatPrice } from '@/lib/vendora/format';
import { storePresentation, useStoreSettings } from '@/components/vendora/layout/store-settings-provider';

/** Printable order summary using the original server prices and the current storefront identity. */
export default function InvoiceArea({ innerRef, info, locale }) {
  const fa = locale === 'fa';
  const brand = storePresentation(useStoreSettings(), locale);
  const { name, country, city, contact, invoice, createdAt, cart, shippingCost, shippingPaymentMode, discount, totalAmount } = info;
  const columns = fa ? ['ردیف', 'محصول', 'تعداد', 'قیمت واحد', 'مبلغ'] : ['No.', 'Product', 'Quantity', 'Unit price', 'Amount'];
  const totals = [
    [fa ? 'هزینهٔ ارسال' : 'Shipping', shippingPaymentMode === 'collect'
      ? (fa ? 'پرداخت هنگام تحویل' : 'Pay on delivery') : formatPrice(shippingCost, locale)],
    [fa ? 'تخفیف' : 'Discount', formatPrice(discount, locale)],
    [fa ? 'مبلغ سفارش' : 'Order total', formatPrice(totalAmount, locale)],
  ];
  return (
    <div ref={innerRef} dir={fa ? 'rtl' : 'ltr'} className="rounded-card border border-vd-line bg-white p-4 md:p-7 tp-invoice-print-wrapper">
      <header className="flex flex-wrap justify-between gap-4 border-b border-vd-line pb-4">
        <div><p className="font-bold text-jade">{brand.name}</p><h1 className="mt-1 text-xl font-extrabold">{fa ? 'خلاصهٔ سفارش' : 'Order summary'}</h1></div>
        <div className="text-sm text-vd-muted"><bdi className="font-bold text-ink">{invoice}</bdi><p>{formatDate(createdAt, locale)}</p></div>
      </header>
      <div className="my-4 space-y-1 text-sm"><p className="font-bold">{name}</p><p>{[country, city].filter(Boolean).join('، ')}</p><bdi>{contact}</bdi></div>
      <Table className="table">
        <Thead><Tr>{columns.map(column => <Th key={column} scope="col">{column}</Th>)}</Tr></Thead>
        <Tbody>{cart.map((item, index) => (
          <Tr key={item._id}>
            <Td>{formatNumber(index + 1, locale)}</Td><Td>{item.title}</Td><Td>{formatNumber(item.orderQuantity, locale)}</Td>
            <Td>{formatPrice(item.price, locale)}</Td><Td>{formatPrice(item.lineTotal, locale)}</Td>
          </Tr>
        ))}</Tbody>
      </Table>
      <dl className="grid gap-3 border-t border-vd-line pt-4 text-sm md:grid-cols-3">
        {totals.map(([label, value]) => <div key={label}><dt className="text-vd-muted">{label}</dt><dd className="mt-1 font-bold text-ink">{value}</dd></div>)}
      </dl>
    </div>
  );
}
