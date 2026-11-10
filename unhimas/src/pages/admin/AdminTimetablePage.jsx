import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MdCalendarToday, MdAdd, MdDelete } from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import Modal from '../../components/common/Modal';
import { toast } from '../../components/common/Toast';
import { supabase } from '../../lib/supabase';
import { getBatchCourses } from '../../services/academicService';
import { getLecturers } from '../../services/peopleService';
import { useTranslation } from '../../i18n';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function AdminTimetablePage() {
  const queryClient = useQueryClient();
  const { translateText } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    batch_course_id: '',
    lecturer_id: '',
    day_of_week: 1, // Monday
    start_time: '08:00',
    end_time: '10:00',
    room: 'Hall A',
  });

  const { data: slots = [], isLoading } = useQuery({
    queryKey: ['admin-timetable-slots'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('timetable_slots')
        .select(`
          *,
          batch_courses (
            courses (
              code,
              name
            ),
            batches (
              name,
              code
            )
          ),
          lecturers (
            first_name,
            last_name
          )
        `)
        .order('day_of_week')
        .order('start_time');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: batchCourses = [] } = useQuery({
    queryKey: ['admin-batch-courses'],
    queryFn: () => getBatchCourses(),
  });

  const { data: lecturers = [] } = useQuery({
    queryKey: ['admin-lecturers'],
    queryFn: () => getLecturers(),
  });

  const createMutation = useMutation({
    mutationFn: async (payload) => {
      const { data, error } = await supabase
        .from('timetable_slots')
        .insert([payload])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-timetable-slots'] });
      toast.success(translateText('Lecture timetable slot scheduled'));
      setIsModalOpen(false);
    },
    onError: (err) => {
      toast.error(err.message || translateText('Failed to schedule slot'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('timetable_slots').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-timetable-slots'] });
      toast.success(translateText('Timetable slot removed'));
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.batch_course_id || !formData.lecturer_id) {
      toast.error(translateText('Course and Lecturer are required'));
      return;
    }
    createMutation.mutate({
      ...formData,
      day_of_week: Number(formData.day_of_week),
    });
  };

  return (
    <AppLayout pageTitle={translateText('Timetable')}>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">{translateText('Lecture Hall Timetable')}</h1>
          <p className="page-subtitle">
            {translateText('Schedule weekly class sessions with automatic conflict prevention')}
          </p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            <MdAdd /> {translateText('Schedule Slot')}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>{translateText('Day of Week')}</th>
                <th>{translateText('Time Window')}</th>
                <th>{translateText('Course')}</th>
                <th>{translateText('Batch / Cohort')}</th>
                <th>{translateText('Lecturer')}</th>
                <th>{translateText('Assigned Room')}</th>
                <th style={{ textAlign: 'right' }}>{translateText('Action')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '3rem' }}>
                    {translateText('Loading timetable slots...')}
                  </td>
                </tr>
              ) : slots.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '3rem' }}>
                    <div className="empty-state">
                      <MdCalendarToday className="empty-state-icon" />
                      <div className="empty-state-title">{translateText('No Timetable Slots Scheduled')}</div>
                      <div className="empty-state-text">
                        {translateText('Add lecture hall timetable slots for your student cohorts.')}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                slots.map((slot) => (
                  <tr key={slot.id}>
                    <td>
                      <span className="badge badge-purple">{translateText(DAYS[slot.day_of_week])}</span>
                    </td>
                    <td>
                      <strong>{slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}</strong>
                    </td>
                    <td>
                      <code>{slot.batch_courses?.courses?.code}</code> {slot.batch_courses?.courses?.name}
                    </td>
                    <td>{slot.batch_courses?.batches?.name} ({slot.batch_courses?.batches?.code})</td>
                    <td>{slot.lecturers?.first_name} {slot.lecturers?.last_name}</td>
                    <td><span className="badge badge-blue">{slot.room || translateText('General Hall')}</span></td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn-icon"
                        title={translateText('Remove slot')}
                        onClick={() => {
                          if (window.confirm(translateText('Delete this timetable slot?'))) {
                            deleteMutation.mutate(slot.id);
                          }
                        }}
                      >
                        <MdDelete style={{ color: 'var(--color-secondary)' }} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={translateText('Schedule Lecture Timetable Slot')}
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setIsModalOpen(false)}>
              {translateText('Cancel')}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={createMutation.isPending}
            >
              {translateText('Save Schedule')}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{translateText('Batch Course *')}</label>
            <select
              className="form-input"
              value={formData.batch_course_id}
              onChange={(e) => setFormData({ ...formData, batch_course_id: e.target.value })}
              required
            >
              <option value="">{translateText('Select course & batch...')}</option>
              {batchCourses.map((bc) => (
                <option key={bc.id} value={bc.id}>
                  {bc.courses?.code} — {bc.courses?.name} ({bc.batches?.name})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">{translateText('Lecturer *')}</label>
            <select
              className="form-input"
              value={formData.lecturer_id}
              onChange={(e) => setFormData({ ...formData, lecturer_id: e.target.value })}
              required
            >
              <option value="">{translateText('Select lecturer...')}</option>
              {lecturers.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.first_name} {l.last_name} ({l.staff_id})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">{translateText('Day of Week *')}</label>
            <select
              className="form-input"
              value={formData.day_of_week}
              onChange={(e) => setFormData({ ...formData, day_of_week: e.target.value })}
            >
              <option value="1">{translateText('Monday')}</option>
              <option value="2">{translateText('Tuesday')}</option>
              <option value="3">{translateText('Wednesday')}</option>
              <option value="4">{translateText('Thursday')}</option>
              <option value="5">{translateText('Friday')}</option>
              <option value="6">{translateText('Saturday')}</option>
              <option value="0">{translateText('Sunday')}</option>
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">{translateText('Start Time *')}</label>
              <input
                type="time"
                className="form-input"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">{translateText('End Time *')}</label>
              <input
                type="time"
                className="form-input"
                value={formData.end_time}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">{translateText('Classroom / Hall')}</label>
            <input
              type="text"
              className="form-input"
              placeholder={translateText('e.g. Amphitheater 200, Lab 3')}
              value={formData.room}
              onChange={(e) => setFormData({ ...formData, room: e.target.value })}
            />
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
