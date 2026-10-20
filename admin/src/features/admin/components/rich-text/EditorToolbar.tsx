import type { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import type { ReactNode } from 'react';
import type { getEditorCopy } from './editor-copy';

type Copy = ReturnType<typeof getEditorCopy>;
interface EditorToolbarProps {
  editor: Editor;
  copy: Copy;
  disabled: boolean;
  onImage: () => void;
  onLink: () => void;
}

/** Selection-aware, wrapping toolbar; controls preserve the editor selection and never submit the product form. */
export function EditorToolbar({ editor, copy: t, disabled, onImage, onLink }: EditorToolbarProps) {
  const selection = useEditorState({ editor, selector: ({ editor: current }) => {
    if (current.isDestroyed || !current.schema) return null;
    return {
    heading: [2, 3, 4].find((level) => current.isActive('heading', { level })) ?? 0,
    font: String(current.getAttributes('textStyle').fontFamily ?? ''),
    size: String(current.getAttributes('textStyle').fontSize ?? ''),
    bold: current.isActive('bold'), italic: current.isActive('italic'), underline: current.isActive('underline'),
    strike: current.isActive('strike'), bullet: current.isActive('bulletList'), ordered: current.isActive('orderedList'),
    quote: current.isActive('blockquote'), link: current.isActive('link'), image: current.isActive('image'),
    left: current.isActive({ textAlign: 'left' }), right: current.isActive({ textAlign: 'right' }),
    center: current.isActive({ textAlign: 'center' }), justify: current.isActive({ textAlign: 'justify' }),
    undo: current.can().undo(), redo: current.can().redo(),
    };
  } });
  if (!selection) return null;

  /** Produces an accessible pressed-state formatting control with a minimum touch target. */
  function button(label: string, content: ReactNode, action: () => void, active = false, unavailable = false) {
    return <button type="button" className="article-tool" title={label} aria-label={label} aria-pressed={active}
      disabled={disabled || unavailable} onMouseDown={(event) => event.preventDefault()} onClick={action}>{content}</button>;
  }

  return <div className="article-toolbar" role="group" aria-label={t.label}>
    <select aria-label={t.heading} disabled={disabled} value={selection.heading} onChange={(event) => {
      const level = Number(event.target.value);
      if (level === 0) editor.chain().focus().setParagraph().run();
      else editor.chain().focus().setHeading({ level: level as 2 | 3 | 4 }).run();
    }}><option value={0}>{t.paragraph}</option>{[2, 3, 4].map((level) => <option key={level} value={level}>{t.heading} {level - 1}</option>)}</select>
    <select aria-label={t.font} disabled={disabled} value={selection.font} onChange={(event) => {
      if (event.target.value) editor.chain().focus().setFontFamily(event.target.value).run();
      else editor.chain().focus().unsetFontFamily().run();
    }}><option value="">{t.font}</option>{['Vazirmatn', 'Tahoma', 'Arial'].map((font) => <option key={font}>{font}</option>)}</select>
    <select aria-label={t.size} disabled={disabled} value={selection.size} onChange={(event) => {
      if (event.target.value) editor.chain().focus().setFontSize(event.target.value).run();
      else editor.chain().focus().unsetFontSize().run();
    }}><option value="">{t.size}</option>{[14, 16, 18, 20, 24, 28, 32].map((size) => <option key={size} value={`${size}px`}>{size}</option>)}</select>
    {button(t.bold, <b>B</b>, () => editor.chain().focus().toggleBold().run(), selection.bold)}
    {button(t.italic, <i>I</i>, () => editor.chain().focus().toggleItalic().run(), selection.italic)}
    {button(t.underline, <u>U</u>, () => editor.chain().focus().toggleUnderline().run(), selection.underline)}
    {button(t.strike, <s>S</s>, () => editor.chain().focus().toggleStrike().run(), selection.strike)}
    {button(t.bullet, '• ≡', () => editor.chain().focus().toggleBulletList().run(), selection.bullet)}
    {button(t.ordered, '1. ≡', () => editor.chain().focus().toggleOrderedList().run(), selection.ordered)}
    {button(t.quote, '❝', () => editor.chain().focus().toggleBlockquote().run(), selection.quote)}
    {(['right', 'center', 'left', 'justify'] as const).map((alignment) => <span key={alignment}>{button(t[alignment],
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M3 5h18M3 13h18" />
        <path d={alignment === 'right' ? 'M9 9h12M9 17h12' : alignment === 'left' ? 'M3 9h12M3 17h12' : alignment === 'center' ? 'M6 9h12M6 17h12' : 'M3 9h18M3 17h18'} />
      </svg>, () => editor.chain().focus().setTextAlign(alignment).run(), selection[alignment])}</span>)}
    <label className="article-color" title={t.color}><span className="sr-only">{t.color}</span>
      <input type="color" aria-label={t.color} defaultValue="#171b1f" disabled={disabled} onChange={(event) => editor.chain().focus().setColor(event.target.value).run()} /></label>
    {button(t.link, '↗', onLink, selection.link)}
    {button(t.unlink, '↛', () => editor.chain().focus().unsetLink().run(), false, !selection.link)}
    {button(selection.image ? t.imageEdit : t.image, <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.5"/><path d="m21 16-6-6L3 21"/></svg><span>{selection.image ? t.imageEdit : t.image}</span></>, onImage)}
    {selection.image ? button(t.imageRemove, '×', () => editor.chain().focus().deleteSelection().run()) : null}
    {button(t.clear, 'Tx', () => editor.chain().focus().unsetAllMarks().clearNodes().run())}
    {button(t.undo, '↶', () => editor.chain().focus().undo().run(), false, !selection.undo)}
    {button(t.redo, '↷', () => editor.chain().focus().redo().run(), false, !selection.redo)}
  </div>;
}
