const menu_data = [
  {
    id: 1,
    title: 'Home',
    titleFa: 'خانه',
    link: '/',
  },
  {
    id: 2,
    title: 'About Us',
    titleFa: 'درباره ما',
    link: '/about'
  },
  {
    id: 3,
    title: 'Shop',
    titleFa: 'فروشگاه',
    link: '/shop'
  },
  {
    id: 4,
    hasDropdown: true,
    title: 'Pages',
    titleFa: 'صفحات',
    link: '/about',
    submenus: [
      { title: 'FAQs', titleFa: 'سوالات متداول', link: '/faq' },
      { title: 'Privacy & Policy', titleFa: 'حریم خصوصی', link: '/policy' },
      { title: 'Terms & Conditions', titleFa: 'قوانین و شرایط', link: '/terms' },
      { title: 'Login', titleFa: 'ورود', link: '/login' },
      { title: 'Register', titleFa: 'ثبت نام', link: '/register' },
      { title: 'Forgot Password', titleFa: 'فراموشی رمز', link: '/forgot' },
      { title: 'My Cart', titleFa: 'سبد خرید', link: '/cart' },
      { title: 'My Wishlist', titleFa: 'علاقه مندی ها', link: '/wishlist' },
      { title: 'Checkout', titleFa: 'تسویه حساب', link: '/checkout' },
      { title: 'Error 404', titleFa: 'صفحه ۴۰۴', link: '/404' },
    ]
  },
  {
    id: 5,
    title: 'Contact us',
    titleFa: 'تماس با ما',
    link: '/contact'
  },
]

export default menu_data;
