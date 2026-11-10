# VendoraShop ParsGreen SMS templates

These are the 19 VendoraShop WhiteText templates. Copy the template into ParsGreen with each variable replaced by `%%`. For OTP, replace both occurrences of `{code}` with `%%` and keep the blank line and the `@vendorashop.ir #` prefix exactly as shown. The examples use fictional values.

## Service notifications and test

### OrderPaid

Template

```text
وندوراشاپ {name} عزیز، پرداخت سفارش {orderNumber} به مبلغ {amount} تومان تأیید شد. https://vendorashop.ir/fa/order/{orderNumber}
```

Example

```text
وندوراشاپ علی رضایی عزیز، پرداخت سفارش vd-1048 به مبلغ 2,980,000 تومان تأیید شد. https://vendorashop.ir/fa/order/vd-1048
```

### OrderShipped

Template

```text
وندوراشاپ سفارش {orderNumber} ارسال شد. جزئیات و پیگیری: https://vendorashop.ir/fa/order/{orderNumber}
```

Example

```text
وندوراشاپ سفارش vd-1048 ارسال شد. جزئیات و پیگیری: https://vendorashop.ir/fa/order/vd-1048
```

### OrderDelivered

Template

```text
وندوراشاپ سفارش {orderNumber} تحویل شد. سپاس از خرید شما. https://vendorashop.ir/fa/order/{orderNumber}
```

Example

```text
وندوراشاپ سفارش vd-1048 تحویل شد. سپاس از خرید شما. https://vendorashop.ir/fa/order/vd-1048
```

### OrderCancelled

Template

```text
وندوراشاپ سفارش {orderNumber} لغو شد. جزئیات: https://vendorashop.ir/fa/order/{orderNumber}
```

Example

```text
وندوراشاپ سفارش vd-1048 لغو شد. جزئیات: https://vendorashop.ir/fa/order/vd-1048
```

### TicketReply

Template

```text
وندوراشاپ پشتیبانی به تیکت شما پاسخ داد. مشاهده پاسخ: https://vendorashop.ir/fa/account/tickets
```

Example

```text
وندوراشاپ پشتیبانی به تیکت شما پاسخ داد. مشاهده پاسخ: https://vendorashop.ir/fa/account/tickets
```

### PasswordChanged

Template

```text
وندوراشاپ رمز عبور حساب شما تغییر کرد. اگر شما نبوده اید با پشتیبانی تماس بگیرید.
```

Example

```text
وندوراشاپ رمز عبور حساب شما تغییر کرد. اگر شما نبوده اید با پشتیبانی تماس بگیرید.
```

### PhoneChanged

Template

```text
وندوراشاپ شماره همراه حساب شما تغییر کرد. اگر شما نبوده اید با پشتیبانی تماس بگیرید.
```

Example

```text
وندوراشاپ شماره همراه حساب شما تغییر کرد. اگر شما نبوده اید با پشتیبانی تماس بگیرید.
```

### PaymentReview

Template

```text
وندوراشاپ پرداخت سفارش {orderNumber} دریافت شد؛ سفارش نیازمند بررسی پشتیبانی است. https://vendorashop.ir/fa/order/{orderNumber}
```

Example

```text
وندوراشاپ پرداخت سفارش vd-1048 دریافت شد؛ سفارش نیازمند بررسی پشتیبانی است. https://vendorashop.ir/fa/order/vd-1048
```

### AdminOrderPaid

Template

```text
وندوراشاپ سفارش پرداخت شده جدید: {orderNumber}، مبلغ {amount} تومان. https://vendorashop.ir/fa/admin/orders
```

Example

```text
وندوراشاپ سفارش پرداخت شده جدید: vd-1048، مبلغ 2,980,000 تومان. https://vendorashop.ir/fa/admin/orders
```

### AdminTicketNew

Template

```text
وندوراشاپ تیکت پشتیبانی جدید ثبت شد. https://vendorashop.ir/fa/admin/tickets
```

Example

```text
وندوراشاپ تیکت پشتیبانی جدید ثبت شد. https://vendorashop.ir/fa/admin/tickets
```

### AdminTicketReply

Template

```text
وندوراشاپ مشتری به تیکت پشتیبانی پاسخ داد. https://vendorashop.ir/fa/admin/tickets
```

Example

```text
وندوراشاپ مشتری به تیکت پشتیبانی پاسخ داد. https://vendorashop.ir/fa/admin/tickets
```

### AdminLowStock

Template

```text
وندوراشاپ موجودی قابل فروش {product} کم است: {quantity} عدد. https://vendorashop.ir/fa/admin/product-list
```

Example

```text
وندوراشاپ موجودی قابل فروش کیف دوشی مدل آوا کم است: 3 عدد. https://vendorashop.ir/fa/admin/product-list
```

### AdminPaymentReview

Template

```text
وندوراشاپ پرداخت سفارش {orderNumber} دریافت شده اما نیازمند بررسی دستی است. https://vendorashop.ir/fa/admin/orders
```

Example

```text
وندوراشاپ پرداخت سفارش vd-1048 دریافت شده اما نیازمند بررسی دستی است. https://vendorashop.ir/fa/admin/orders
```

### Service test

Template

```text
این پیام برای آزمایش اتصال پیامک وندوراشاپ ارسال شده است.
```

Example

```text
این پیام برای آزمایش اتصال پیامک وندوراشاپ ارسال شده است.
```

## Branded OTP

These five patterns apply when **Use Vendorashop branded OTP text** is enabled. The example codes are for documentation only.

### Login

Template

```text
کد ورود شما به وندوراشاپ: {code}

@vendorashop.ir #{code}
```

Example

```text
کد ورود شما به وندوراشاپ: 123456

@vendorashop.ir #123456
```

### Registration

Template

```text
کد ثبت نام شما در وندوراشاپ: {code}

@vendorashop.ir #{code}
```

Example

```text
کد ثبت نام شما در وندوراشاپ: 583164

@vendorashop.ir #583164
```

### PhoneVerification

Template

```text
کد تأیید شماره همراه شما در وندوراشاپ: {code}

@vendorashop.ir #{code}
```

Example

```text
کد تأیید شماره همراه شما در وندوراشاپ: 479125

@vendorashop.ir #479125
```

### Recovery

Template

```text
کد بازیابی رمز عبور شما در وندوراشاپ: {code}

@vendorashop.ir #{code}
```

Example

```text
کد بازیابی رمز عبور شما در وندوراشاپ: 648291

@vendorashop.ir #648291
```

### Test

Template

```text
کد آزمایشی پیامک وندوراشاپ: {code}

@vendorashop.ir #{code}
```

Example

```text
کد آزمایشی پیامک وندوراشاپ: 736205

@vendorashop.ir #736205
```
