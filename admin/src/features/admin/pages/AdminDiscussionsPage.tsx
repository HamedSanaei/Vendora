import { useEffect, useState, type FormEvent } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { AdminButton, AdminFeedback, AdminPageHeader, AdminPanel } from '../components/AdminUi';
import { normalizeAdminLocale } from '../i18n';
import { discussionAdminCopy } from '../discussionCopy';
import { getDiscussions, moderateDiscussion, answerDiscussion, type AdminDiscussionPage, type AdminDiscussion } from '../api/discussionApi';
import { getAdminProducts } from '../api/adminApi';
import type { AdminProduct } from '../types';

/** Responsive moderation with URL-backed filters, real product choices and preserved failed answer drafts. */
export function AdminDiscussionsPage() {
  const locale = normalizeAdminLocale(useParams().locale);
  const t = discussionAdminCopy(locale);
  const [params, setParams] = useSearchParams();
  const kind = ['review','question','answer'].includes(params.get('kind') ?? '') ? params.get('kind')! : 'review';
  const productId = params.get('productId') || undefined;
  const hidden = ['true','false'].includes(params.get('hidden') ?? '') ? params.get('hidden')! : undefined;
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [loaded, setLoaded] = useState<{ key: string; data: AdminDiscussionPage } | null>(null);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  const requestKey = JSON.stringify([kind, productId, hidden, page, version]);
  const rows = loaded?.key === requestKey ? loaded.data : null;
  const [reply, setReply] = useState<AdminDiscussion | null>(null);
  const [text, setText] = useState('');
  useEffect(() => { let active = true; getAdminProducts().then(value => { if (active) setProducts(value); }).catch(() => { if (active) setError(t.error); }); return () => { active = false; }; }, [t.error]);
  useEffect(() => {
    const controller = new AbortController();
    getDiscussions({kind, productId, hidden, page}, controller.signal).then(data => { setLoaded({key: requestKey, data}); setError(''); }).catch(cause => { if (!axios.isCancel(cause)) setError(t.error); });
    return () => controller.abort();
  }, [kind, productId, hidden, page, requestKey, t.error]);

  /** Updates one filter and resets the page when the dataset changes. */
  function filter(key: string, value: string) { const next = new URLSearchParams(params); if (value) next.set(key,value); else next.delete(key); if (key !== 'page') next.delete('page'); setParams(next); }
  /** Applies confirmed server changes without optimistic hiding or fake successful answers. */
  async function act(entry: AdminDiscussion, answer = false) {
    setBusy(true); setError('');
    try { if (answer) { await answerDiscussion(entry,text); setReply(null); setText(''); } else await moderateDiscussion(entry); toast.success(t.saved); setVersion(v => v + 1); }
    catch (cause) { setError(axios.isAxiosError(cause) && cause.response?.status === 429 ? t.limited : t.error); }
    finally { setBusy(false); }
  }
  /** Submits an official answer after native form validation. */
  function submit(event: FormEvent) { event.preventDefault(); if (reply && text.trim()) void act(reply,true); }
  return <section>
    <AdminPageHeader title={t.title} description={t.description} />
    <AdminPanel title={t.title}>
      <div className="admin-form-grid">
        <label>{t.kind}<select value={kind} onChange={e => filter('kind',e.target.value)}>{(['review','question','answer'] as const).map(k => <option key={k} value={k}>{t[k]}</option>)}</select></label>
        <label>{t.product}<select value={productId ?? ''} onChange={e => filter('productId',e.target.value)}><option value="">{t.allProducts}</option>{products.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
        <label>{t.visibility}<select value={hidden ?? ''} onChange={e => filter('hidden',e.target.value)}><option value="">{t.all}</option><option value="false">{t.visible}</option><option value="true">{t.hidden}</option></select></label>
      </div>
      {error && <AdminFeedback tone="error">{error}<AdminButton onClick={() => setVersion(v => v + 1)}>{t.retry}</AdminButton></AdminFeedback>}
      {!rows && !error ? <p role="status">{t.loading}</p> : rows?.items.length === 0 ? <p>{t.empty}</p> : null}
      <div className="admin-discussions">{rows?.items.map(entry => <article key={entry.id} className="admin-discussion-entry">
        <header><strong>{entry.productTitle}</strong><span>{entry.authorName}</span><span>{entry.isHidden ? t.hidden : t.visible}</span>{entry.isBuyer && <span>{t.buyer}</span>}{entry.isOfficial && <span>{t.official}</span>}<time dateTime={entry.createdAtUtc}>{new Intl.DateTimeFormat(locale === 'fa' ? 'fa-IR' : 'en-US').format(new Date(entry.createdAtUtc))}</time></header>
        {entry.rating !== null && <p aria-label={`${entry.rating}/5`}>{'★'.repeat(entry.rating)}{'☆'.repeat(5-entry.rating)}</p>}
        <p className="admin-discussion-text">{entry.content}</p>
        {entry.questionId && <small>{t.parent}: {entry.questionId}</small>}
        <div className="admin-discussion-actions"><AdminButton disabled={busy} variant="secondary" onClick={() => void act(entry)}>{entry.isHidden ? t.restore : t.hide}</AdminButton>
          {entry.kind === 'question' && !entry.isHidden && <AdminButton disabled={busy} onClick={() => { setReply(entry); setText(''); }}>{t.reply}</AdminButton>}</div>
      </article>)}</div>
      {rows && rows.total > rows.pageSize && <div className="admin-discussion-actions"><AdminButton disabled={rows.pageNumber <= 1} onClick={() => filter('page',String(rows.pageNumber-1))}>{t.prev}</AdminButton><span>{rows.pageNumber} / {Math.ceil(rows.total/rows.pageSize)}</span><AdminButton disabled={rows.pageNumber*rows.pageSize>=rows.total} onClick={() => filter('page',String(rows.pageNumber+1))}>{t.next}</AdminButton></div>}
    </AdminPanel>
    {reply && <AdminPanel title={`${t.reply} · ${reply.productTitle}`}><p className="admin-discussion-text">{reply.content}</p><form className="admin-form" onSubmit={submit}><label>{t.reply}<textarea required maxLength={3000} rows={5} value={text} disabled={busy} onChange={e => setText(e.target.value)} /></label><AdminButton type="submit" disabled={busy}>{busy ? t.working : t.send}</AdminButton></form></AdminPanel>}
  </section>;
}
