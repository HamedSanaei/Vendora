'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useSelector } from 'react-redux';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import axios from 'axios';
import { getDiscussion, getMyReview, saveDiscussion, type DiscussionEntry, type DiscussionPage, type MyReview } from '@/lib/product-discussions';
import { withLocalePath } from '@/lib/locale-path';
import { formatNumber } from '@/lib/vendora/format';
import type { Locale } from '@/lib/vendora/types';
import { discussionCopy } from './discussion-copy';

/** Reuses one authenticated composer and pagination surface for reviews, questions and direct answers. */
export function ProductDiscussion({ productId, locale, kind, onChanged, questionId }: {
  productId: string; locale: Locale; kind: 'review' | 'question' | 'answer'; questionId?: string; onChanged: () => void;
}) {
  const t = discussionCopy(locale);
  const token = useSelector((state: { auth: { accessToken?: string } }) => state.auth.accessToken);
  const pathname = usePathname();
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<DiscussionPage | null>(null);
  const [mineState, setMine] = useState<{ token: string; data: MyReview } | null>(null);
  const mine = mineState && mineState.token === token ? mineState.data : null;
  const [failed, setFailed] = useState(false);
  const [mineFailed, setMineFailed] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setResult(null); setFailed(false);
    getDiscussion(productId, kind, page, questionId, controller.signal).then(setResult).catch(error => { if (!axios.isCancel(error)) setFailed(true); });
    return () => controller.abort();
  }, [productId, kind, page, questionId, version]);

  useEffect(() => {
    setMineFailed(false);
    if (!token || kind !== 'review') return;
    const controller = new AbortController();
    getMyReview(productId, token, controller.signal).then(data => setMine({ token, data })).catch(error => { if (!axios.isCancel(error)) setMineFailed(true); });
    return () => controller.abort();
  }, [token, productId, kind, version]);

  /** Refreshes authoritative lists and the server-rendered product summary after a successful write. */
  function saved() { setPage(1); setVersion(v => v + 1); onChanged(); }

  return <div className="vd-discussion">
    <h2>{kind === 'answer' ? t.answers : kind === 'question' ? t.questions : t.reviews}</h2>
    {!token ? <div className="vd-discussion__notice"><p>{t.login}</p><Link className="vd-focus vd-discussion__button" href={`${withLocalePath('/login', locale)}?returnTo=${encodeURIComponent(pathname)}`}>{t.loginButton}</Link></div>
      : kind === 'review' && !mine ? <div role="status">{mineFailed ? <><p>{t.error}</p><button className="vd-focus vd-discussion__button" onClick={() => setVersion(v => v + 1)}>{t.retry}</button></> : t.loading}</div>
      : <DiscussionComposer key={`${productId}-${questionId ?? ''}-${token}`} productId={productId} locale={locale} kind={kind} token={token} questionId={questionId} mine={mine} onSaved={saved} />}
    {failed ? <div role="alert"><p>{t.error}</p><button className="vd-focus vd-discussion__button" onClick={() => setVersion(v => v + 1)}>{t.retry}</button></div>
      : !result ? <p role="status">{t.loading}</p> : result.items.length === 0 ? <p className="vd-discussion__notice">{t.empty}</p>
      : <><div className="vd-discussion__list">{result.items.map(entry => <DiscussionItem key={entry.id} entry={entry} locale={locale} onChanged={onChanged} />)}</div>
        {result.total > result.pageSize && <nav className="vd-discussion__pagination" aria-label={kind === 'review' ? t.reviews : t.questions}>
          <button className="vd-focus vd-discussion__button" disabled={result.pageNumber <= 1} onClick={() => setPage(result.pageNumber - 1)}>{t.prev}</button>
          <span>{formatNumber(result.pageNumber, locale)} / {formatNumber(Math.max(1, Math.ceil(result.total / result.pageSize)), locale)}</span>
          <button className="vd-focus vd-discussion__button" disabled={result.pageNumber * result.pageSize >= result.total} onClick={() => setPage(result.pageNumber + 1)}>{t.next}</button>
        </nav>}</>}
  </div>;
}

