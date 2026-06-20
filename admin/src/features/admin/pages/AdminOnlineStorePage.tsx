import { AdminPlaceholderPage } from '../components/AdminPlaceholderPage';

export function AdminOnlineStorePage() {
  return (
    <AdminPlaceholderPage
      title="Online store"
      description="Storefront shortcut is available here until the public storefront routes are connected."
      actions={['Open Storefront', 'Preview Products']}
    />
  );
}
