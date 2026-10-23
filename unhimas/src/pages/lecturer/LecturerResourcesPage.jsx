import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MdDownload, MdFolder, MdVisibility, MdWarning } from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import ResourcePreviewModal, { ResourceKindIcon } from '../../components/common/ResourcePreviewModal';
import ResourceCardThumbnail from '../../components/common/ResourceCardThumbnail';
import { useAuth } from '../../context/AuthContext';
import { getLecturerResources, getLecturerResourceDownload } from '../../services/lecturerService';

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function LecturerResourcesPage() {
  const { profile } = useAuth();
  const [courseFilter, setCourseFilter] = useState('all');
  const [previewResource, setPreviewResource] = useState(null);

  const lecturerId = profile?.lecturer_id || profile?.id;
  const { data: resources = [], isLoading, error } = useQuery({
    queryKey: ['lecturer-resources', lecturerId],
    queryFn: () => getLecturerResources(lecturerId),
    enabled: !!lecturerId,
  });

  const courses = [
    ...new Map(
      resources
        .filter((resource) => resource.courses?.id || resource.course?.id)
        .map((resource) => {
          const course = resource.courses || resource.course;
          return [course.id, course];
        }),
    ).values(),
  ];

  const filteredResources =
    courseFilter === 'all'
      ? resources
      : resources.filter(
          (resource) =>
            resource.course_id === courseFilter ||
            resource.courses?.id === courseFilter ||
            resource.course?.id === courseFilter,
        );

  const downloadResource = async (resource) => {
    try {
      const { url, error: dlError } = await getLecturerResourceDownload(resource.file_path);
      if (dlError || !url) {
        window.alert('The resource could not be downloaded. Please try again later.');
        return;
      }
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      window.alert('The resource could not be downloaded. Please try again later.');
    }
  };

  const getSignedUrl = useCallback(async () => {
    if (!previewResource?.file_path) return null;
    const { url } = await getLecturerResourceDownload(previewResource.file_path);
    return url;
  }, [previewResource]);

  return (
    <AppLayout pageTitle="Resources">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Course Resources</h1>
          <p className="page-subtitle">Materials linked to your assigned courses</p>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.75rem' }}>
          {[1, 2, 3].map((item) => (
            <div key={item} className="card" style={{ padding: '0.75rem', height: 104 }}>
              <div className="skeleton skeleton-box" style={{ height: '100%' }} />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="empty-state" role="alert">
          <div className="empty-state-icon">
            <MdWarning />
          </div>
          <div className="empty-state-title">Resources unavailable</div>
          <p className="empty-state-text">Your course materials could not be loaded.</p>
        </div>
      ) : filteredResources.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <MdFolder />
          </div>
          <div className="empty-state-title">No resources found</div>
          <p className="empty-state-text">No materials have been uploaded for your assigned courses yet.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.75rem' }}>
          {filteredResources.map((resource) => (
            <article
              key={resource.id}
              className="card"
              style={{
                padding: '0.75rem',
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'stretch',
                gap: '0.75rem',
                minHeight: 0,
              }}
            >
              <ResourceCardThumbnail
                mimeType={resource.mime_type}
                fileName={resource.file_name || resource.title}
                title={resource.title}
                height={88}
                width={88}
                getSignedUrl={async () => {
                  const { url } = await getLecturerResourceDownload(resource.file_path);
                  return url;
                }}
              />
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <ResourceKindIcon mime={resource.mime_type} name={resource.title} size={16} />
                  {(resource.courses?.code || resource.course?.code) && (
                    <span className="badge badge-gray" style={{ fontSize: '0.65rem' }}>
                      {resource.courses?.code || resource.course?.code}
                    </span>
                  )}
                </div>
                <h2
                  style={{
                    fontSize: '0.9rem',
                    margin: '0 0 0.2rem',
                    fontWeight: 700,
                    lineHeight: 1.25,
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
                    fontSize: '0.75rem',
                    lineHeight: 1.35,
                    margin: 0,
                    flex: 1,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {resource.description || 'No description provided.'}
                </p>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginTop: '0.4rem',
                  }}
                >
                  <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>
                    {formatDate(resource.created_at)}
                  </span>
                  <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                    <button
                      type="button"
                      className="btn-icon"
                      title="Preview"
                      onClick={() => setPreviewResource(resource)}
                    >
                      <MdVisibility />
                    </button>
                    <button
                      type="button"
                      className="btn-icon"
                      title="Download"
                      onClick={() => downloadResource(resource)}
                    >
                      <MdDownload />
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <ResourcePreviewModal
        isOpen={Boolean(previewResource)}
        onClose={() => setPreviewResource(null)}
        title={previewResource?.title}
        mimeType={previewResource?.mime_type}
        fileName={previewResource?.title}
        getSignedUrl={getSignedUrl}
        onDownload={previewResource ? () => downloadResource(previewResource) : undefined}
      />
    </AppLayout>
  );
}
