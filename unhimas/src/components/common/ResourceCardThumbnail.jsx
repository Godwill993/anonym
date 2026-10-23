import { useEffect, useState } from 'react';
import {
  MdImage,
  MdInsertDriveFile,
  MdPictureAsPdf,
  MdDescription,
  MdSlideshow,
  MdTableChart,
  MdFolderZip,
} from 'react-icons/md';
import { getResourceKind } from './ResourcePreviewModal';

const PDFJS_CDN = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs';
const PDFJS_WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';

let pdfjsLibPromise = null;

async function loadPdfJs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import(/* @vite-ignore */ PDFJS_CDN).then((mod) => {
      const lib = mod.default || mod;
      if (lib?.GlobalWorkerOptions) {
        lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
      }
      return lib;
    });
  }
  return pdfjsLibPromise;
}

function FileTypeIcon({ mime, name, size = 48 }) {
  const lower = `${mime || ''} ${name || ''}`.toLowerCase();
  if (lower.includes('pdf') || /\.pdf\b/.test(lower)) {
    return <MdPictureAsPdf size={size} color="var(--color-secondary)" />;
  }
  if (lower.startsWith('image') || /\.(png|jpe?g|gif|webp|bmp|svg)\b/.test(lower)) {
    return <MdImage size={size} color="var(--color-primary)" />;
  }
  if (/word|msword|docx?|\.doc\b/.test(lower)) {
    return <MdDescription size={size} color="#2b579a" />;
  }
  if (/powerpoint|presentation|pptx?|\.ppt\b/.test(lower)) {
    return <MdSlideshow size={size} color="#c43e1c" />;
  }
  if (/excel|spreadsheet|xlsx?|\.xls\b/.test(lower)) {
    return <MdTableChart size={size} color="#217346" />;
  }
  if (/zip|rar|7z|compress/.test(lower)) {
    return <MdFolderZip size={size} color="var(--color-text-muted)" />;
  }
  return <MdInsertDriveFile size={size} color="var(--color-primary)" />;
}

/**
 * Visual thumbnail for a resource card.
 * - Images: signed URL preview
 * - PDFs: first page rendered via pdf.js (CDN)
 * - Anything else / failures: large file-type icon
 *
 * getSignedUrl: async () => string | { url: string }
 */
export default function ResourceCardThumbnail({
  mimeType,
  fileName,
  title,
  getSignedUrl,
  height = 140,
}) {
  const [thumbUrl, setThumbUrl] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | fallback

  useEffect(() => {
    let cancelled = false;
    let objectUrlToRevoke = null;

    async function run() {
      setStatus('loading');
      setThumbUrl(null);

      if (typeof getSignedUrl !== 'function') {
        if (!cancelled) setStatus('fallback');
        return;
      }

      try {
        const result = await getSignedUrl();
        const signed = typeof result === 'string' ? result : result?.url;
        if (!signed) throw new Error('no url');

        const kind = getResourceKind(mimeType, fileName || title || '');

        if (kind === 'image') {
          if (!cancelled) {
            setThumbUrl(signed);
            setStatus('ready');
          }
          return;
        }

        if (kind === 'pdf') {
          try {
            const pdfjs = await loadPdfJs();
            const loadingTask = pdfjs.getDocument({ url: signed, withCredentials: false });
            const pdf = await loadingTask.promise;
            const page = await pdf.getPage(1);
            const viewport = page.getViewport({ scale: 1.25 });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            await page.render({ canvasContext: ctx, viewport }).promise;
            const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
            if (!cancelled) {
              setThumbUrl(dataUrl);
              setStatus('ready');
            }
            return;
          } catch {
            // fall through to icon
          }
        }

        if (!cancelled) setStatus('fallback');
      } catch {
        if (!cancelled) setStatus('fallback');
      }
    }

    run();

    return () => {
      cancelled = true;
      if (objectUrlToRevoke) URL.revokeObjectURL(objectUrlToRevoke);
    };
  }, [mimeType, fileName, title, getSignedUrl]);

  return (
    <div
      style={{
        height,
        width: '100%',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        background: 'var(--color-bg)',
        border: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '0.85rem',
        position: 'relative',
      }}
    >
      {status === 'ready' && thumbUrl ? (
        <img
          src={thumbUrl}
          alt={title || fileName || 'Resource preview'}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.35rem',
            opacity: status === 'loading' ? 0.45 : 0.9,
          }}
        >
          <FileTypeIcon mime={mimeType} name={fileName || title} size={52} />
        </div>
      )}
    </div>
  );
}
