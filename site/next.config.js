/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      { source: '/about', destination: '/fa/about', permanent: false },
      { source: '/cart', destination: '/fa/cart', permanent: false },
      { source: '/checkout', destination: '/fa/checkout', permanent: false },
      { source: '/contact', destination: '/fa/contact', permanent: false },
      { source: '/faq', destination: '/fa/faq', permanent: false },
      { source: '/forgot', destination: '/fa/forgot', permanent: false },
      { source: '/login', destination: '/fa/login', permanent: false },
      { source: '/policy', destination: '/fa/policy', permanent: false },
      { source: '/register', destination: '/fa/register', permanent: false },
      { source: '/search', destination: '/fa/search', permanent: false },
      { source: '/shop', destination: '/fa/shop', permanent: false },
      { source: '/terms', destination: '/fa/terms', permanent: false },
      { source: '/user-dashboard', destination: '/fa/user-dashboard', permanent: false },
      { source: '/wishlist', destination: '/fa/wishlist', permanent: false },
      { source: '/product-details/:id', destination: '/fa/product-details/:id', permanent: false },
      { source: '/order/:id', destination: '/fa/order/:id', permanent: false },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: 'i.ibb.co',
        pathname: "**",
      },
      {
        protocol: "https",
        hostname: 'res.cloudinary.com',
        pathname: "**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "5020",
        pathname: "/uploads/**",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "5020",
        pathname: "/uploads/**",
      },
      {
        protocol: "https",
        hostname: "localhost",
        port: "5020",
        pathname: "/uploads/**",
      },
    ],
  },
}

module.exports = nextConfig
