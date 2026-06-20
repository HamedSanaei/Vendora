import { NextResponse } from 'next/server';

const locales = ['fa', 'en'];
const defaultLocale = 'fa';
const routePrefixes = [
  '/about',
  '/cart',
  '/checkout',
  '/contact',
  '/faq',
  '/forget-password',
  '/forgot',
  '/login',
  '/order',
  '/policy',
  '/product-details',
  '/register',
  '/search',
  '/shop',
  '/terms',
  '/user-dashboard',
  '/wishlist',
];

export function proxy(request) {
  const { pathname } = request.nextUrl;

  if (pathname === '/') {
    return NextResponse.redirect(new URL(`/${defaultLocale}`, request.url));
  }

  const locale = locales.find((item) => pathname === `/${item}` || pathname.startsWith(`/${item}/`));

  if (!locale && routePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return NextResponse.redirect(new URL(`/${defaultLocale}${pathname}`, request.url));
  }

  if (!locale) {
    return NextResponse.next();
  }

  const nextPathname = pathname === `/${locale}` ? '/' : pathname.replace(`/${locale}`, '');
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-vendora-locale', locale);

  return NextResponse.rewrite(new URL(nextPathname, request.url), {
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|assets).*)'],
};
