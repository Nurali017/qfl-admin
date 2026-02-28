'use client';

import { Editor } from '@tinymce/tinymce-react';
import type { Editor as TinyMCEEditor } from 'tinymce';
import { useRef } from 'react';

import { useAuth } from '@/context/AuthContext';

const TINYMCE_BASE = '/admin/tinymce';

type RichTextEditorProps = {
  value: string;
  onChange: (html: string, plainText: string) => void;
  placeholder?: string;
  height?: number;
};

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Начните писать...',
  height = 400,
}: RichTextEditorProps) {
  const { authFetch } = useAuth();
  const editorRef = useRef<TinyMCEEditor | null>(null);

  const handleImageUpload = async (blobInfo: { blob: () => Blob; filename: () => string }) => {
    const formData = new FormData();
    formData.append('file', blobInfo.blob(), blobInfo.filename());

    const response = await authFetch('/news/upload-inline-image', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Image upload failed');
    }

    const data = await response.json();
    return data.location;
  };

  return (
    <Editor
      tinymceScriptSrc={`${TINYMCE_BASE}/tinymce.min.js`}
      licenseKey="gpl"
      onInit={(_evt, editor) => {
        editorRef.current = editor;
      }}
      value={value}
      onEditorChange={(content, editor) => {
        const plainText = editor.getContent({ format: 'text' });
        onChange(content, plainText);
      }}
      init={{
        height,
        menubar: false,
        base_url: TINYMCE_BASE,
        suffix: '.min',
        skin_url: `${TINYMCE_BASE}/skins/ui/oxide-dark`,
        content_css: `${TINYMCE_BASE}/skins/content/dark/content.min.css`,
        placeholder,
        plugins: [
          'advlist', 'autolink', 'lists', 'link', 'image', 'charmap',
          'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
          'insertdatetime', 'media', 'table', 'help', 'wordcount',
        ],
        toolbar:
          'undo redo | blocks | bold italic underline strikethrough | ' +
          'alignleft aligncenter alignright alignjustify | ' +
          'bullist numlist outdent indent | link image media table | ' +
          'code fullscreen | removeformat help',
        images_upload_handler: handleImageUpload,
        paste_data_images: true,
        automatic_uploads: true,
        content_style: `
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            color: #eaf0ff;
            background: #0E172A;
          }
          img { max-width: 100%; height: auto; }
        `,
        branding: false,
        promotion: false,
      }}
    />
  );
}