/** A plain-text entry with only server-issued buyer/store badges; hidden content is never returned publicly. */
function DiscussionItem({ entry, locale, onChanged }: { entry: DiscussionEntry; locale: Locale; onChanged: () => void }) {
  const t = discussionCopy(locale);
  const [expanded, setExpanded] = useState(false);
  return <article className="vd-discussion__entry">
    <header><strong>{entry.authorName}</strong>{entry.isBuyer && <span className="vd-discussion__badge">{t.buyer}</span>}{entry.isOfficial && <span className="vd-discussion__badge">{t.official}</span>}
      <time dateTime={entry.createdAtUtc}>{new Intl.DateTimeFormat(locale === 'fa' ? 'fa-IR' : 'en-US').format(new Date(entry.createdAtUtc))}</time></header>
    {entry.rating !== null && <p className="vd-discussion__stars" aria-label={`${formatNumber(entry.rating, locale)} ${t.outOf}`}>{'★'.repeat(entry.rating)}{'☆'.repeat(5 - entry.rating)}</p>}
    <p className="vd-discussion__text">{entry.content}</p>
    {entry.kind === 'question' && <><button className="vd-focus vd-discussion__button" aria-expanded={expanded} onClick={() => setExpanded(v => !v)}>{expanded ? t.close : t.reply}</button>
      {expanded && <ProductDiscussion productId={entry.productId} questionId={entry.id} locale={locale} kind="answer" onChanged={onChanged} />}</>}
  </article>;
}

/** Keeps drafts on failures, with a keyboard-accessible radio group for an eligible buyer's optional rating. */
function DiscussionComposer({ productId, locale, kind, token, questionId, mine, onSaved }: {
  productId: string; locale: Locale; kind: 'review' | 'question' | 'answer'; token: string; questionId?: string; mine: MyReview | null; onSaved: () => void;
}) {
  const t = discussionCopy(locale);
  const [content, setContent] = useState(mine?.review?.content ?? '');
  const [rating, setRating] = useState<number | null>(mine?.review?.rating ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  /** Submits a bounded draft, preserving it on errors and clearing only new questions/answers on success. */
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setSuccess(false);
    if (!content.trim()) { setError(t.required); return; }
    setBusy(true);
    try {
      await saveDiscussion(productId, token, kind, content, kind === 'review' && mine?.canRate ? rating : null, questionId);
      if (kind !== 'review') setContent('');
      setSuccess(true); onSaved();
    } catch (cause) {
      const status = axios.isAxiosError(cause) ? cause.response?.status : undefined;
      setError(status === 429 ? t.limited : status === 401 ? t.unauthorized : status === 403 ? t.forbidden : t.failed);
    } finally { setBusy(false); }
  }
  return <form className="vd-discussion__form" onSubmit={submit}>
    <fieldset disabled={busy}>
      <label>{t[kind]}<textarea required maxLength={kind === 'question' ? 2000 : 3000} value={content} onChange={e => setContent(e.target.value)} rows={4} /></label>
      {kind === 'review' && <><fieldset disabled={!mine?.canRate} className="vd-discussion__rating"><legend>{t.stars}</legend>
        {[1, 2, 3, 4, 5].map(value => <label key={value}><input type="radio" name="product-rating" value={value} checked={rating === value} onChange={() => setRating(value)} aria-label={`${formatNumber(value, locale)} ${t.outOf}`} /><span aria-hidden="true">{value <= (rating ?? 0) ? '★' : '☆'}</span></label>)}
        <button type="button" className="vd-focus vd-discussion__button" onClick={() => setRating(null)}>{t.noRating}</button></fieldset>
        {!mine?.canRate && <p className="vd-discussion__help">{t.buyerOnly}</p>}{mine?.review?.isHidden && <p role="status">{t.hidden}</p>}</>}
      <button className="vd-focus vd-discussion__button vd-discussion__button--primary" type="submit">{busy ? t.sending : mine?.review && kind === 'review' ? t.save : t.send}</button>
    </fieldset>
    {error && <p role="alert">{error}</p>}{success && <p role="status">{t.saved}</p>}
  </form>;
}
