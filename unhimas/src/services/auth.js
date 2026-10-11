import { supabase, supabaseSignup } from '../lib/supabase';

/**
 * Create an Auth user with the public sign-up API, then link it to its school
 * record through an RPC authorized for active administrators. The isolated
 * Auth client prevents sign-up from replacing the administrator's session.
 */
export async function createSchoolAccount({ recordType, record }) {
  const email = record.email?.trim();
  const defaultPassword = recordType === 'student'
    ? record.matricule?.trim()
    : record.staff_id?.trim();

  if (!email) throw new Error('Add an email address to this record before creating an account.');
  if (!defaultPassword) throw new Error('The student matricule or lecturer staff ID is required as the temporary password.');

  const fullName = [record.first_name, record.middle_name, record.last_name]
    .filter(Boolean)
    .join(' ');

  const { data, error } = await supabaseSignup.auth.signUp({
    email,
    password: defaultPassword,
    options: {
      data: {
        full_name: fullName,
        login_id: defaultPassword,
      },
    },
  });

  if (error) {
    throw error;
  }

  if (!data.user?.id || data.user.identities?.length === 0) {
    throw new Error('Supabase did not return a new user. Check whether this email already has an Auth account.');
  }

  const { error: linkError } = await supabase.rpc('provision_school_account_direct', {
    p_user_id: data.user.id,
    p_record_type: recordType,
    p_record_id: record.id,
  });

  if (linkError) {
    throw new Error(
      `The Auth account was created, but linking it to the school record failed. ` +
      `Contact an administrator before retrying. ${linkError.message}`
    );
  }

  const emailConfirmationRequired = !data.session;
  return {
    success: true,
    email,
    emailConfirmationRequired,
    message: emailConfirmationRequired
      ? `Account created for ${fullName}. The user must confirm their email before signing in.`
      : `Account created for ${fullName}. They may now sign in with their ${recordType === 'student' ? 'matricule' : 'staff ID'} as the temporary password.`,
  };
}

/**
 * Clear the must_reset_password flag after the user has chosen a new password.
 * Calls a SECURITY DEFINER RPC that only touches the current user's own record.
 */
export async function clearMustResetPassword() {
  const { error } = await supabase.rpc('clear_must_reset_password');
  if (error) throw error;
}
