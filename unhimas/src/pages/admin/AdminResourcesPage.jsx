import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MdAdd, MdDelete, MdDownload, MdFilePresent, MdFolder, MdWarning } from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import Modal from '../../components/common/Modal';
import { toast } from '../../components/common/Toast';
import { getBatches, getCourses } from '../../services/academicService';
import { deleteAdminResource, getAdminResources, getAdminResourceDownload, uploadAdminResource } from '../../services/adminService';

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminResourcesPage() {
  const queryClient = useQueryClient();
  const [courseFilter, setCourseFilter] = useState('all');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', course_id: '', batch_id: '' });

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

  const filteredResources = courseFilter === 'all'
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
    } catch (downloadError) {
      toast.error(downloadError.message || 'The resource could not be downloaded.');
    }
  };

  const submitUpload = (event) => {
    event.preventDefault();
    const file = event.currentTarget.elements.namedItem('file')?.files?.[0];
    if (!file) return toast.error('Choose a file to upload.');
    if (!form.title.trim()) return toast.error('Add a resource title.');

    uploadMutation.mutate({
      file,
      title: form.title,
      description: form.description,
      course_id: form.course_id || null,
      batch_id: form.batch_id || null,
    });
  };

  return (
    <AppLayout pageTitle="Resources">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">University Resources</h1>
          <p className="page-subtitle">Secure institutional learning materials and documents</p>
        </div>
        <button className="btn btn-primary" onClick={() => setUploadOpen(true)}><MdAdd /> Upload resource</button>
      </div>

      {courses.length > 0 && (
        <div className="card" style={{ padding: '0.75rem 1rem', marginBottom: '1.25rem' }}>
          <label className="form-label" htmlFor="admin-resource-course-filter">Filter by course</label>
          <select id="admin-resource-course-filter" className="form-input" value={courseFilter} onChange={(event) => setCourseFilter(event.target.value)}>
            <option value="all">All courses</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>{course.code} — {course.name}</option>
            ))}
          </select>
        </div>
      )}

      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          {[1, 2, 3].map((item) => (
            <div key={item} className="card" style={{ padding: '1.25rem' }}>
              <div className="skeleton skeleton-title" style={{ width: '70%', marginBottom: 8 }} />
              <div className="skeleton skeleton-text" style={{ width: '50%', marginBottom: 16 }} />
              <div className="skeleton skeleton-text" style={{ height: 36 }} />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="empty-state" role="alert">
          <div className="empty-state-icon"><MdWarning /></div>
          <div className="empty-state-title">Resources unavailable</div>
          <p className="empty-state-text">The resource library could not be loaded. Please try again later.</p>
        </div>
      ) : filteredResources.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><MdFolder /></div>
          <div className="empty-state-title">No resources found</div>
          <p className="empty-state-text">No course materials have been uploaded yet.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          {filteredResources.map((resource) => (
            <article key={resource.id} className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', minHeight: 220 }}>
              <div className="card-title" style={{ marginBottom: 10 }}>
                <MdFilePresent color="var(--color-primary)" />
                {resource.courses?.code && <span style={{ marginLeft: 6 }}>{resource.courses.code}</span>}
              </div>
              <h2 style={{ fontSize: '1rem', margin: '0 0 0.5rem' }}>{resource.title}</h2>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem', lineHeight: 1.6, flex: 1 }}>{resource.description || 'No description provided.'}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginTop: '1rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{formatDate(resource.created_at)}</span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-primary btn-sm" onClick={() => downloadResource(resource)}><MdDownload /> Download</button>
                  <button className="btn-icon" title="Delete resource" onClick={() => { if (window.confirm('Delete this resource and its stored file?')) deleteMutation.mutate(resource.id); }}><MdDelete /></button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title="Upload resource"
        footer={
          <>
            <button className="btn btn-outline" type="button" onClick={() => setUploadOpen(false)}>Cancel</button>
            <button className="btn btn-primary" type="submit" form="resource-upload-form" disabled={uploadMutation.isPending}>Upload</button>
          </>
        }
      >
        <form id="resource-upload-form" onSubmit={submitUpload}>
          <div className="form-group">
            <label className="form-label" htmlFor="resource-file">File</label>
            <input id="resource-file" name="file" className="form-input" type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.png,.jpg,.jpeg" required />
            <div className="form-hint">Maximum 20 MB. Files are stored in the private resources bucket.</div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="resource-title">Title</label>
            <input id="resource-title" className="form-input" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="resource-description">Description</label>
            <textarea id="resource-description" className="form-input" rows="3" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="resource-course">Course</label>
            <select id="resource-course" className="form-input" value={form.course_id} onChange={(event) => setForm({ ...form, course_id: event.target.value })}>
              <option value="">All courses</option>
              {courses.map((course) => <option key={course.id} value={course.id}>{course.code} — {course.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="resource-batch">Batch</label>
            <select id="resource-batch" className="form-input" value={form.batch_id} onChange={(event) => setForm({ ...form, batch_id: event.target.value })}>
              <option value="">All batches</option>
              {batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.code} — {batch.name}</option>)}
            </select>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
