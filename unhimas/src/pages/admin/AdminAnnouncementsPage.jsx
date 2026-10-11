import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MdAdd, MdCampaign, MdDelete } from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import Modal from '../../components/common/Modal';
import { toast } from '../../components/common/Toast';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { getDepartments } from '../../services/academicService';

export default function AdminAnnouncementsPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    body: '',
    department_id: '',
    is_published: true,
  });

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ['admin-announcements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcements')
        .select(`
          *,
          departments (
            name,
            abbreviation
          )
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['admin-departments'],
    queryFn: getDepartments,
  });

  const createMutation = useMutation({
    mutationFn: async (payload) => {
      const { data, error } = await supabase
        .from('announcements')
        .insert([
          {
            ...payload,
            department_id: payload.department_id || null,
            created_by: profile?.id || null,
            published_at: payload.is_published ? new Date().toISOString() : null,
          },
        ])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-announcements'] });
      toast.success('Announcement broadcast successfully');
      setIsModalOpen(false);
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to post announcement');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-announcements'] });
      toast.success('Announcement deleted');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.body.trim()) {
      toast.error('Title and content are required');
      return;
    }
    createMutation.mutate(formData);
  };

  return (
    <AppLayout pageTitle="Announcements">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Broadcast Announcements</h1>
          <p className="page-subtitle">Publish official campus notices to students, faculty, and departments</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            <MdAdd /> New Announcement
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {isLoading ? (
          <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
            Loading announcements...
          </div>
        ) : announcements.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <MdCampaign className="empty-state-icon" />
              <div className="empty-state-title">No Announcements Published</div>
              <div className="empty-state-text">
                Post institutional notices and deadline reminders here.
              </div>
            </div>
          </div>
        ) : (
          announcements.map((a) => (
            <div key={a.id} className="card">
              <div className="card-header">
                <div>
                  <h3 className="card-title" style={{ fontSize: '1.05rem' }}>{a.title}</h3>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
                    Posted on {new Date(a.created_at).toLocaleDateString()} • Target:{' '}
                    {a.departments?.name ? `${a.departments.name} (${a.departments.abbreviation})` : 'All University'}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className={`badge ${a.is_published ? 'badge-green' : 'badge-amber'}`}>
                    {a.is_published ? 'Published' : 'Draft'}
                  </span>
                  <button
                    className="btn-icon"
                    title="Delete notice"
                    onClick={() => {
                      if (window.confirm('Delete this announcement?')) {
                        deleteMutation.mutate(a.id);
                      }
                    }}
                  >
                    <MdDelete style={{ color: 'var(--color-secondary)' }} />
                  </button>
                </div>
              </div>
              <div className="card-body" style={{ whiteSpace: 'pre-line', fontSize: '0.875rem' }}>
                {a.body}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Post Institutional Announcement"
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </button>
            <button
              type="submit"
              form="announcement-form"
              className="btn btn-primary"
              disabled={createMutation.isPending}
            >
              Publish Notice
            </button>
          </>
        }
      >
        <form id="announcement-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Notice Title *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Resumption of Second Semester & Course Registrations"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Target Audience / Department</label>
            <select
              className="form-input"
              value={formData.department_id}
              onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
            >
              <option value="">All University (Campus-wide)</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.abbreviation})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Announcement Content *</label>
            <textarea
              className="form-input"
              rows="5"
              placeholder="Detailed announcement content..."
              value={formData.body}
              onChange={(e) => setFormData({ ...formData, body: e.target.value })}
              required
            />
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
