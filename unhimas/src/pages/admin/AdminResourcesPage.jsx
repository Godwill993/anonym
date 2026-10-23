import { useState } from 'react';
import { useTranslation } from '../../i18n';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MdAdd, MdDelete, MdDownload, MdFolder, MdWarning } from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import Modal from '../../components/common/Modal';
import { LocalFilePreview, ResourceKindIcon } from '../../components/common/ResourcePreviewModal';
import ResourceCardThumbnail from '../../components/common/ResourceCardThumbnail';
import { downloadFileFromUrl } from '../../utils/downloadFile';
import { toast } from '../../components/common/Toast';
import { getBatches, getCourses } from '../../services/academicService';
import {
  deleteAdminResource,
  getAdminResources,
  getAdminResourceDownload,
  uploadAdminResource,
} from '../../services/adminService';

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminResourcesPage() {
  const { translateText: tx } = useTranslation();
  const queryClient = useQueryClient();
  const [courseFilter, setCourseFilter] = useState('all');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', course_id: '', batch_id: '' });
  const [selectedFile, setSelectedFile] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  const { data: resources = [], isLoading, error } = useQuery({
    queryKey: ['admin-resources'],
    queryFn: getAdminResources,
  });
  const { data: batches = [] } = useQuery({ queryKey: ['admin-batches'], queryFn: getBatches });
  const { data: courses = [] } = useQuery({ queryKey: ['admin-courses'], queryFn: () => getCourses() });

  const uploadMutation = useMutation({
    mutationFn: uploadAdminResource,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-resources'] });
      setUploadOpen(false);
      setForm({ title: '', description: '', course_id: '', batch_id: '' });
      setSelectedFile(null);
      toast.success(tx('Resource uploaded securely.'));
    },
    onError: (uploadError) => toast.error(uploadError.message || tx('The resource could not be uploaded.')),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAdminResource,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-resources'] });
      toast.success(tx('Resource deleted.'));
    },
    onError: (deleteError) => toast.error(deleteError.message || tx('The resource could not be deleted.')),
  });

  const filteredResources =
    courseFilter === 'all'
      ? resources
      : resources.filter((resource) => resource.course_id === courseFilter);

  const downloadResource = async (resource) => {
    setDownloadingId(resource.id);
    try {
      const { url } = await getAdminResourceDownload(resource.file_path);
      if (!url) throw new Error('No download URL');
      const name =
        resource.file_name ||
        resource.title ||
        resource.file_path?.split('/').pop() ||
        'resource';
      await downloadFileFromUrl(url, name);
    } catch (err) {
      toast.error(err.message || tx('The resource could not be downloaded.'));
    } finally {
      setDownloadingId(null);
    }
  };

  const submitUpload = (event) => {
    event.preventDefault();
    const fileInput = event.target.elements.file;
    const file = fileInput?.files?.[0] || selectedFile;
    if (!file) {
      toast.error(tx('Please choose a file to upload.'));
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error(tx('File must be 20 MB or smaller.'));
      return;
    }
    uploadMutation.mutate({
      file,
      title: form.title.trim(),
      description: form.description.trim() || null,
      course_id: form.course_id || null,
      batch_id: form.batch_id || null,
    });
  };

  const openUpload = () => {
    setSelectedFile(null);
    setForm({ title: '', description: '', course_id: '', batch_id: '' });
    setUploadOpen(true);
  };

  return (
    <AppLayout pageTitle={tx('Resources')}>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">{tx('Resources')}</h1>
          <p className="page-subtitle">{tx('Upload and manage course materials for students and lecturers')}</p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn btn-primary" onClick={openUpload}>
            <MdAdd /> {tx('Upload resource')}
          </button>
        </div>
      </div>

      {courses.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <select
            className="form-input"
            style={{ maxWidth: 280 }}
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
          >
            <option value="all">{tx('All courses')}</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.code} — {course.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="card" style={{ padding: '1rem', height: 130 }}>
              <div className="skeleton skeleton-box" style={{ height: '100%' }} />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="empty-state" role="alert">
          <div className="empty-state-icon">
            <MdWarning />
          </div>
          <div className="empty-state-title">{tx('Resources unavailable')}</div>
          <p className="empty-state-text">{tx('The resource library could not be loaded. Please try again later.')}</p>
        </div>
      ) : filteredResources.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <MdFolder />
          </div>
          <div className="empty-state-title">{tx('No resources found')}</div>
          <p className="empty-state-text">{tx('No course materials have been uploaded yet.')}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
          {filteredResources.map((resource) => (
            <article
              key={resource.id}
              className="card"
              style={{
                padding: '1rem',
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'stretch',
                gap: '1rem',
                minHeight: 0,
              }}
            >
              <ResourceCardThumbnail
                mimeType={resource.mime_type}
                fileName={resource.file_name || resource.title}
                title={resource.title}
                height={112}
                width={112}
                getSignedUrl={async () => {
                  const { url } = await getAdminResourceDownload(resource.file_path);
                  return url;
                }}
              />
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <ResourceKindIcon mime={resource.mime_type} name={resource.title} size={18} />
                  {resource.courses?.code && (
                    <span className="badge badge-gray" style={{ fontSize: '0.65rem' }}>
                      {resource.courses.code}
                    </span>
                  )}
                </div>
                <h2
                  style={{
                    fontSize: '0.95rem',
                    margin: '0 0 0.25rem',
                    fontWeight: 700,
                    lineHeight: 1.3,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {resource.title}
                </h2>
                <p
                  style={{
                    color: 'var(--color-text-muted)',
                    fontSize: '0.8rem',
                    lineHeight: 1.4,
                    margin: 0,
                    flex: 1,
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {resource.description || tx('No description provided.')}
                </p>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginTop: '0.5rem',
                  }}
                >
                  <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                    {formatDate(resource.created_at)}
                  </span>
                  <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                    <button
                      type="button"
                      className="btn-icon"
                      title={downloadingId === resource.id ? tx('Downloading…') : tx('Download')}
                      disabled={downloadingId === resource.id}
                      onClick={() => downloadResource(resource)}
                    >
                      <MdDownload />
                    </button>
                    <button
                      type="button"
                      className="btn-icon"
                      title={tx('Delete')}
                      onClick={() => {
                        if (window.confirm(tx('Delete this resource and its stored file?'))) {
                          deleteMutation.mutate(resource.id);
                        }
                      }}
                    >
                      <MdDelete />
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal
        isOpen={uploadOpen}
        onClose={() => {
          setUploadOpen(false);
          setSelectedFile(null);
        }}
        title={tx('Upload resource')}
        footer={
          <>
            <button
              className="btn btn-outline"
              type="button"
              onClick={() => {
                setUploadOpen(false);
                setSelectedFile(null);
              }}
            >
              {tx('Cancel')}
            </button>
            <button
              className="btn btn-primary"
              type="submit"
              form="resource-upload-form"
              disabled={uploadMutation.isPending}
            >
              {uploadMutation.isPending ? tx('Uploading…') : tx('Upload')}
            </button>
          </>
        }
      >
        <form id="resource-upload-form" onSubmit={submitUpload}>
          <div className="form-group">
            <label className="form-label" htmlFor="resource-file">
              {tx('File')}
            </label>
            <input
              id="resource-file"
              name="file"
              className="form-input"
              type="file"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.png,.jpg,.jpeg,.gif,.webp"
              required
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                setSelectedFile(file);
                if (file && !form.title.trim()) {
                  setForm((prev) => ({ ...prev, title: file.name.replace(/\.[^.]+$/, '') }));
                }
              }}
            />
            <div className="form-hint">{tx('Maximum 20 MB. Files are stored in the private resources bucket.')}</div>
            <LocalFilePreview file={selectedFile} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="resource-title">
              {tx('Title')}
            </label>
            <input
              id="resource-title"
              className="form-input"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="resource-description">
              {tx('Description')}
            </label>
            <textarea
              id="resource-description"
              className="form-input"
              rows="3"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="resource-course">
              {tx('Course')}
            </label>
            <select
              id="resource-course"
              className="form-input"
              value={form.course_id}
              onChange={(e) => setForm({ ...form, course_id: e.target.value })}
            >
              <option value="">{tx('All courses')}</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code} — {course.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="resource-batch">
              {tx('Batch')}
            </label>
            <select
              id="resource-batch"
              className="form-input"
              value={form.batch_id}
              onChange={(e) => setForm({ ...form, batch_id: e.target.value })}
            >
              <option value="">{tx('All batches')}</option>
              {batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.code} — {batch.name}
                </option>
              ))}
            </select>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
