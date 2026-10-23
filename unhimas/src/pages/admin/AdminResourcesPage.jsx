import { useCallback, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MdAdd, MdDelete, MdDownload, MdFolder, MdVisibility, MdWarning } from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import Modal from '../../components/common/Modal';
import ResourcePreviewModal, {
  LocalFilePreview,
  ResourceKindIcon,
} from '../../components/common/ResourcePreviewModal';
import ResourceCardThumbnail from '../../components/common/ResourceCardThumbnail';
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
  const queryClient = useQueryClient();
  const [courseFilter, setCourseFilter] = useState('all');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', course_id: '', batch_id: '' });
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewResource, setPreviewResource] = useState(null);

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
      toast.success('Resource uploaded securely.');
    },
    onError: (uploadError) => toast.error(uploadError.message || 'The resource could not be uploaded.'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAdminResource,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-resources'] });
      toast.success('Resource deleted.');
    },
    onError: (deleteError) => toast.error(deleteError.message || 'The resource could not be deleted.'),
  });

  const filteredResources =
    courseFilter === 'all'
      ? resources
      : resources.filter((resource) => resource.course_id === courseFilter);

  const downloadResource = async (resource) => {
    try {
      const { url } = await getAdminResourceDownload(resource.file_path);
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      toast.error(err.message || 'The resource could not be downloaded.');
    }
  };

  const getSignedUrl = useCallback(async () => {
    if (!previewResource?.file_path) return null;
    const { url } = await getAdminResourceDownload(previewResource.file_path);
    return url;
  }, [previewResource]);

  const submitUpload = (event) => {
    event.preventDefault();
    const fileInput = event.target.elements.file;
    const file = fileInput?.files?.[0] || selectedFile;
    if (!file) {
      toast.error('Please choose a file to upload.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error('File must be 20 MB or smaller.');
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
    <AppLayout pageTitle="Resources">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Resources</h1>
          <p className="page-subtitle">Upload and manage course materials for students and lecturers</p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn btn-primary" onClick={openUpload}>
            <MdAdd /> Upload resource
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
            <option value="all">All courses</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.code} — {course.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="card" style={{ padding: '1.25rem' }}>
              <div className="skeleton skeleton-title" style={{ width: '70%', marginBottom: 8 }} />
              <div className="skeleton skeleton-text" style={{ width: '50%', marginBottom: 16 }} />
              <div className="skeleton skeleton-text" style={{ height: 36 }} />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="empty-state" role="alert">
          <div className="empty-state-icon">
            <MdWarning />
          </div>
          <div className="empty-state-title">Resources unavailable</div>
          <p className="empty-state-text">The resource library could not be loaded. Please try again later.</p>
        </div>
      ) : filteredResources.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <MdFolder />
          </div>
          <div className="empty-state-title">No resources found</div>
          <p className="empty-state-text">No course materials have been uploaded yet.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          {filteredResources.map((resource) => (
            <article
              key={resource.id}
              className="card"
              style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', minHeight: 280 }}
            >
              <ResourceCardThumbnail
                mimeType={resource.mime_type}
                fileName={resource.file_name || resource.title}
                title={resource.title}
                getSignedUrl={async () => {
                  const { url } = await getAdminResourceDownload(resource.file_path);
                  return url;
                }}
              />
              <div className="card-title" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                <ResourceKindIcon mime={resource.mime_type} name={resource.title} />
                {resource.courses?.code && <span>{resource.courses.code}</span>}
              </div>
              <h2 style={{ fontSize: '1rem', margin: '0 0 0.5rem' }}>{resource.title}</h2>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem', lineHeight: 1.6, flex: 1 }}>
                {resource.description || 'No description provided.'}
              </p>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '0.75rem',
                  marginTop: '1rem',
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  {formatDate(resource.created_at)}
                </span>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setPreviewResource(resource)}
                  >
                    <MdVisibility /> Preview
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => downloadResource(resource)}
                  >
                    <MdDownload /> Download
                  </button>
                  <button
                    type="button"
                    className="btn-icon"
                    title="Delete resource"
                    onClick={() => {
                      if (window.confirm('Delete this resource and its stored file?')) {
                        deleteMutation.mutate(resource.id);
                      }
                    }}
                  >
                    <MdDelete />
                  </button>
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
        title="Upload resource"
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
              Cancel
            </button>
            <button
              className="btn btn-primary"
              type="submit"
              form="resource-upload-form"
              disabled={uploadMutation.isPending}
            >
              {uploadMutation.isPending ? 'Uploading…' : 'Upload'}
            </button>
          </>
        }
      >
        <form id="resource-upload-form" onSubmit={submitUpload}>
          <div className="form-group">
            <label className="form-label" htmlFor="resource-file">
              File
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
                  const base = file.name.replace(/\.[^.]+$/, '');
                  setForm((prev) => ({ ...prev, title: base }));
                }
              }}
            />
            <div className="form-hint">Maximum 20 MB. Files are stored in the private resources bucket.</div>
            <LocalFilePreview file={selectedFile} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="resource-title">
              Title
            </label>
            <input
              id="resource-title"
              className="form-input"
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="resource-description">
              Description
            </label>
            <textarea
              id="resource-description"
              className="form-input"
              rows="3"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="resource-course">
              Course
            </label>
            <select
              id="resource-course"
              className="form-input"
              value={form.course_id}
              onChange={(event) => setForm({ ...form, course_id: event.target.value })}
            >
              <option value="">All courses</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code} — {course.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="resource-batch">
              Batch
            </label>
            <select
              id="resource-batch"
              className="form-input"
              value={form.batch_id}
              onChange={(event) => setForm({ ...form, batch_id: event.target.value })}
            >
              <option value="">All batches</option>
              {batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.code} — {batch.name}
                </option>
              ))}
            </select>
          </div>
        </form>
      </Modal>

      <ResourcePreviewModal
        isOpen={Boolean(previewResource)}
        onClose={() => setPreviewResource(null)}
        title={previewResource?.title}
        mimeType={previewResource?.mime_type}
        fileName={previewResource?.title}
        getSignedUrl={getSignedUrl}
        onDownload={
          previewResource
            ? () => downloadResource(previewResource)
            : undefined
        }
      />
    </AppLayout>
  );
}
