import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MdSearch,
  MdClose,
  MdSchool,
  MdPersonPin,
  MdBook,
  MdApartment,
  MdCampaign,
  MdFolder,
  MdSchedule,
  MdArrowForward,
} from 'react-icons/md';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export default function GlobalSearchModal({ isOpen, onClose }) {
  const { profile } = useAuth();
  const role = profile?.role || 'student';
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  const isQueryValid = isOpen && query.trim().length >= 2;

  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // Execute role-aware debounced search against Supabase (respecting RLS)
  useEffect(() => {
    if (!isQueryValid) {
      return;
    }

    let isMounted = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      const q = query.trim();
      const newResults = {};

      try {
        if (role === 'admin') {
          // 1. Students
          const { data: students } = await supabase
            .from('students')
            .select('id, matricule, first_name, last_name')
            .or(`matricule.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
            .limit(5);
          if (students?.length) newResults['Students'] = students.map((s) => ({
            id: s.id,
            title: `${s.first_name} ${s.last_name}`,
            subtitle: s.matricule,
            icon: MdSchool,
            path: '/admin/students',
          }));

          // 2. Lecturers
          const { data: lecturers } = await supabase
            .from('lecturers')
            .select('id, staff_id, first_name, last_name')
            .or(`staff_id.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
            .limit(5);
          if (lecturers?.length) newResults['Lecturers'] = lecturers.map((l) => ({
            id: l.id,
            title: `${l.first_name} ${l.last_name}`,
            subtitle: l.staff_id,
            icon: MdPersonPin,
            path: '/admin/lecturers',
          }));

          // 3. Courses
          const { data: courses } = await supabase
            .from('courses')
            .select('id, code, name')
            .or(`code.ilike.%${q}%,name.ilike.%${q}%`)
            .limit(5);
          if (courses?.length) newResults['Courses'] = courses.map((c) => ({
            id: c.id,
            title: `${c.code} — ${c.name}`,
            subtitle: 'Course catalog',
            icon: MdBook,
            path: '/admin/courses',
          }));

          // 4. Departments
          const { data: depts } = await supabase
            .from('departments')
            .select('id, code, name, abbreviation')
            .or(`name.ilike.%${q}%,abbreviation.ilike.%${q}%`)
            .limit(4);
          if (depts?.length) newResults['Departments'] = depts.map((d) => ({
            id: d.id,
            title: d.name,
            subtitle: d.code || d.abbreviation,
            icon: MdApartment,
            path: '/admin/departments',
          }));

          // 5. Announcements
          const { data: announcements } = await supabase
            .from('announcements')
            .select('id, title')
            .ilike('title', `%${q}%`)
            .limit(4);
          if (announcements?.length) newResults['Announcements'] = announcements.map((a) => ({
            id: a.id,
            title: a.title,
            subtitle: 'University Notice',
            icon: MdCampaign,
            path: '/admin/announcements',
          }));
        } else if (role === 'lecturer') {
          // Lecturer search
          const { data: courses } = await supabase
            .from('courses')
            .select('id, code, name')
            .or(`code.ilike.%${q}%,name.ilike.%${q}%`)
            .limit(5);
          if (courses?.length) newResults['Courses'] = courses.map((c) => ({
            id: c.id,
            title: `${c.code} — ${c.name}`,
            subtitle: 'Teaching curriculum',
            icon: MdBook,
            path: '/lecturer/courses',
          }));

          const { data: sessions } = await supabase
            .from('class_sessions')
            .select('id, topic, room')
            .or(`topic.ilike.%${q}%,room.ilike.%${q}%`)
            .limit(5);
          if (sessions?.length) newResults['Class Sessions'] = sessions.map((s) => ({
            id: s.id,
            title: s.topic || `Session in Room ${s.room || 'General'}`,
            subtitle: s.room ? `Room ${s.room}` : 'Class Session',
            icon: MdSchedule,
            path: '/lecturer/sessions',
          }));

          const { data: resources } = await supabase
            .from('resources')
            .select('id, title, file_name')
            .or(`title.ilike.%${q}%,file_name.ilike.%${q}%`)
            .limit(4);
          if (resources?.length) newResults['Resources'] = resources.map((r) => ({
            id: r.id,
            title: r.title,
            subtitle: r.file_name || 'Academic document',
            icon: MdFolder,
            path: '/lecturer/resources',
          }));
        } else if (role === 'frontdesk') {
          // Front Desk: Lecturers & Shift Roster
          const { data: lecturers } = await supabase
            .from('lecturers')
            .select('id, staff_id, first_name, last_name')
            .or(`staff_id.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
            .limit(8);
          if (lecturers?.length) newResults['Faculty Staff'] = lecturers.map((l) => ({
            id: l.id,
            title: `${l.first_name} ${l.last_name}`,
            subtitle: `Staff ID: ${l.staff_id}`,
            icon: MdPersonPin,
            path: '/frontdesk/lecturer-attendance',
          }));
        } else {
          // Student search: Courses, Announcements, Resources
          const { data: courses } = await supabase
            .from('courses')
            .select('id, code, name')
            .or(`code.ilike.%${q}%,name.ilike.%${q}%`)
            .limit(5);
          if (courses?.length) newResults['My Courses'] = courses.map((c) => ({
            id: c.id,
            title: `${c.code} — ${c.name}`,
            subtitle: 'Enrolled syllabus',
            icon: MdBook,
            path: '/student/courses',
          }));

          const { data: announcements } = await supabase
            .from('announcements')
            .select('id, title')
            .ilike('title', `%${q}%`)
            .limit(5);
          if (announcements?.length) newResults['Announcements'] = announcements.map((a) => ({
            id: a.id,
            title: a.title,
            subtitle: 'Campus announcement',
            icon: MdCampaign,
            path: '/student/announcements',
          }));

          const { data: resources } = await supabase
            .from('resources')
            .select('id, title, file_name')
            .or(`title.ilike.%${q}%,file_name.ilike.%${q}%`)
            .limit(4);
          if (resources?.length) newResults['Resources'] = resources.map((r) => ({
            id: r.id,
            title: r.title,
            subtitle: r.file_name || 'Study material',
            icon: MdFolder,
            path: '/student/resources',
          }));
        }

        if (isMounted) {
          setResults(newResults);
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }, 280);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [query, isOpen, role, isQueryValid]);

  const handleClose = () => {
    setQuery('');
    setResults({});
    onClose();
  };

  // Flatten results for keyboard navigation
  const flatItems = Object.entries(results).flatMap(([group, items]) =>
    items.map((it) => ({ ...it, group }))
  );

  const handleSelect = useCallback(
    (item) => {
      setQuery('');
      setResults({});
      onClose();
      if (item?.path) navigate(item.path);
    },
    [navigate, onClose]
  );

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      handleClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1 < flatItems.length ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : flatItems.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flatItems[selectedIndex]) {
        handleSelect(flatItems[selectedIndex]);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-label="Global Search"
      style={{ alignItems: 'flex-start', paddingTop: '10vh' }}
    >
      <div
        className="modal"
        style={{
          maxWidth: '620px',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 20px 45px rgba(17, 47, 66, 0.2)',
          padding: 0,
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '1rem 1.25rem',
            borderBottom: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
            gap: '0.75rem',
          }}
        >
          <MdSearch style={{ fontSize: '1.4rem', color: 'var(--color-primary)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (e.target.value.trim().length < 2) {
                setResults({});
                setLoading(false);
              }
            }}
            placeholder={`Search ${role === 'admin' ? 'students, faculty, courses...' : 'courses, announcements, resources...'} (Press Esc to close)`}
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              fontSize: '1rem',
              color: 'var(--color-text)',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
          {loading && (
            <div className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }} />
          )}
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close search"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              fontSize: '1.25rem',
              display: 'flex',
              padding: '2px',
            }}
          >
            <MdClose />
          </button>
        </div>

        {/* Results area */}
        <div style={{ maxHeight: '420px', overflowY: 'auto', padding: '0.75rem' }}>
          {query.trim().length > 0 && query.trim().length < 2 && (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
              Type at least 2 characters to search...
            </div>
          )}

          {query.trim().length >= 2 && !loading && flatItems.length === 0 && (
            <div style={{ padding: '2rem 1rem', textAlign: 'center' }}>
              <div style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: '0.25rem' }}>
                No results found for "{query}"
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                Try searching by course code, matricule, staff ID or name.
              </div>
            </div>
          )}

          {Object.entries(results).map(([groupName, items]) => (
            <div key={groupName} style={{ marginBottom: '0.75rem' }}>
              <div
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--color-text-muted)',
                  padding: '0.35rem 0.6rem',
                }}
              >
                {groupName}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {items.map((item) => {
                  const globalIdx = flatItems.findIndex((fi) => fi.id === item.id && fi.group === groupName);
                  const isSelected = globalIdx === selectedIndex;
                  const Icon = item.icon || MdArrowForward;

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelect(item)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.6rem 0.75rem',
                        borderRadius: 'var(--radius-sm)',
                        background: isSelected ? 'rgba(17, 47, 66, 0.08)' : 'transparent',
                        cursor: 'pointer',
                        transition: 'background 0.1s ease',
                      }}
                      onMouseEnter={() => setSelectedIndex(globalIdx)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '6px',
                            background: isSelected ? 'var(--color-primary)' : 'rgba(17, 47, 66, 0.06)',
                            color: isSelected ? '#fff' : 'var(--color-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1rem',
                            flexShrink: 0,
                          }}
                        >
                          <Icon />
                        </div>
                        <div>
                          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>
                            {item.title}
                          </div>
                          {item.subtitle && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                              {item.subtitle}
                            </div>
                          )}
                        </div>
                      </div>
                      <MdArrowForward
                        style={{
                          fontSize: '1rem',
                          color: isSelected ? 'var(--color-primary)' : 'var(--color-border)',
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer shortcuts helper */}
        <div
          style={{
            padding: '0.5rem 1rem',
            background: 'var(--color-bg)',
            borderTop: '1px solid var(--color-border)',
            fontSize: '0.72rem',
            color: 'var(--color-text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>Use <strong>↑</strong> <strong>↓</strong> to navigate, <strong>Enter</strong> to select</span>
          <span><strong>Esc</strong> to close</span>
        </div>
      </div>
    </div>
  );
}
