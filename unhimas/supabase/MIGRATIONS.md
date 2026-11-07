# Database Migrations

The ordered `migrations/*.sql` files are the database source of truth. Apply every migration in timestamp order to each Supabase environment before deploying the matching application build.

## Academic years and resits

Apply `20261107000000_academic_year_semester_resits.sql` to enable the academic-year lifecycle:

- Creating an academic year atomically creates First Semester, Second Semester, and a Resit Period.
- Activating an academic year opens registration for its first semester. Moving forward closes the previous semester's registration and opens the next.
- Entering the Resit Period creates course offerings from that year's regular semesters.
- A student can register for a resit offering only when their latest published result for that batch/course is a failure. Resit marks are seeded only for registered, eligible students.
- Published attempts remain in the academic record; GPA and course-performance summaries use the latest published attempt for each course.

The migration is safe to re-run. Apply it before using the academic-year or resit workflows in the application.
