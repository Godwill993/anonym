import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MdHistory } from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import DataTable from '../../components/common/DataTable';
import { supabase } from '../../lib/supabase';

export default function ShiftHistoryPage() {
  const [limit] = useState(100);

  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ['admin-shift-history', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lecturer_shifts')
        .select('*, lecturers (staff_id, first_name, last_name, departments (abbreviation))')
        .order('clock_in', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    },
  });

  const columns = [
    {
      header: 'Lecturer',
      accessorFn: (r) =>
        r.lecturers
          ? `${r.lecturers.first_name || ''} ${r.lecturers.last_name || ''}`.trim()
          : '—',
    },
    {
      header: 'Staff ID',
      accessorFn: (r) => r.lecturers?.staff_id || '—',
    },
    {
      header: 'Dept',
      accessorFn: (r) => r.lecturers?.departments?.abbreviation || '—',
    },
    {
      header: 'Clock In',
      accessorFn: (r) => (r.clock_in ? new Date(r.clock_in).toLocaleString('en-GB') : '—'),
    },
    {
      header: 'Clock Out',
      accessorFn: (r) => (r.clock_out ? new Date(r.clock_out).toLocaleString('en-GB') : '—'),
    },
    {
      header: 'Status',
      accessorFn: (r) => r.status || '—',
    },
  ];

  return (
    <AppLayout pageTitle="Shift History">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">
            <MdHistory style={{ verticalAlign: 'middle', marginRight: 8 }} />
            Shift History
          </h1>
          <p className="page-subtitle">Past and current faculty campus clock-ins</p>
        </div>
      </div>

      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          {isLoading ? (
            <div style={{ padding: '1.5rem', textAlign: 'center' }}>Loading…</div>
          ) : (
            <DataTable columns={columns} data={shifts} emptyMessage="No shift records" />
          )}
        </div>
      </div>
    </AppLayout>
  );
}
