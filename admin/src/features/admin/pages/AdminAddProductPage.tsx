import { observer } from 'mobx-react-lite';
import { type ChangeEvent, type FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { AdminButton, AdminFeedback, AdminPageHeader, AdminSelect, AdminTextarea } from '../components/AdminUi';
import { adminPath, adminText, normalizeAdminLocale } from '../i18n';
import { useAdminStore } from '../stores/AdminStoreContext';
import type { CreateAdminProductInput } from '../types';
import { getAsciiDigits, formatNumberInput, parseNumberInput } from '../utils/formatters';

const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp'];
const maxImageBytes = 5 * 1024 * 1024;
const maxProductImages = 10;

interface AdminAddProductPageProps {
  mode?: 'create' | 'edit';
}

type GalleryItem =
  | { key: string; kind: 'existing'; id: string; url: string; name: string; isPrimary: boolean; sortOrder: number }
  | { key: string; kind: 'new'; file: File; url: string; name: string; isPrimary: boolean; sortOrder: number };

export const AdminAddProductPage = observer(function AdminAddProductPage({ mode = 'create' }: AdminAddProductPageProps) {
  const { products, brands } = useAdminStore();
  const navigate = useNavigate();
  const params = useParams();
  const locale = normalizeAdminLocale(params.locale);
  const isFa = locale === 'fa';
  const productId = params.id;
  const isEdit = mode === 'edit' && Boolean(productId);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [stockQuantity, setStockQuantity] = useState('0');
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [brandId, setBrandId] = useState('');
  const [colorIds, setColorIds] = useState<string[]>([]);
  const [status, setStatus] = useState<CreateAdminProductInput['status']>('Draft');
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [deletedImageIds, setDeletedImageIds] = useState<string[]>([]);
  const [primaryImageKey, setPrimaryImageKey] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    void products.loadCategoryOptions();
    void products.loadColorOptions();
    void brands.loadBrands();
  }, [brands, products]);

  useEffect(() => {
    if (!isEdit || !productId) {
      return;
    }

    let ignore = false;
    void products.loadProduct(productId).then((product) => {
      if (!product || ignore) {
        return;
      }

      setTitle(product.title);
      setSlug(product.slug);
      setDescription(product.description ?? '');
      setPrice(formatNumberInput(String(product.price), locale));
      setStockQuantity(String(product.stockQuantity));
      setCategoryIds(product.categoryIds.length > 0 ? product.categoryIds : product.categoryId ? [product.categoryId] : []);
      setBrandId(product.brandId ?? '');
      setColorIds(product.colors.map((color) => color.id));
      setStatus(product.status);
      const existingGallery = product.images
        .sort((first, second) => first.sortOrder - second.sortOrder)
        .map((image) => ({
          key: `existing-${image.id}`,
          kind: 'existing' as const,
          id: image.id,
          url: image.imageUrl,
          name: image.altText ?? product.title,
          isPrimary: image.isPrimary,
          sortOrder: image.sortOrder,
        }));
      setGallery(existingGallery);
      setDeletedImageIds([]);
      setPrimaryImageKey(existingGallery.find((image) => image.isPrimary)?.key ?? existingGallery[0]?.key ?? null);
    });

    return () => {
      ignore = true;
    };
  }, [isEdit, locale, productId, products]);

  function clearErrors(): void {
    setFormError(null);
    products.clearSaveError();
  }

  function handleTitleChange(value: string): void {
    clearErrors();
    setTitle(value);
    if (!slug.trim()) {
      setSlug(toSlug(value));
    }
  }

  function handleImagesChange(event: ChangeEvent<HTMLInputElement>): void {
    clearErrors();
    const selectedFiles = Array.from(event.target.files ?? []);
    const validationError = validateImages(selectedFiles, gallery.length, isFa);
    if (validationError) {
      setFormError(validationError);
      event.target.value = '';
      return;
    }

    const nextItems = selectedFiles.map((file, index) => ({
      key: `new-${crypto.randomUUID()}`,
      kind: 'new' as const,
      file,
      url: URL.createObjectURL(file),
      name: file.name,
      isPrimary: false,
      sortOrder: gallery.length + index + 1,
    }));

    setGallery((current) => {
      const next = [...current, ...nextItems];
      if (!primaryImageKey && next.length > 0) {
        setPrimaryImageKey(next[0].key);
      }

      return next;
    });
    event.target.value = '';
  }

  function removeGalleryItem(item: GalleryItem): void {
    clearErrors();
    if (item.kind === 'existing') {
      setDeletedImageIds((current) => [...current, item.id]);
    } else {
      URL.revokeObjectURL(item.url);
    }

    setGallery((current) => {
      const next = current.filter((image) => image.key !== item.key);
      if (primaryImageKey === item.key) {
        setPrimaryImageKey(next[0]?.key ?? null);
      }

      return next;
    });
  }

  function toggleColor(colorId: string): void {
    clearErrors();
    setColorIds((current) => current.includes(colorId)
      ? current.filter((id) => id !== colorId)
      : [...current, colorId]);
  }

  function toggleCategory(categoryId: string): void {
    clearErrors();
    setCategoryIds((current) => current.includes(categoryId)
      ? current.filter((id) => id !== categoryId)
      : [...current, categoryId]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    clearErrors();
    const numericPrice = parseNumberInput(price);
    const normalizedTitle = title.trim();
    const normalizedSlug = slug.trim();
    const normalizedDescription = description.trim();
    const numericStock = parseNumberInput(stockQuantity);

    if (!normalizedTitle) {
      setFormError(isFa ? 'عنوان محصول الزامی است.' : 'Product title is required.');
      return;
    }

    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      setFormError(isFa ? 'قیمت محصول باید بیشتر از صفر باشد.' : 'Product price must be greater than zero.');
      return;
    }

    if (!Number.isInteger(numericStock) || numericStock < 0) {
      setFormError(isFa ? 'موجودی محصول نمی‌تواند منفی باشد.' : 'Stock quantity cannot be negative.');
      return;
    }

    const newImages = gallery.filter((image): image is Extract<GalleryItem, { kind: 'new' }> => image.kind === 'new');
    const selectedPrimary = gallery.find((image) => image.key === primaryImageKey);
    const primaryNewImageIndex = selectedPrimary?.kind === 'new'
      ? newImages.findIndex((image) => image.key === selectedPrimary.key)
      : undefined;

    const payload: CreateAdminProductInput = {
      title: normalizedTitle,
      slug: normalizedSlug,
      description: normalizedDescription,
      price: numericPrice,
      stockQuantity: numericStock,
      categoryId: categoryIds[0] || undefined,
      categoryIds,
      brandId: brandId || undefined,
      colorIds,
      status,
      images: newImages.map((image) => image.file),
      deletedImageIds,
      primaryImageId: selectedPrimary?.kind === 'existing' ? selectedPrimary.id : undefined,
      primaryNewImageIndex: primaryNewImageIndex !== undefined && primaryNewImageIndex >= 0 ? primaryNewImageIndex : undefined,
    };

    const saved = isEdit && productId
      ? await products.updateProduct(productId, payload)
      : await products.createProduct(payload);

    if (!saved) {
      setFormError(products.saveError ?? (isFa ? 'ذخیره محصول ناموفق بود.' : 'Unable to save product.'));
      return;
    }

    toast.success(isFa ? (isEdit ? 'محصول با موفقیت به‌روزرسانی شد.' : 'محصول با موفقیت ایجاد شد.') : (isEdit ? 'Product updated successfully.' : 'Product created successfully.'));
    navigate(adminPath(locale, 'product-list'));
  }

  return (
    <section className="admin-page">
      <AdminPageHeader eyebrow={isFa ? 'فرم کاتالوگ' : 'Catalog form'} title={isEdit ? adminText(locale, 'editProduct') : adminText(locale, 'addProduct')} description={isFa ? (isEdit ? 'اطلاعات، ویژگی‌ها و گالری محصول را با حفظ تصاویر موجود به‌روزرسانی کنید.' : 'محصول تازه را همراه دسته‌بندی، رنگ و گالری تصاویر ایجاد کنید.') : (isEdit ? 'Update product data and optionally replace images.' : 'Create a catalog product with local image upload.')} />

      <form className="admin-product-form" onSubmit={handleSubmit}>
        <article className="admin-panel">
          <div className="admin-form-grid">
            <label>
              {isFa ? 'عنوان محصول' : 'Product title'}
              <input name="title" required value={title} onChange={(event) => handleTitleChange(event.target.value)} placeholder={isFa ? 'کیف اداری لپ‌تاپ' : 'Laptop Briefcase'} />
            </label>
            <label>
              {isFa ? 'اسلاگ' : 'Slug'}
              <input name="slug" value={slug} onChange={(event) => { clearErrors(); setSlug(event.target.value); }} placeholder="laptop-briefcase" />
            </label>
            <label>
              {isFa ? `قیمت (${adminText(locale, 'toman')})` : `Price (${adminText(locale, 'toman')})`}
              <input
                inputMode="numeric"
                name="price"
                value={price}
                onChange={(event) => {
                  clearErrors();
                  setPrice(formatNumberInput(event.target.value, locale));
                }}
                placeholder="1,250,000"
              />
            </label>
            <label>
              {isFa ? 'تعداد موجودی' : 'Stock quantity'}
              <input
                inputMode="numeric"
                name="stockQuantity"
                value={stockQuantity}
                onChange={(event) => {
                  clearErrors();
                  setStockQuantity(getAsciiDigits(event.target.value));
                }}
                placeholder="0"
              />
            </label>
            <AdminSelect label={isFa ? 'برند' : 'Brand'} value={brandId} onChange={(event) => { clearErrors(); setBrandId(event.target.value); }}>
                <option value="">{isFa ? 'بدون برند' : 'No brand'}</option>
                {brands.brands.filter((brand) => brand.isActive).map((brand) => (
                  <option value={brand.id} key={brand.id}>
                    {brand.name}
                  </option>
                ))}
            </AdminSelect>
            <AdminSelect label={isFa ? 'وضعیت انتشار' : 'Status'} value={status} onChange={(event) => { clearErrors(); setStatus(event.target.value as CreateAdminProductInput['status']); }}>
                <option value="Draft">{isFa ? 'پیش‌نویس' : 'Draft'}</option>
                <option value="Active">{isFa ? 'فعال' : 'Active'}</option>
                <option value="Archived">{isFa ? 'آرشیو' : 'Archived'}</option>
            </AdminSelect>
          </div>

          <AdminTextarea className="admin-form-full" label={isFa ? 'توضیحات محصول' : 'Description'} name="description" value={description} onChange={(event) => { clearErrors(); setDescription(event.target.value); }} rows={5} />

          {products.categoryOptions.length > 0 ? (
            <div className="admin-gallery-section">
              <strong>{isFa ? 'دسته‌بندی‌ها' : 'Categories'}</strong>
              <small>{isFa ? 'تمام دسته‌های مرتبط را انتخاب کنید؛ اولین انتخاب به‌عنوان دسته اصلی سازگار ذخیره می‌شود.' : 'Select every category that describes this product. The first selected category is kept as the legacy primary category.'}</small>
              <div className="admin-category-options">
                {products.categoryOptions.map((category) => (
                  <label
                    key={category.id}
                    className={category.parentCategoryId ? 'admin-category-option admin-category-option-child' : 'admin-category-option admin-category-option-parent'}
                  >
                    <input
                      checked={categoryIds.includes(category.id)}
                      type="checkbox"
                      onChange={() => toggleCategory(category.id)}
                    />
                    {category.name}
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          <label className="admin-upload-box">
            {isFa ? 'بارگذاری تصاویر' : 'Upload images'}
            <input accept="image/jpeg,image/png,image/webp" multiple type="file" onChange={handleImagesChange} />
            <span>{isFa ? `تصاویر JPG، PNG یا WebP را در چند مرحله اضافه کنید؛ حداکثر ${maxProductImages.toLocaleString('fa-IR')} فایل و هرکدام ۵ مگابایت.` : `Add images in multiple rounds. JPG, PNG, or WebP. Max ${maxProductImages} files, 5MB each.`}</span>
          </label>

          {products.colorOptions.length > 0 ? (
            <div className="admin-gallery-section">
              <strong>{isFa ? 'رنگ‌ها' : 'Colors'}</strong>
              <div className="admin-color-options">
                {products.colorOptions.map((color) => (
                  <label key={color.id} className="admin-color-option">
                    <input
                      checked={colorIds.includes(color.id)}
                      type="checkbox"
                      onChange={() => toggleColor(color.id)}
                    />
                    <span style={{ backgroundColor: color.hexCode ?? '#d1d5db' }} />
                    {color.name}
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          {gallery.length > 0 ? (
            <div className="admin-gallery-section">
              <strong>{isFa ? 'گالری محصول' : 'Product gallery'}</strong>
              <div className="admin-image-gallery">
                {gallery.map((image) => (
                  <figure key={image.key} className={primaryImageKey === image.key ? 'admin-image-primary' : ''}>
                    <img src={image.url} alt={image.name} />
                    <figcaption>{primaryImageKey === image.key ? (isFa ? 'تصویر اصلی' : 'Primary') : image.name}</figcaption>
                    <div className="admin-gallery-actions">
                      <AdminButton onClick={() => setPrimaryImageKey(image.key)} variant="secondary">{isFa ? 'انتخاب به‌عنوان اصلی' : 'Make primary'}</AdminButton>
                      <AdminButton onClick={() => removeGalleryItem(image)} variant="danger">{isFa ? 'حذف' : 'Remove'}</AdminButton>
                    </div>
                  </figure>
                ))}
              </div>
            </div>
          ) : null}

          {formError ?? products.saveError ? <AdminFeedback tone="error">{formError ?? products.saveError}</AdminFeedback> : null}

          <div className="admin-form-actions">
            <AdminButton onClick={() => navigate(adminPath(locale, 'product-list'))} variant="secondary">{adminText(locale, 'cancel')}</AdminButton>
            <AdminButton disabled={products.isSaving} type="submit" variant="brass">{products.isSaving ? adminText(locale, 'saving') : adminText(locale, 'save')}</AdminButton>
          </div>
        </article>
      </form>
    </section>
  );
});

function validateImages(files: File[], currentCount: number, isFa: boolean): string | null {
  if (currentCount + files.length > maxProductImages) {
    return isFa ? `هر محصول حداکثر می‌تواند ${maxProductImages.toLocaleString('fa-IR')} تصویر داشته باشد.` : `A product can have at most ${maxProductImages} images.`;
  }

  for (const file of files) {
    if (!allowedImageTypes.includes(file.type)) {
      return isFa ? 'فقط تصاویر JPG، PNG و WebP مجاز هستند.' : 'Only JPG, PNG, and WebP product images are allowed.';
    }

    if (file.size > maxImageBytes) {
      return isFa ? 'حجم هر تصویر باید حداکثر ۵ مگابایت باشد.' : 'Each product image must be 5MB or smaller.';
    }
  }

  return null;
}

function toSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
