# Database Migrations

The ordered `migrations/*.sql` files are the database source of truth. Apply every migration in timestamp order to each Supabase environment before deploying the matching application build.

## Academic years and resits

Apply `20261107000000_academic_year_semester_resits.sql` to enable the academic-year lifecycle:

- Creating an academic year atomically creates First Semester, Second Semester, and a Resit Period.
- Semester numbering allows `3` for the Resit Period; `1` and `2` remain the regular semesters.
- Activating an academic year opens registration for its first semester. Moving forward closes the previous semester's registration and opens the next.
- Entering the Resit Period creates course offerings from that year's regular semesters.
- A student can register for a resit offering only when their latest published result for that batch/course is a failure.
- Apply `20261110000000_automatic_resit_mark_roster.sql` after the resit migration so lecturers automatically see every active student whose latest published attempt failed, regardless of course-registration status.
- Published attempts remain in the academic record; GPA and course-performance summaries use the latest published attempt for each course.

Manage academic years and their semester periods together on the Admin → Structure → Years page. The old `/admin/semesters` URL redirects there.

The migration is safe to re-run. Apply it before using the academic-year or resit workflows in the application.

## Student payment workflow

Apply `20261109000000_student_payment_workflow.sql` after the fees/payments and resit migrations. It adds a protected student RPC for creating invoices for eligible resit courses at 2,500 XAF per course and prevents the same resit offering from being invoiced twice.

The student dashboard links to school-fee, registration, resit, and other payment categories. Tuition and registration invoices are still issued by administration using the configured fee structures; students may pay any amount up to the invoice balance once checkout is enabled. Completed payments have downloadable PDF receipts with the payment UUID, payment reference, and receipt number.

Direct MTN MoMo and Orange Money checkout is not yet configured. The student checkout remains disabled until provider sandbox accounts, secrets, and callback handling are configured; do not treat an invoice or payment attempt as proof of payment.
