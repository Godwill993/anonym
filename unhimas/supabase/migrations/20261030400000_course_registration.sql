-- Student course registration (optional courses within a batch)
-- Compulsory batch_courses are treated as always registered in the app layer.

CREATE TABLE IF NOT EXISTS public.student_course_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students (id) ON DELETE CASCADE,
  batch_course_id uuid NOT NULL REFERENCES public.batch_courses (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'registered'
    CHECK (status IN ('registered', 'dropped')),
  registered_at timestamptz NOT NULL DEFAULT now(),
  dropped_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, batch_course_id)
);

CREATE INDEX IF NOT EXISTS idx_scr_student ON public.student_course_registrations (student_id);
CREATE INDEX IF NOT EXISTS idx_scr_batch_course ON public.student_course_registrations (batch_course_id);
CREATE INDEX IF NOT EXISTS idx_scr_status ON public.student_course_registrations (status);

-- Registration window on semesters (safe if columns already exist)
ALTER TABLE public.semesters
  ADD COLUMN IF NOT EXISTS registration_open boolean NOT NULL DEFAULT false;

ALTER TABLE public.semesters
  ADD COLUMN IF NOT EXISTS registration_closes_at timestamptz;

COMMENT ON COLUMN public.semesters.registration_open IS
  'When true, students may register/drop optional courses for this semester';

-- RLS
ALTER TABLE public.student_course_registrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS scr_select_own ON public.student_course_registrations;
CREATE POLICY scr_select_own ON public.student_course_registrations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_id AND s.profile_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'lecturer')
    )
  );

DROP POLICY IF EXISTS scr_insert_own ON public.student_course_registrations;
CREATE POLICY scr_insert_own ON public.student_course_registrations
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_id AND s.profile_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS scr_update_own ON public.student_course_registrations;
CREATE POLICY scr_update_own ON public.student_course_registrations
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_id AND s.profile_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Seed setting for fee gate on registration (optional)
INSERT INTO public.system_settings (key, value)
VALUES (
  'course_registration',
  '{"require_fee_clearance": true}'::jsonb
)
ON CONFLICT (key) DO NOTHING;
