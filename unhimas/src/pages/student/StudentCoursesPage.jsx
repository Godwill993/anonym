import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  MdBook,
  MdHowToReg,
  MdRemoveCircleOutline,
  MdInfo,
  MdLock,
  MdAccountBalanceWallet,
} from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../i18n';
import { useToast } from '../../hooks/useToast';
import { getMyStudentProfile, getMyStudentCourses } from '../../services/studentService';
import {
  getCurrentSemesterForStudent,
  listBatchCoursesForSemester,
  listMyRegistrations,
  registerForCourse,
  dropCourse,
  attachRegistrationState,
  isRegistrationWindowOpen,
  registrationRequiresFeeClearance,
} from '../../services/courseRegistrationService';
import { checkFeeClearance } from '../../services/feeClearance';
import { formatXAF } from '../../services/feesService';

export default function StudentCoursesPage() {
  const { session } = useAuth();
  const { translateText } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: studentProfile, isLoading: profileLoading } = useQuery({
    queryKey: ['my-student-profile'],
    queryFn: getMyStudentProfile,
    enabled: !!session,
  });

  const batchId = studentProfile?.batch_id;
  const studentId = studentProfile?.id;

  const { data: semester, isLoading: semLoading } = useQuery({
    queryKey: ['current-semester-student', batchId],
    queryFn: () => getCurrentSemesterForStudent(studentProfile),
    enabled: !!studentProfile,
  });

  const { data: allCourses = [], isLoading: allLoading } = useQuery({
    queryKey: ['my-student-courses', batchId],
    queryFn: () => getMyStudentCourses(batchId),
    enabled: !!batchId,
  });

  const { data: semesterCourses = [], isLoading: semCoursesLoading } = useQuery({
    queryKey: ['semester-batch-courses', batchId, semester?.id],
    queryFn: () => listBatchCoursesForSemester(batchId, semester.id),
    enabled: !!batchId && !!semester?.id,
  });

  const { data: registrations = [], isLoading: regLoading } = useQuery({
    queryKey: ['my-course-registrations', studentId],
    queryFn: () => listMyRegistrations(studentId),
    enabled: !!studentId,
  });

  const { data: clearance } = useQuery({
    queryKey: ['fee-clearance', studentId],
    queryFn: () => checkFeeClearance(studentId),
    enabled: !!studentId,
  });

  const { data: needFeeForReg = true } = useQuery({
    queryKey: ['reg-fee-policy'],
    queryFn: registrationRequiresFeeClearance,
  });

  const windowOpen = isRegistrationWindowOpen(semester);
  const feeBlocksReg =
    needFeeForReg && clearance?.required && clearance?.cleared === false;

  const currentWithReg = useMemo(
    () => attachRegistrationState(semesterCourses, registrations),
    [semesterCourses, registrations],
  );

  const registeredCount = currentWithReg.filter((c) => c.isRegistered).length;
  const optionalOpen = currentWithReg.filter((c) => !c.is_compulsory && !c.isRegistered).length;

  const registerMutation = useMutation({
    mutationFn: (batchCourseId) =>
      registerForCourse({
        studentId,
        batchCourseId,
        student: studentProfile,
      }),
    onSuccess: () => {
      toast.success(translateText('Registered successfully'));
      queryClient.invalidateQueries({ queryKey: ['my-course-registrations', studentId] });
    },
    onError: (err) => {
      if (err?.code === 'FEE_CLEARANCE') {
        toast.error(
          translateText('Settle outstanding fees before registering') +
            (err.outstanding != null ? ` (${formatXAF(err.outstanding)})` : ''),
        );
      } else {
        toast.error(err?.message || translateText('Registration failed'));
      }
    },
  });

  const dropMutation = useMutation({
    mutationFn: (batchCourseId) =>
      dropCourse({
        studentId,
        batchCourseId,
        student: studentProfile,
      }),
    onSuccess: () => {
      toast.success(translateText('Course dropped'));
      queryClient.invalidateQueries({ queryKey: ['my-course-registrations', studentId] });
    },
    onError: (err) => {
      toast.error(err?.message || translateText('Could not drop course'));
    },
  });

  const isLoading = profileLoading || semLoading || allLoading || semCoursesLoading || regLoading;

  return (
    <AppLayout pageTitle="My Courses">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">{translateText('My Courses')}</h1>
          <p className="page-subtitle">
            {semester
              ? `${translateText('Current semester')}: ${semester.name}`
              : translateText('Courses for your batch')}
          </p>
        </div>
      </div>

      {feeBlocksReg && (
        <div className="alert-banner alert-banner-danger" style={{ marginBottom: '0.85rem' }} role="status">
          <MdAccountBalanceWallet size={18} aria-hidden="true" />
          <span>
            {translateText('Outstanding fees block new course registration.')}{' '}
            {clearance?.outstanding != null && (
              <strong>{formatXAF(clearance.outstanding)}</strong>
            )}{' '}
            <Link to="/student/fees">{translateText('Pay fees')}</Link>
          </span>
        </div>
      )}

      {semester && (
        <div className="alert-banner" style={{ marginBottom: '1.15rem' }} role="status">
          {windowOpen ? (
            <MdInfo size={18} aria-hidden="true" />
          ) : (
            <MdLock size={18} aria-hidden="true" />
          )}
          <span>
            {windowOpen ? (
              <>
                {translateText('Registration is open for optional courses.')}
                {semester.registration_closes_at && (
                  <>
                    {' '}
                    {translateText('Closes')}:{' '}
                    {new Date(semester.registration_closes_at).toLocaleString()}
                  </>
                )}
              </>
            ) : (
              <>
                {translateText(
                  'Registration is closed. Compulsory courses remain on your list; optional adds are locked.',
                )}
              </>
            )}
            {' · '}
            {translateText('Registered')}: <strong>{registeredCount}</strong>
            {optionalOpen > 0 && windowOpen && (
              <>
                {' · '}
                {translateText('Available optional')}: {optionalOpen}
              </>
            )}
          </span>
        </div>
      )}

      <div className="section-heading">
        <h2>{translateText('Current semester courses')}</h2>
        {semester && <span className="section-meta">{semester.name}</span>}
      </div>

      {isLoading ? (
        <div className="entity-grid">
          {[1, 2, 3].map((i) => (
            <div key={i} className="entity-card">
              <div className="skeleton skeleton-title" style={{ width: '70%', marginBottom: 8 }} />
              <div className="skeleton skeleton-text" style={{ width: '50%' }} />
            </div>
          ))}
        </div>
      ) : !semester ? (
        <div className="empty-state card">
          <div className="empty-state-title">{translateText('No current semester')}</div>
          <p className="empty-state-text">
            {translateText('Ask administration to mark a semester as current.')}
          </p>
        </div>
      ) : currentWithReg.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-state-icon">
            <MdBook />
          </div>
          <div className="empty-state-title">{translateText('No courses for this semester')}</div>
        </div>
      ) : (
        <div className="entity-grid animate-stagger">
          {currentWithReg.map((bc) => (
            <article key={bc.id} className="entity-card">
              <div className="entity-card-top">
                <span className="badge badge-blue">{bc.courses?.code}</span>
                <div className="entity-card-badges">
                  {bc.is_compulsory ? (
                    <span className="badge badge-gray">{translateText('Compulsory')}</span>
                  ) : (
                    <span className="badge badge-amber">{translateText('Optional')}</span>
                  )}
                  {bc.isRegistered ? (
                    <span className="badge badge-green">{translateText('Registered')}</span>
                  ) : (
                    <span className="badge badge-muted">{translateText('Not registered')}</span>
                  )}
                </div>
              </div>
              <div className="entity-card-title">{bc.courses?.name}</div>
              <div className="entity-card-meta">
                {bc.courses?.credit_units} {translateText('credit unit(s)')}
              </div>
              <div className="entity-card-meta">
                <strong>{translateText('Lecturer')}:</strong>{' '}
                {bc.lecturers
                  ? `${bc.lecturers.first_name} ${bc.lecturers.last_name}`
                  : '—'}
              </div>

              {!bc.is_compulsory && (
                <div className="entity-card-actions">
                  {bc.canRegister && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={
                        !windowOpen || feeBlocksReg || registerMutation.isPending
                      }
                      onClick={() => registerMutation.mutate(bc.id)}
                    >
                      <MdHowToReg aria-hidden="true" /> {translateText('Register')}
                    </button>
                  )}
                  {bc.canDrop && (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      disabled={!windowOpen || dropMutation.isPending}
                      onClick={() => dropMutation.mutate(bc.id)}
                    >
                      <MdRemoveCircleOutline aria-hidden="true" /> {translateText('Drop')}
                    </button>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {allCourses.length > 0 && (
        <>
          <div className="section-heading">
            <h2>{translateText('All batch courses')}</h2>
            <span className="section-meta">{allCourses.length}</span>
          </div>
          <div className="entity-grid">
            {allCourses.map((bc) => (
              <article key={bc.id} className="entity-card" style={{ opacity: 0.92 }}>
                <div className="entity-card-top">
                  <span className="badge badge-blue">{bc.courses?.code}</span>
                  {bc.is_compulsory ? (
                    <span className="badge badge-gray">{translateText('Compulsory')}</span>
                  ) : (
                    <span className="badge badge-amber">{translateText('Optional')}</span>
                  )}
                </div>
                <div className="entity-card-title">{bc.courses?.name}</div>
                <div className="entity-card-meta">
                  {bc.semesters?.name}
                  {bc.semesters?.is_current && (
                    <span className="badge badge-green" style={{ marginLeft: 6 }}>
                      {translateText('Current')}
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </AppLayout>
  );
}
