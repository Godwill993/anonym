import { useState } from 'react';
import { useTranslation } from '../../i18n';
import { useQuery } from '@tanstack/react-query';
import { MdDownload, MdFolder, MdWarning } from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import { ResourceKindIcon } from '../../components/common/ResourcePreviewModal';
import ResourceCardThumbnail from '../../components/common/ResourceCardThumbnail';
import { downloadFileFromUrl } from '../../utils/downloadFile';
import { useAuth } from '../../context/AuthContext';
import { getLecturerResources, getLecturerResourceDownload } from '../../services/lecturerService';

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function LecturerResourcesPage() {
  const { translateText: tx } = useTranslation();
  const { profile } = useAuth();
  const [courseFilter, setCourseFilter] = useState('all');
  const [downloadingId, setDownloadingId] = useState(null);

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
    setDownloadingId(resource.id);
    try {
      const { url } = await getLecturerResourceDownload(resource.file_path);
      if (!url) throw new Error('No download URL');
      const name =
        resource.file_name ||
        resource.title ||
        resource.file_path?.split('/').pop() ||
        'resource';
      await downloadFileFromUrl(url, name);
    } catch {
      window.alert(tx('The resource could not be downloaded. Please try again later.'));
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <AppLayout pageTitle={tx('Resources')}>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">{tx('Course Resources')}</h1>
          <p className="page-subtitle">{tx('Materials linked to your assigned courses')}</p>
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
          {[1, 2, 3].map((item) => (
            <div key={item} className="card" style={{ padding: '1rem', height: 130 }}>
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
          <p className="empty-state-text">{tx('Your course materials could not be loaded.')}</p>
        </div>
      ) : filteredResources.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <MdFolder />
          </div>
          <div className="empty-state-title">{tx('No resources found')}</div>
          <p className="empty-state-text">{tx('No materials have been uploaded for your assigned courses yet.')}</p>
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
                  const { url } = await getLecturerResourceDownload(resource.file_path);
                  return url;
                }}
              />
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <ResourceKindIcon mime={resource.mime_type} name={resource.title} size={18} />
                  {(resource.courses?.code || resource.course?.code) && (
                    <span className="badge badge-gray" style={{ fontSize: '0.65rem' }}>
                      {resource.courses?.code || resource.course?.code}
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
                  <button
                    type="button"
                    className="btn-icon"
                    title={downloadingId === resource.id ? tx('Downloading…') : tx('Download')}
                    disabled={downloadingId === resource.id}
                    onClick={() => downloadResource(resource)}
                  >
                    <MdDownload />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
