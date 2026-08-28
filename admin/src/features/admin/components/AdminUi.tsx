import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { Link } from 'react-router-dom';
import type { AdminLocale } from '../i18n';
import { AdminIcon, type AdminIconName } from './AdminIcon';

type AdminButtonVariant = 'primary' | 'brass' | 'secondary' | 'danger' | 'ghost';

interface AdminButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  icon?: AdminIconName;
  to?: string;
  external?: boolean;
  variant?: AdminButtonVariant;
}

/** Renders the shared Penpot action family as a button or navigation link. */
export function AdminButton({
  children,
  className = '',
  external = false,
  icon,
  to,
  type = 'button',
  variant = 'primary',
  ...buttonProps
}: AdminButtonProps) {
  const classes = `admin-action admin-action-${variant} ${className}`.trim();
  const content = <>{icon ? <AdminIcon name={icon} size={18} /> : null}<span>{children}</span></>;

  if (to) {
    if (external) {
      return <a className={classes} href={to} rel="noreferrer" target="_blank">{content}</a>;
    }

    return <Link className={classes} to={to}>{content}</Link>;
  }

  return <button className={classes} type={type} {...buttonProps}>{content}</button>;
}

interface AdminPageHeaderProps {
  actions?: ReactNode;
  description?: string;
  eyebrow?: string;
  title: string;
}

