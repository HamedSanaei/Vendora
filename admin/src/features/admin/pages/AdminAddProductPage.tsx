import { observer } from 'mobx-react-lite';
import { type ChangeEvent, type FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
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
    const validationError = validateImages(selectedFiles, gallery.length);
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
      setFormError('Product title is required.');
      return;
    }

    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      setFormError('Product price must be greater than zero.');
      return;
    }

    if (!Number.isInteger(numericStock) || numericStock < 0) {
      setFormError('Stock quantity cannot be negative.');
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
      setFormError(products.saveError ?? 'Unable to save product.');
      return;
    }

    toast.success(isEdit ? 'Product updated successfully.' : 'Product created successfully.');
    navigate(adminPath(locale, 'product-list'));
  }

  return (
    <section className="admin-page">
      <div className="admin-page-title">
        <h1>{isEdit ? adminText(locale, 'editProduct') : adminText(locale, 'addProduct')}</h1>
        <p>{isEdit ? 'Update product data and optionally replace images.' : 'Create a catalog product with local image upload.'}</p>
      </div>

      <form className="admin-product-form" onSubmit={handleSubmit}>
        <article className="admin-panel">
          <div className="admin-form-grid">
            <label>
              Product title
              <input name="title" value={title} onChange={(event) => handleTitleChange(event.target.value)} placeholder="Laptop Briefcase" />
            </label>
            <label>
              Slug
              <input name="slug" value={slug} onChange={(event) => { clearErrors(); setSlug(event.target.value); }} placeholder="laptop-briefcase" />
            </label>
            <label>
              Price ({adminText(locale, 'toman')})
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
              Stock quantity
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
            <label>
              Brand
              <select value={brandId} onChange={(event) => { clearErrors(); setBrandId(event.target.value); }}>
                <option value="">No brand</option>
                {brands.brands.filter((brand) => brand.isActive).map((brand) => (
                  <option value={brand.id} key={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select value={status} onChange={(event) => { clearErrors(); setStatus(event.target.value as CreateAdminProductInput['status']); }}>
                <option value="Draft">Draft</option>
                <option value="Active">Active</option>
                <option value="Archived">Archived</option>
              </select>
            </label>
          </div>

          <label className="admin-form-full">
            Description
            <textarea name="description" value={description} onChange={(event) => { clearErrors(); setDescription(event.target.value); }} rows={5} />
          </label>

          {products.categoryOptions.length > 0 ? (
            <div className="admin-gallery-section">
              <strong>Categories</strong>
              <small>Select every category that describes this product. The first selected category is kept as the legacy primary category.</small>
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
            Upload images
            <input accept="image/jpeg,image/png,image/webp" multiple type="file" onChange={handleImagesChange} />
            <span>Add images in multiple rounds. JPG, PNG, or WebP. Max {maxProductImages} files, 5MB each.</span>
          </label>

          {products.colorOptions.length > 0 ? (
            <div className="admin-gallery-section">
              <strong>Colors</strong>
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
              <strong>Product gallery</strong>
              <div className="admin-image-gallery">
                {gallery.map((image) => (
                  <figure key={image.key} className={primaryImageKey === image.key ? 'admin-image-primary' : ''}>
                    <img src={image.url} alt={image.name} />
                    <figcaption>{primaryImageKey === image.key ? 'Primary' : image.name}</figcaption>
                    <div className="admin-gallery-actions">
                      <button type="button" onClick={() => setPrimaryImageKey(image.key)}>
                        Make primary
                      </button>
                      <button type="button" onClick={() => removeGalleryItem(image)}>
                        Remove
                      </button>
                    </div>
                  </figure>
                ))}
              </div>
            </div>
          ) : null}

          {formError ?? products.saveError ? <div className="admin-error">{formError ?? products.saveError}</div> : null}

          <div className="admin-form-actions">
            <button className="admin-ghost-btn" type="button" onClick={() => navigate(adminPath(locale, 'product-list'))}>
              {adminText(locale, 'cancel')}
            </button>
            <button className="admin-primary-btn" type="submit" disabled={products.isSaving}>
              {products.isSaving ? adminText(locale, 'saving') : adminText(locale, 'save')}
            </button>
          </div>
        </article>
      </form>
    </section>
  );
});

function validateImages(files: File[], currentCount: number): string | null {
  if (currentCount + files.length > maxProductImages) {
    return `A product can have at most ${maxProductImages} images.`;
  }

  for (const file of files) {
    if (!allowedImageTypes.includes(file.type)) {
      return 'Only JPG, PNG, and WebP product images are allowed.';
    }

    if (file.size > maxImageBytes) {
      return 'Each product image must be 5MB or smaller.';
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
