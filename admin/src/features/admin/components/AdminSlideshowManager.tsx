import { isAxiosError } from 'axios';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { createAdminSlideshowSlide, deleteAdminSlideshowSlide, getAdminSlideshow, updateAdminSlideshowSlide } from '../api/adminApi';
import type { AdminLocale } from '../i18n';
import { slideshowCopy } from '../slideshowCopy';
import type { AdminSlideshowSlide } from '../types';
import { normalizeDigits } from '../utils/formatters';
import { AdminButton, AdminEmptyState, AdminFeedback, AdminField, AdminPanel } from './AdminUi';

interface AdminSlideshowManagerProps {
  locale: AdminLocale;
}

type FieldErrors = Partial<Record<'image' | 'sortOrder' | 'durationSeconds', string>>;
const imageExtensions: Record<string, string[]> = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
};
const maxImageBytes = 5 * 1024 * 1024;
const maxSortOrder = 2147483647;

/** Manages real homepage photos with confirmed deletion and server-refreshed settings. */
export function AdminSlideshowManager({ locale }: AdminSlideshowManagerProps) {
  const copy = slideshowCopy(locale);
  const [slides, setSlides] = useState<AdminSlideshowSlide[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState<'saving' | 'deleting' | null>(null);
  const [editing, setEditing] = useState<AdminSlideshowSlide | null>(null);
  const [image, setImage] = useState<File | undefined>();
  const [sortOrder, setSortOrder] = useState('0');
  const [duration, setDuration] = useState('5');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [status, setStatus] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const editorHeading = useRef<HTMLHeadingElement>(null);
  const disabled = isLoading || busy !== null || !isLoaded;
  const numberFormatter = new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US');

  useEffect(() => {
    let active = true;
    void getAdminSlideshow().then((savedSlides) => {
      if (active) {
        setSlides(savedSlides);
        setIsLoaded(true);
      }
    }).catch(() => {
      if (active) setLoadError('loadFailed');
    }).finally(() => {
      if (active) setIsLoading(false);
    });
    return () => { active = false; };
  }, []);

  /** Reloads the persisted list; failed refreshes block edits rather than show stale saved state. */
  async function refreshSlides(): Promise<void> {
    setIsLoading(true);
    setLoadError('');
    try {
      const savedSlides = await getAdminSlideshow();
      setSlides(savedSlides);
      setIsLoaded(true);
    } catch (refreshError) {
      setIsLoaded(false);
      setLoadError('loadFailed');
      throw refreshError;
    } finally {
      setIsLoading(false);
    }
  }

  /** Restores the upload form and clears a selected replacement file without changing saved slides. */
  function resetEditor(): void {
    setEditing(null);
    setImage(undefined);
    setSortOrder('0');
    setDuration('5');
    setFieldErrors({});
    setError('');
    if (fileInput.current) fileInput.current.value = '';
  }

  /** Loads a persisted photo into the single editor and focuses its heading for keyboard users. */
  function startEditing(slide: AdminSlideshowSlide): void {
    resetEditor();
    setStatus('');
    setEditing(slide);
    setSortOrder(String(slide.sortOrder));
    setDuration(String(slide.durationSeconds));
    editorHeading.current?.focus();
  }

  /** Converts HTTP validation failures to localized form messages without exposing raw exceptions. */
  function handleApiError(apiError: unknown, fallback: 'saveFailed' | 'deleteFailed'): void {
    if (!isAxiosError<{ errors?: Record<string, unknown> }>(apiError)) {
      setError(copy[fallback]);
      return;
    }
    const statusCode = apiError.response?.status;
    if (statusCode === 400 || statusCode === 413 || statusCode === 415) {
      const serverFields = apiError.response?.data?.errors;
      const errors: FieldErrors = {};
      for (const key of Object.keys(serverFields ?? {})) {
        const normalizedKey = key.toLowerCase().split('.').pop();
        if (normalizedKey === 'image') errors.image = copy.imageInvalid;
        if (normalizedKey === 'sortorder') errors.sortOrder = copy.orderInvalid;
        if (normalizedKey === 'durationseconds') errors.durationSeconds = copy.durationInvalid;
      }
      if (statusCode === 413 || statusCode === 415) errors.image = copy.imageInvalid;
      setFieldErrors(errors);
      setError(copy.validationFailed);
    } else if (statusCode === 404) {
      setError(copy.missingPhoto);
    } else if (statusCode === 401 || statusCode === 403) {
      setError(copy.accessDenied);
    } else {
      setError(copy[fallback]);
    }
  }

  /** Validates local inputs, saves multipart data, then refreshes before announcing success. */
  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (disabled) return;
    setStatus('');
    setError('');
    const errors: FieldErrors = {};
    const orderText = normalizeDigits(sortOrder).trim();
    const durationText = normalizeDigits(duration).trim();
    const orderValue = Number(orderText);
    const durationValue = Number(durationText);
    if (!/^\d+$/.test(orderText) || !Number.isSafeInteger(orderValue) || orderValue > maxSortOrder) {
      errors.sortOrder = copy.orderInvalid;
    }
    if (!/^\d+$/.test(durationText) || !Number.isSafeInteger(durationValue) || durationValue < 1 || durationValue > 120) {
      errors.durationSeconds = copy.durationInvalid;
    }
    if (!editing && !image) errors.image = copy.imageRequired;
    if (image) {
      const extension = image.name.split('.').pop()?.toLowerCase() ?? '';
      if (image.size === 0 || image.size > maxImageBytes || !imageExtensions[image.type.toLowerCase()]?.includes(extension)) {
        errors.image = copy.imageInvalid;
      }
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError(copy.formInvalid);
      return;
    }
    setBusy('saving');
    try {
      const input = { image, sortOrder: orderValue, durationSeconds: durationValue };
      if (editing) {
        await updateAdminSlideshowSlide(editing.id, input);
      } else if (image) {
        await createAdminSlideshowSlide({ ...input, image });
      }
      resetEditor();
      try {
        await refreshSlides();
        setStatus(copy.saved);
      } catch {
        setError(copy.savedRefreshFailed);
      }
    } catch (apiError) {
      handleApiError(apiError, 'saveFailed');
    } finally {
      setBusy(null);
    }
  }

  /** Uses a keyboard-accessible native confirmation before removal and refreshes persisted state. */
  async function removeSlide(slide: AdminSlideshowSlide): Promise<void> {
    if (disabled || !window.confirm(copy.confirmRemoval)) return;
    setBusy('deleting');
    setError('');
    setStatus('');
    try {
      await deleteAdminSlideshowSlide(slide.id);
      if (editing?.id === slide.id) resetEditor();
      try {
        await refreshSlides();
        setStatus(copy.removed);
      } catch {
        setError(copy.removedRefreshFailed);
      }
    } catch (apiError) {
      handleApiError(apiError, 'deleteFailed');
    } finally {
      setBusy(null);
    }
  }

  /** Reloads after a load failure or stale-record response, resetting an obsolete editor on success. */
  async function reload(): Promise<void> {
    if (isLoading || busy) return;
    try {
      await refreshSlides();
      resetEditor();
      setStatus('');
    } catch {
      // The refresh helper already exposes a localized load failure and keeps editing disabled.
    }
  }

  return (
    <AdminPanel title={copy.title} description={copy.description} className="admin-slideshow">
      {isLoading ? <AdminFeedback>{copy.loading}</AdminFeedback> : null}
      {loadError ? <AdminFeedback tone="error">{copy.loadFailed}</AdminFeedback> : null}
      {error ? <AdminFeedback tone="error">{error}</AdminFeedback> : null}
      {status ? <AdminFeedback tone="success">{status}</AdminFeedback> : null}
      {busy ? <AdminFeedback>{busy === 'saving' ? copy.saving : copy.deleting}</AdminFeedback> : null}
      <form className="admin-form" noValidate onSubmit={handleSubmit} aria-busy={busy === 'saving'}>
        <h3 ref={editorHeading} tabIndex={-1}>{editing ? copy.editTitle : copy.addTitle}</h3>
        {editing ? <img className="admin-slideshow-preview" src={editing.imageUrl} alt={copy.preview} /> : null}
        <div className="admin-form-grid">
          <label className={`admin-field ${fieldErrors.image ? 'admin-field-error' : ''}`} htmlFor="slideshow-image">
            <span>{editing ? copy.replacement : copy.image}</span>
            <input ref={fileInput} id="slideshow-image" name="image" type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled} required={!editing} aria-invalid={Boolean(fieldErrors.image)} aria-describedby="slideshow-image-help" onChange={(event) => setImage(event.target.files?.[0])} />
            <small id="slideshow-image-help" role={fieldErrors.image ? 'alert' : undefined}>{fieldErrors.image ?? (editing ? copy.replacementHelp : copy.imageHelp)}</small>
          </label>
          <AdminField id="slideshow-order" label={copy.sortOrder} help={copy.sortOrderHelp} error={fieldErrors.sortOrder} name="sortOrder" inputMode="numeric" required disabled={disabled} value={sortOrder} onChange={(event) => setSortOrder(normalizeDigits(event.target.value))} />
          <AdminField id="slideshow-duration" label={copy.duration} help={copy.durationHelp} error={fieldErrors.durationSeconds} name="durationSeconds" inputMode="numeric" required disabled={disabled} value={duration} onChange={(event) => setDuration(normalizeDigits(event.target.value))} />
        </div>
        <div className="admin-form-actions">
          {editing ? <AdminButton disabled={disabled} onClick={resetEditor} variant="secondary">{copy.cancel}</AdminButton> : null}
          <AdminButton disabled={disabled} type="submit" variant="brass">{busy === 'saving' ? copy.saving : editing ? copy.save : copy.add}</AdminButton>
        </div>
      </form>
      <div className="admin-slideshow-list">
        <div className="admin-surface-header">
          <h3>{copy.listTitle}</h3>
          <AdminButton disabled={isLoading || busy !== null} onClick={() => void reload()} variant="secondary">{copy.retry}</AdminButton>
        </div>
        {isLoaded && !isLoading ? slides.length === 0 ? (
          <AdminEmptyState icon="store" title={copy.emptyTitle} description={copy.emptyDescription} />
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th scope="col">{copy.preview}</th><th scope="col">{copy.sortOrder}</th><th scope="col">{copy.duration}</th><th scope="col">{copy.actions}</th></tr></thead>
              <tbody>{slides.map((slide) => (
                <tr key={slide.id}>
                  <td data-label={copy.preview}><img className="admin-slideshow-preview" src={slide.imageUrl} alt={copy.preview} loading="lazy" /></td>
                  <td data-label={copy.sortOrder}>{numberFormatter.format(slide.sortOrder)}</td>
                  <td data-label={copy.duration}>{numberFormatter.format(slide.durationSeconds)}</td>
                  <td data-label={copy.actions}><div className="admin-slideshow-actions"><AdminButton disabled={disabled} onClick={() => startEditing(slide)} variant="secondary">{copy.edit}</AdminButton><AdminButton disabled={disabled} onClick={() => void removeSlide(slide)} variant="danger">{copy.remove}</AdminButton></div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : null}
      </div>
    </AdminPanel>
  );
}