/** Renders the reusable title, context, and actions row used by every admin route. */
export function AdminPageHeader({ actions, description, eyebrow, title }: AdminPageHeaderProps) {
  return (
    <header className="admin-page-heading">
      <div className="admin-page-heading-copy">
        {eyebrow ? <span className="admin-eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="admin-page-heading-actions">{actions}</div> : null}
    </header>
  );
}

interface AdminPanelProps {
  children: ReactNode;
  className?: string;
  description?: string;
  title?: string;
  toolbar?: ReactNode;
}

/** Provides the shared bordered admin surface and optional panel heading. */
export function AdminPanel({ children, className = '', description, title, toolbar }: AdminPanelProps) {
  return (
    <section className={`admin-surface ${className}`.trim()}>
      {title || toolbar ? (
        <div className="admin-surface-header">
          <div>
            {title ? <h2>{title}</h2> : null}
            {description ? <p>{description}</p> : null}
          </div>
          {toolbar ? <div className="admin-surface-toolbar">{toolbar}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

interface AdminFilterBarProps {
  children?: ReactNode;
  onSearchChange: (value: string) => void;
  searchLabel: string;
  searchValue: string;
}

/** Keeps search and list filters visually consistent and keyboard labelled. */
export function AdminFilterBar({ children, onSearchChange, searchLabel, searchValue }: AdminFilterBarProps) {
  return (
    <div className="admin-filter-bar">
      <label className="admin-filter-search">
        <AdminIcon name="search" size={18} />
        <span className="sr-only">{searchLabel}</span>
        <input
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={searchLabel}
          type="search"
          value={searchValue}
        />
      </label>
      {children ? <div className="admin-filter-controls">{children}</div> : null}
    </div>
  );
}

interface AdminPaginationProps {
  currentPage: number;
  label: string;
  locale?: AdminLocale;
  onPageChange: (page: number) => void;
  totalPages: number;
}

/** Renders compact, RTL-safe client-side pagination. */
export function AdminPagination({ currentPage, label, locale = 'fa', onPageChange, totalPages }: AdminPaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const pages = Array.from({ length: totalPages }, (_, index) => index + 1)
    .filter((page) => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1);

  return (
    <nav aria-label={label} className="admin-pagination-modern">
      <button disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)} type="button">
        <AdminIcon className="admin-icon-back" name="chevron" size={17} />
      </button>
      {pages.map((page, index) => (
        <span className="admin-pagination-slot" key={page}>
          {index > 0 && page - pages[index - 1] > 1 ? <span className="admin-pagination-ellipsis">…</span> : null}
          <button
            aria-current={page === currentPage ? 'page' : undefined}
            className={page === currentPage ? 'is-active' : ''}
            onClick={() => onPageChange(page)}
            type="button"
          >
            {page.toLocaleString(locale === 'fa' ? 'fa-IR' : 'en-US')}
          </button>
        </span>
      ))}
      <button disabled={currentPage === totalPages} onClick={() => onPageChange(currentPage + 1)} type="button">
        <AdminIcon name="chevron" size={17} />
      </button>
    </nav>
  );
}

interface AdminEmptyStateProps {
  action?: ReactNode;
  description: string;
  icon?: AdminIconName;
  title: string;
}

/** Displays an intentional empty-state rather than a blank table or card grid. */
export function AdminEmptyState({ action, description, icon = 'package', title }: AdminEmptyStateProps) {
  return (
    <div className="admin-empty-state">
      <span className="admin-empty-state-icon"><AdminIcon name={icon} size={28} /></span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

interface AdminFeedbackProps {
  children: ReactNode;
  tone?: 'error' | 'info' | 'success' | 'warning';
}

/** Renders localized inline feedback with an icon and non-color cue. */
export function AdminFeedback({ children, tone = 'info' }: AdminFeedbackProps) {
  return <div className={`admin-feedback admin-feedback-${tone}`} role={tone === 'error' ? 'alert' : 'status'}><AdminIcon name="alert" size={19} /><span>{children}</span></div>;
}

interface AdminConfirmDialogProps {
  cancelLabel: string;
  confirmLabel: string;
  description: string;
  isOpen: boolean;
  isPending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
}

/** Provides the shared accessible confirmation surface for high-impact admin actions. */
export function AdminConfirmDialog({
  cancelLabel,
  confirmLabel,
  description,
  isOpen,
  isPending = false,
  onCancel,
  onConfirm,
  title,
}: AdminConfirmDialogProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="admin-dialog-backdrop" onMouseDown={onCancel} role="presentation">
      <div
        aria-describedby="admin-confirm-description"
        aria-labelledby="admin-confirm-title"
        aria-modal="true"
        className="admin-dialog"
        onMouseDown={(event) => event.stopPropagation()}
        role="alertdialog"
      >
        <span className="admin-dialog-icon"><AdminIcon name="alert" size={24} /></span>
        <h2 id="admin-confirm-title">{title}</h2>
        <p id="admin-confirm-description">{description}</p>
        <div className="admin-dialog-actions">
          <AdminButton disabled={isPending} onClick={onCancel} variant="secondary">{cancelLabel}</AdminButton>
          <AdminButton disabled={isPending} onClick={onConfirm} variant="danger">{confirmLabel}</AdminButton>
        </div>
      </div>
    </div>
  );
}

interface AdminFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  help?: string;
  label: string;
}

/** Renders the compact Penpot text-field contract with helper and error states. */
export function AdminField({ error, help, id, label, ...inputProps }: AdminFieldProps) {
  const inputId = id ?? `admin-field-${inputProps.name ?? label}`;
  return (
    <label className={`admin-field ${error ? 'admin-field-error' : ''}`} htmlFor={inputId}>
      <span>{label}</span>
      <input aria-invalid={Boolean(error)} id={inputId} {...inputProps} />
      {error ? <small role="alert">{error}</small> : help ? <small>{help}</small> : null}
    </label>
  );
}

interface AdminSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  children: ReactNode;
  error?: string;
  help?: string;
  label: string;
}

/** Renders a labelled reusable select with the same validation contract as text fields. */
export function AdminSelect({ children, error, help, id, label, ...selectProps }: AdminSelectProps) {
  const inputId = id ?? `admin-select-${selectProps.name ?? label}`;
  return (
    <label className={`admin-field ${error ? 'admin-field-error' : ''}`} htmlFor={inputId}>
      <span>{label}</span>
      <select aria-invalid={Boolean(error)} id={inputId} {...selectProps}>{children}</select>
      {error ? <small role="alert">{error}</small> : help ? <small>{help}</small> : null}
    </label>
  );
}

interface AdminTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
  help?: string;
  label: string;
}

/** Renders a reusable multiline field with helper and validation states. */
export function AdminTextarea({ error, help, id, label, ...textareaProps }: AdminTextareaProps) {
  const inputId = id ?? `admin-textarea-${textareaProps.name ?? label}`;
  return (
    <label className={`admin-field ${error ? 'admin-field-error' : ''}`} htmlFor={inputId}>
      <span>{label}</span>
      <textarea aria-invalid={Boolean(error)} id={inputId} {...textareaProps} />
      {error ? <small role="alert">{error}</small> : help ? <small>{help}</small> : null}
    </label>
  );
}

interface AdminChoiceProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
}

/** Renders a direction-safe checkbox with a 44px interaction target. */
export function AdminCheckbox({ label, ...inputProps }: AdminChoiceProps) {
  return <label className="admin-choice"><input type="checkbox" {...inputProps} /><span>{label}</span></label>;
}

/** Renders a direction-safe radio option with a 44px interaction target. */
export function AdminRadio({ label, ...inputProps }: AdminChoiceProps) {
  return <label className="admin-choice"><input type="radio" {...inputProps} /><span>{label}</span></label>;
}

interface AdminChipProps {
  children: ReactNode;
  tone?: 'neutral' | 'brass' | 'success';
}

/** Displays compact categories, colors, and non-status metadata. */
export function AdminChip({ children, tone = 'neutral' }: AdminChipProps) {
  return <span className={`admin-chip admin-chip-${tone}`}>{children}</span>;
}

interface AdminPermissionBannerProps {
  children: ReactNode;
  title: string;
}

/** Communicates permission or service limitations without presenting false success actions. */
export function AdminPermissionBanner({ children, title }: AdminPermissionBannerProps) {
  return <aside className="admin-permission-banner"><AdminIcon name="alert" size={20} /><div><strong>{title}</strong><p>{children}</p></div></aside>;
}

interface AdminBulkSelectionBarProps {
  children?: ReactNode;
  clearLabel: string;
  count: number;
  countLabel: string;
  locale?: AdminLocale;
  onClear: () => void;
}

/** Renders a stable selection summary and safe batch actions above data tables. */
export function AdminBulkSelectionBar({ children, clearLabel, count, countLabel, locale = 'fa', onClear }: AdminBulkSelectionBarProps) {
  if (count === 0) return null;
  return (
    <div className="admin-bulk-bar" role="status">
      <strong>{count.toLocaleString(locale === 'fa' ? 'fa-IR' : 'en-US')} {countLabel}</strong>
      <div>{children}<AdminButton onClick={onClear} variant="ghost">{clearLabel}</AdminButton></div>
    </div>
  );
}

interface AdminActionMenuProps {
  children: ReactNode;
  label: string;
}

/** Groups secondary row actions inside an accessible dependency-free menu surface. */
export function AdminActionMenu({ children, label }: AdminActionMenuProps) {
  return (
    <details className="admin-action-menu">
      <summary aria-label={label}><AdminIcon name="menu" size={18} /></summary>
      <div className="admin-action-menu-popover">{children}</div>
    </details>
  );
}
