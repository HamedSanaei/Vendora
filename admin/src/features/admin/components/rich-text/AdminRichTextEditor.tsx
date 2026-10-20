import { useEffect, useId, useRef, useState } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyleKit } from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';
import type { AdminLocale } from '../../i18n';
import { AdminButton } from '../AdminUi';
import { getEditorCopy } from './editor-copy';
import { ArticleImage, articleLimit, editorContent, isArticleLink } from './editor-content';
import { EditorToolbar } from './EditorToolbar';
import './editor.css';

interface AdminRichTextEditorProps {
  locale: AdminLocale;
  value: string;
  disabled?: boolean;
  onChange: (html: string) => void;
  onBusyChange: (busy: boolean) => void;
  uploadImage: (file: File) => Promise<string>;
}

/** Reusable controlled product article editor; uploads through the caller's authenticated API adapter. */
export default function AdminRichTextEditor({ locale, value, disabled = false, onChange, onBusyChange, uploadImage }: AdminRichTextEditorProps) {
  const t = getEditorCopy(locale);
  const id = useId();
  const [panel, setPanel] = useState<'image' | 'link' | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState('');
  const [url, setUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [editingImage, setEditingImage] = useState(false);
  const insertPosition = useRef(0);
  const alive = useRef(true);
  const panelRef = useRef<HTMLDivElement>(null);
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [2, 3, 4] }, code: false, codeBlock: false,
      link: { openOnClick: false, autolink: true, isAllowedUri: (uri) => isArticleLink(uri) } }),
    TextStyleKit, TextAlign.configure({ types: ['heading', 'paragraph'] }), ArticleImage.configure({ allowBase64: false })],
    content: editorContent(value),
    editorProps: { attributes: { role: 'textbox', 'aria-multiline': 'true', 'aria-labelledby': `${id}-label`,
      'aria-describedby': `${id}-help`, class: 'article-document', dir: locale === 'fa' ? 'rtl' : 'ltr' },
      // Pasted remote/base64 images are discarded by ArticleImage; users upload owned images explicitly.
      handleDrop: (_view, event) => Boolean(event.dataTransfer?.files.length),
      handlePaste: (_view, event) => Boolean(event.clipboardData?.files.length),
    },
    onUpdate: ({ editor: current }) => onChange(current.isEmpty ? '' : current.getHTML()),
  });
  const stats = useEditorState({ editor, selector: ({ editor: current }) => {
    if (!current || current.isDestroyed || !current.schema) return { characters: 0, length: 0 };
    return { characters: current.getText().length, length: current.getHTML().length };
  } });

  useEffect(() => {
    // Route changes dispose the engine before pending React effects can finish.
    if (!editor || editor.isDestroyed || !editor.schema) return;
    if (value !== editor.getHTML() && !(value === '' && editor.isEmpty))
      editor.commands.setContent(editorContent(value), { emitUpdate: false });
  }, [editor, value]);
  useEffect(() => { if (editor && !editor.isDestroyed) editor.setEditable(!disabled && !uploading); }, [disabled, editor, uploading]);
  useEffect(() => { onBusyChange(uploading); }, [onBusyChange, uploading]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { if (panel) panelRef.current?.querySelector<HTMLInputElement>('input')?.focus(); }, [panel]);

  /** Opens an inline panel without losing the text selection or selected image. */
  function openPanel(kind: 'image' | 'link') {
    if (!editor) return;
    insertPosition.current = editor.state.selection.from;
    setError(''); setFile(null);
    setEditingImage(kind === 'image' && editor.isActive('image'));
    setAlt(String(editor.getAttributes('image').alt ?? ''));
    setUrl(String(editor.getAttributes('link').href ?? ''));
    setPanel(kind);
  }

  /** Validates a link and applies it to the preserved selection. */
  function applyLink() {
    if (!editor || !isArticleLink(url.trim())) { setError(t.invalidUrl); return; }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
    setPanel(null);
  }

  /** Uploads an image once, then inserts its portable URL; failed requests preserve the article for retry. */
  async function applyImage() {
    if (!editor || !alt.trim()) { setError(t.requiredAlt); return; }
    if (editingImage) {
      editor.chain().focus().updateAttributes('image', { alt: alt.trim() }).run();
      setPanel(null); return;
    }
    if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size <= 0 || file.size > 5 * 1024 * 1024) {
      setError(t.invalidImage); return;
    }
    setError(''); setUploading(true);
    try {
      const src = await uploadImage(file);
      if (!alive.current || editor.isDestroyed) return;
      editor.chain().focus().insertContentAt(insertPosition.current, [
        { type: 'image', attrs: { src, alt: alt.trim() } }, { type: 'paragraph' },
      ]).run();
      setPanel(null); setFile(null);
    } catch { if (alive.current) setError(t.uploadError); }
    finally { if (alive.current) setUploading(false); }
  }

  return <section className="article-editor admin-form-full" dir={locale === 'fa' ? 'rtl' : 'ltr'} aria-busy={uploading}>
    <div><strong id={`${id}-label`}>{t.label}</strong><p id={`${id}-help`} className="article-help">{t.help}</p></div>
    <div className="article-frame">
      {editor ? <EditorToolbar editor={editor} copy={t} disabled={disabled || uploading}
        onImage={() => openPanel('image')} onLink={() => openPanel('link')} /> : null}
      {panel ? <div className="article-insert-panel" ref={panelRef} role="group" aria-label={panel === 'image' ? t.image : t.link}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !uploading) { event.preventDefault(); setPanel(null); editor?.commands.focus(); }
          // Enter applies this inline panel, never submits the enclosing product form.
          if (event.key === 'Enter' && event.target instanceof HTMLInputElement && event.target.type !== 'file') {
            event.preventDefault();
            if (!uploading && !disabled) { if (panel === 'image') void applyImage(); else applyLink(); }
          }
        }}>
        {panel === 'image' ? <>
          <p className="article-help">{t.imageHelp}</p>
          {!editingImage ? <label>{t.file}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled || uploading}
            onChange={(event) => { setFile(event.target.files?.[0] ?? null); setError(''); }} /></label> : null}
          <label>{t.alt}<input type="text" maxLength={300} value={alt} disabled={disabled || uploading} onChange={(event) => setAlt(event.target.value)} /></label>
        </> : <label>{t.url}<input type="url" dir="ltr" placeholder="https://" disabled={disabled} value={url} onChange={(event) => setUrl(event.target.value)} /></label>}
        {error ? <p className="article-error" role="alert">{error}</p> : null}
        <div className="article-panel-actions"><AdminButton variant="brass" disabled={disabled || uploading}
          onClick={() => { if (panel === 'image') void applyImage(); else applyLink(); }}>{uploading ? t.uploading : panel === 'link' || editingImage ? t.apply : t.insert}</AdminButton>
          <AdminButton variant="secondary" disabled={uploading} onClick={() => { setPanel(null); editor?.commands.focus(); }}>{t.cancel}</AdminButton></div>
      </div> : null}
      <EditorContent editor={editor} />
      <div className="article-footer" aria-live="polite"><span>{uploading ? t.uploading : t.savedWithProduct}</span>
        <span>{(stats?.characters ?? 0).toLocaleString(locale === 'fa' ? 'fa-IR' : 'en-US')} {t.characters}</span></div>
    </div>
    {(stats?.length ?? 0) > articleLimit ? <p className="article-error" role="alert">{t.limit}</p> : null}
  </section>;
}
