import { useEffect, useRef } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TableKit } from '@tiptap/extension-table';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Placeholder } from '@tiptap/extensions';
import { Markdown } from 'tiptap-markdown';
import {
  CheckSquare, Code, Link45deg, ListOl, ListUl, Quote, Table, TypeBold, TypeH2, TypeH3, TypeItalic, TypeStrikethrough,
} from 'react-bootstrap-icons';

interface Props {
  /** Markdown. */
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  minHeight?: number;
  autoFocus?: boolean;
  id?: string;
}

/**
 * Editor de texto enriquecido (negrita, títulos, listas, checklists, tablas, enlaces, código…).
 * Por dentro guarda MARKDOWN: lo mismo que ya tienen las tareas importadas de ClickUp, así todo convive.
 */
export function EditorTexto({ value, onChange, placeholder, minHeight = 260, autoFocus, id }: Props) {
  const ultimo = useRef(value);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false, autolink: true }, heading: { levels: [1, 2, 3] } }),
      TableKit.configure({ table: { resizable: false } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: placeholder ?? 'Escribe aquí…' }),
      Markdown.configure({ html: false, transformPastedText: true, transformCopiedText: true, breaks: true }),
    ],
    content: value,
    autofocus: autoFocus ? 'end' : false,
    editorProps: { attributes: { class: 'md editor-body', ...(id ? { id } : {}) } },
    onUpdate: ({ editor: e }) => {
      const md = (e.storage as unknown as { markdown: { getMarkdown: () => string } }).markdown.getMarkdown();
      ultimo.current = md;
      onChange(md);
    },
  });

  // Si el valor cambia desde fuera (otra tarea, cancelar edición), se vuelve a cargar.
  useEffect(() => {
    if (editor && value !== ultimo.current) {
      ultimo.current = value;
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) return null;

  const enlace = () => {
    const actual = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('URL del enlace:', actual ?? 'https://');
    if (url === null) return;
    if (!url.trim()) editor.chain().focus().unsetLink().run();
    else editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
  };

  const B = ({ on, title, act, children }: { on: () => void; title: string; act?: boolean; children: React.ReactNode }) => (
    <button type="button" className={`editor-btn ${act ? 'act' : ''}`} title={title} onMouseDown={(e) => e.preventDefault()} onClick={on}>
      {children}
    </button>
  );

  return (
    <div className="editor">
      <div className="editor-toolbar">
        <B title="Negrita (Ctrl+B)" act={editor.isActive('bold')} on={() => editor.chain().focus().toggleBold().run()}><TypeBold /></B>
        <B title="Cursiva (Ctrl+I)" act={editor.isActive('italic')} on={() => editor.chain().focus().toggleItalic().run()}><TypeItalic /></B>
        <B title="Tachado" act={editor.isActive('strike')} on={() => editor.chain().focus().toggleStrike().run()}><TypeStrikethrough /></B>
        <span className="editor-sep" />
        <B title="Título" act={editor.isActive('heading', { level: 2 })} on={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><TypeH2 /></B>
        <B title="Subtítulo" act={editor.isActive('heading', { level: 3 })} on={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><TypeH3 /></B>
        <span className="editor-sep" />
        <B title="Lista" act={editor.isActive('bulletList')} on={() => editor.chain().focus().toggleBulletList().run()}><ListUl /></B>
        <B title="Lista numerada" act={editor.isActive('orderedList')} on={() => editor.chain().focus().toggleOrderedList().run()}><ListOl /></B>
        <B title="Checklist" act={editor.isActive('taskList')} on={() => editor.chain().focus().toggleTaskList().run()}><CheckSquare /></B>
        <span className="editor-sep" />
        <B title="Cita" act={editor.isActive('blockquote')} on={() => editor.chain().focus().toggleBlockquote().run()}><Quote /></B>
        <B title="Código" act={editor.isActive('codeBlock')} on={() => editor.chain().focus().toggleCodeBlock().run()}><Code /></B>
        <B title="Enlace" act={editor.isActive('link')} on={enlace}><Link45deg /></B>
        <B title="Tabla 3×3" act={editor.isActive('table')} on={() => (editor.isActive('table') ? editor.chain().focus().deleteTable().run() : editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())}><Table /></B>
        {editor.isActive('table') && (
          <>
            <span className="editor-sep" />
            <button type="button" className="editor-btn text" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().addRowAfter().run()}>+ fila</button>
            <button type="button" className="editor-btn text" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().addColumnAfter().run()}>+ columna</button>
            <button type="button" className="editor-btn text" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().deleteRow().run()}>− fila</button>
            <button type="button" className="editor-btn text" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().deleteColumn().run()}>− columna</button>
          </>
        )}
      </div>
      <EditorContent editor={editor} style={{ minHeight }} className="editor-content" />
    </div>
  );
}
