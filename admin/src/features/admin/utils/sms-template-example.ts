const storefront = 'https://vendorashop.ir/fa/';
const exampleOrder = 'vd-1048';
const exampleLinks: Record<string, string> = {
  TicketReply: 'account/tickets',
  AdminTicketNew: 'admin/tickets',
  AdminTicketReply: 'admin/tickets',
  AdminOrderPaid: 'admin/orders',
  AdminPaymentReview: 'admin/orders',
  AdminLowStock: 'admin/product-list',
};
const exampleCodes: Record<string, string> = {
  Login: '123456',
  Registration: '583164',
  PhoneVerification: '479125',
  Recovery: '648291',
  Test: '736205',
};

/** Renders a saved or edited template using fictional values, without contacting the SMS API. */
export function smsTemplateExample(template: string, event: string, otp = false): string {
  const values: Record<string, string> = otp ? { code: exampleCodes[event] ?? '123456' } : {
    name: 'علی رضایی',
    orderNumber: exampleOrder,
    amount: '2,980,000',
    link: storefront + (exampleLinks[event] ?? `order/${exampleOrder}`),
    product: 'کیف دوشی مدل آوا',
    quantity: '3',
  };
  return template.replace(/\{([a-zA-Z]+)\}/g, (token, name: string) => Object.hasOwn(values, name) ? values[name] : token);
}
