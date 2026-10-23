import { useEffect, useState } from 'react';
import { MdClose, MdDownload, MdInsertDriveFile, MdImage, MdPictureAsPdf } from 'react-icons/md';
import Modal from './Modal';
import { useTranslation } from '../../i18n';

function isImageMime(mime, name = '') {
  if (mime && mime.startsWith('image/')) return true;
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name || '');
}

function isPdfMime(mime, name = '') {
  if (mime === 'application/pdf') return true;
  return /\.pdf$/i.test(name || '');
}

export function getResourceKind(mime, name = '') {
  if (isImageMime(mime, name)) return 'image';
  if (isPdfMime(mime, name)) return 'pdf';
  return 'other';
}

export function ResourceKindIcon({ mime, name, size = 22 }) {
  const kind = getResourceKind(mime, name);
  if (kind === 'image') return <MdImage size={size} color="var(--color-primary)" />;
  if (kind === 'pdf') return <MdPictureAsPdf size={size} color="var(--color-secondary)" />;
  return <MdInsertDriveFile size={size} color="var(--color-primary)" />;
}

/**
 * Preview an existing stored resource using a signed URL loader.
 * getSignedUrl: async () => string (or { url })
 */
export default function ResourcePreviewModal({
  isOpen,
  onClose,
  title,
  mimeType,
  fileName,
  getSignedUrl,
  onDownload,
}) {
  const { translateText: tx } = useTranslation();
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const kind = getResourceKind(mimeType, fileName || title);

  useEffect(() => {
    let cancelled = false;
    if (!isOpen || !getSignedUrl) {
      setUrl(null);
      setError(null);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    setError(null);
    setUrl(null);
    (async () => {
      try {
        const result = await getSignedUrl();
        const resolved = typeof result === 'string' ? result : result?.url;
        if (!resolved) throw new Error(tx('No preview URL available'));
        if (!cancelled) setUrl(resolved);
      } catch (err) {
        if (!cancelled) setError(err.message || tx('Preview could not be loaded'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, getSignedUrl, tx]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title || tx('Resource preview')}
      maxWidth={kind === 'image' || kind === 'pdf' ? '900px' : '520px'}
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onClose}>
            {tx('Close')}
          </button>
          {onDownload && (
            <button type="button" className="btn btn-primary" onClick={onDownload}>
              <MdDownload /> {tx('Download')}
            </button>
          )}
        </>
      }
    >
      {loading && (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
          {tx('Loading preview…')}
        </div>
      )}
      {!loading && error && (
        <div className="auth-alert error" role="alert">
          {error}
        </div>
      )}
      {!loading && !error && url && kind === 'image' && (
        <div style={{ textAlign: 'center' }}>
          <img
            src={url}
            alt={title || fileName || tx('Resource preview')}
            style={{
              maxWidth: '100%',
              maxHeight: '70vh',
              objectFit: 'contain',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
            }}
          />
        </div>
      )}
      {!loading && !error && url && kind === 'pdf' && (
        <iframe
          title={title || tx('PDF preview')}
          src={url}
          style={{
            width: '100%',
            height: 'min(70vh, 640px)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-bg)',
          }}
        />
      )}
      {!loading && !error && kind === 'other' && (
        <div style={{ textAlign: 'center', padding: '1.5rem 0.5rem' }}>
          <ResourceKindIcon mime={mimeType} name={fileName} size={48} />
          <p style={{ marginTop: '1rem', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
            {tx('Inline preview is not available for this file type. Download the file to open it.')}
          </p>
          {(fileName || mimeType) && (
            <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--color-text)' }}>
              {[fileName, mimeType].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}

/** Local file selected in an upload form (object URL for images). */
export function LocalFilePreview({ file }) {
  const { translateText: tx } = useTranslation();
  const [objectUrl, setObjectUrl] = useState(null);

  useEffect(() => {
    if (!file || !isImageMime(file.type, file.name)) {
      setObjectUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!file) return null;

  const kind = getResourceKind(file.type, file.name);
  const sizeKb = file.size ? `${Math.max(1, Math.round(file.size / 1024))} KB` : '';

  return (
    <div
      style={{
        marginTop: '0.75rem',
        padding: '0.75rem',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--color-bg)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: objectUrl ? '0.75rem' : 0 }}>
        <ResourceKindIcon mime={file.type} name={file.name} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {file.name}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            {[file.type || tx('Unknown type'), sizeKb].filter(Boolean).join(' · ')}
          </div>
        </div>
      </div>
      {objectUrl && (
        <img
          src={objectUrl}
          alt={file.name}
          style={{
            maxWidth: '100%',
            maxHeight: 220,
            objectFit: 'contain',
            borderRadius: 'var(--radius-sm)',
            display: 'block',
            margin: '0 auto',
          }}
        />
      )}
      {kind === 'pdf' && (
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
          {tx('PDF selected — full preview is available after upload.')}
        </p>
      )}
    </div>
  );
}

// silence unused import if tree-shaken oddly
void MdClose;
