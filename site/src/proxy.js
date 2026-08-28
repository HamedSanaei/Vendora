import { NextResponse } from 'next/server';

const locales = ['fa', 'en'];
const defaultLocale = 'fa';
const routePrefixes = [
  '/about',
  '/account',
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
  '/shipping',
  '/terms',
  '/user-dashboard',
  '/wishlist',
];

export function proxy(request) {
  const { pathname } = request.nextUrl;
  const localeRewrite = request.headers.get('x-vendora-locale-rewrite');

  if (pathname === '/') {
    return NextResponse.redirect(new URL(`/${defaultLocale}`, request.url));
  }

  const locale = locales.find((item) => pathname === `/${item}` || pathname.startsWith(`/${item}/`));

  // Next may run the proxy again for the destination of a locale rewrite. In
  // that internal pass, keep the destination route instead of redirecting it
  // back to the locale-prefixed URL and creating a redirect loop.
  if (!locale && localeRewrite && locales.includes(localeRewrite)) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-vendora-locale', localeRewrite);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (!locale && routePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return NextResponse.redirect(new URL(`/${defaultLocale}${pathname}`, request.url));
  }

  if (!locale) {
    return NextResponse.next();
  }

  const nextPathname = pathname === `/${locale}` ? '/' : pathname.replace(`/${locale}`, '');
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-vendora-locale', locale);
  requestHeaders.set('x-vendora-locale-rewrite', locale);

  // `/` itself redirects back to the default locale; rewriting `/fa` onto it
  // would ping-pong forever, so pass it through with the locale header only.
  if (nextPathname === '/') {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  return NextResponse.rewrite(new URL(nextPathname, request.url), {
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|assets).*)'],
};
