import { NextResponse } from 'next/server';
import { http } from './lib/http';

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
  '/product',
  '/category',
  '/register',
  '/search',
  '/shop',
  '/shipping',
  '/terms',
  '/user-dashboard',
  '/wishlist',
];

export async function proxy(request) {
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

  // Keep historical English identifiers functional while the English storefront remains noindex.
  if (locale === 'en' && /^\/en\/(product|product-details|category)\/[^/]+$/.test(pathname)) {
    try {
      const [, , kind, identifier] = pathname.split('/');
      const { data } = await http.get(`/catalog/${kind === 'category' ? 'categories' : 'products'}/${identifier}`, { timeout: 5000 });
      const canonical = `/en/${kind === 'category' ? 'category' : 'product'}/${encodeURIComponent(data.slug)}`;
      if (canonical !== pathname) { const target = request.nextUrl.clone(); target.pathname = canonical; return NextResponse.redirect(target, 301); }
    } catch { /* The page distinguishes missing content from temporary API failure. */ }
  }

  // The backend owns alias history and manual redirect validation; preserve campaign/filter queries.
  if (locale === 'fa' && /^\/fa\/(product|product-details|category|shop|about|contact|faq|policy|terms)(\/|$)/.test(pathname)) {
    try {
      const { data } = await http.get('/catalog/seo/redirect', { params: { path: pathname }, timeout: 5000 });
      if (data?.location?.startsWith('/fa/') && [301, 302].includes(data.statusCode)) {
        const target = request.nextUrl.clone();
        target.pathname = data.location;
        return NextResponse.redirect(target, data.statusCode);
      }
    } catch {
      // A redirect lookup failure never manufactures content. The page read reports genuine API failures.
    }
  }

  const nextPathname = pathname === `/${locale}` ? '/' : pathname.replace(`/${locale}`, '');
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-vendora-locale', locale);
  requestHeaders.set('x-vendora-locale-rewrite', locale);
  requestHeaders.set('x-vendora-pathname', pathname);
  requestHeaders.set('x-vendora-faceted', [...request.nextUrl.searchParams.keys()].some(key => !['page', 'utm_source', 'utm_medium', 'utm_campaign'].includes(key)) ? '1' : '0');

  // `/` itself redirects back to the default locale; rewriting `/fa` onto it
  // would ping-pong forever, so pass it through with the locale header only.
  if (nextPathname === '/') {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Preserve query parameters such as the address being edited through the locale rewrite.
  const rewriteUrl = request.nextUrl.clone();
  rewriteUrl.pathname = nextPathname;
  return NextResponse.rewrite(rewriteUrl, {
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|assets).*)'],
};
