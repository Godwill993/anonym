import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MdAdd, MdDelete } from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import Modal from '../../components/common/Modal';
import { toast } from '../../components/common/Toast';
import { supabase } from '../../lib/supabase';
import { getBatches } from '../../services/academicService';
import { useTranslation } from '../../i18n';

export default function AcademicEventsPage() {
  const queryClient = useQueryClient();
  const { translateText, language } = useTranslation();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', start_at: '', end_at: '', batch_id: '' });

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['academic-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('academic_events')
        .select('*, batches(name,code)')
        .order('start_at');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: batches = [] } = useQuery({
    queryKey: ['admin-batches'],
    queryFn: getBatches,
  });

  const createMutation = useMutation({
    mutationFn: async (payload) => {
      const { data, error } = await supabase.from('academic_events').insert([payload]).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academic-events'] });
      toast.success(translateText('Academic event published'));
      setOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('academic_events').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academic-events'] });
      toast.success(translateText('Academic event removed'));
    },
  });

  const locale = language === 'fr' ? 'fr-CM' : 'en-CM';

  return (
    <AppLayout pageTitle={translateText('Academic Events')}>
      <div className="page-header">
        <div>
          <h1 className="page-title">{translateText('Academic Events')}</h1>
          <p className="page-subtitle">
            {translateText('Publish official academic dates such as examinations, registration, and campus events.')}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setOpen(true)}>
          <MdAdd /> {translateText('Add event')}
        </button>
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>{translateText('Event')}</th>
                <th>{translateText('Batch')}</th>
                <th>{translateText('Starts')}</th>
                <th>{translateText('Ends')}</th>
                <th>{translateText('Action')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '3rem' }}>
                    {translateText('Loading…')}
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '3rem' }}>
                    {translateText('No academic events scheduled.')}
                  </td>
                </tr>
              ) : (
                events.map((event) => (
                  <tr key={event.id}>
                    <td>
                      <strong>{event.title}</strong>
                      <br />
                      <span style={{ color: 'var(--color-text-muted)', fontSize: '.75rem' }}>
                        {event.description || '—'}
                      </span>
                    </td>
                    <td>{event.batches?.name || translateText('All batches')}</td>
                    <td>{new Date(event.start_at).toLocaleString(locale)}</td>
                    <td>{event.end_at ? new Date(event.end_at).toLocaleString(locale) : '—'}</td>
                    <td>
                      <button
                        className="btn-icon"
                        title={translateText('Delete event')}
                        onClick={() => {
                          if (window.confirm(translateText('Delete this academic event?'))) {
                            deleteMutation.mutate(event.id);
                          }
                        }}
                      >
                        <MdDelete />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={translateText('Add academic event')}
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setOpen(false)}>
              {translateText('Cancel')}
            </button>
            <button
              className="btn btn-primary"
              onClick={() => createMutation.mutate(form)}
              disabled={createMutation.isPending}
            >
              {translateText('Save event')}
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">{translateText('Title')}</label>
          <input
            className="form-input"
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
          />
        </div>
        <div className="form-group">
          <label className="form-label">{translateText('Batch')}</label>
          <select
            className="form-input"
            value={form.batch_id}
            onChange={(event) => setForm({ ...form, batch_id: event.target.value })}
          >
            <option value="">{translateText('All batches')}</option>
            {batches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.name} ({batch.code})
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
          <div className="form-group">
            <label className="form-label">{translateText('Starts')}</label>
            <input
              className="form-input"
              type="datetime-local"
              value={form.start_at}
              onChange={(event) => setForm({ ...form, start_at: event.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">{translateText('Ends')}</label>
            <input
              className="form-input"
              type="datetime-local"
              value={form.end_at}
              onChange={(event) => setForm({ ...form, end_at: event.target.value })}
            />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">{translateText('Description')}</label>
          <textarea
            className="form-input"
            rows="3"
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
          />
        </div>
      </Modal>
    </AppLayout>
  );
}
