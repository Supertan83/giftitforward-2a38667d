/**
 * Maps database and API errors to user-friendly messages
 * Prevents information leakage while still being helpful
 */

interface PostgresError {
  code?: string;
  message?: string;
  details?: string;
}

export const mapDatabaseError = (error: unknown): string => {
  // Log full error for debugging (server-side only in production)
  console.error('Database error:', error);
  
  const pgError = error as PostgresError;
  
  // Map specific PostgreSQL error codes to user-friendly messages
  if (pgError?.code) {
    switch (pgError.code) {
      case '23505': // unique_violation
        return 'This item already exists';
      case '23503': // foreign_key_violation
        return 'Referenced item not found';
      case '23502': // not_null_violation
        return 'Required information is missing';
      case '22P02': // invalid_text_representation
        return 'Invalid data format provided';
      case '42501': // insufficient_privilege (RLS)
        return 'Access denied';
      case '42P01': // undefined_table
        return 'Operation failed. Please try again.';
      default:
        break;
    }
  }
  
  // Map common error messages
  const message = pgError?.message?.toLowerCase() || '';
  
  if (message.includes('rls') || message.includes('row-level security')) {
    return 'Access denied';
  }
  
  if (message.includes('not found')) {
    return 'The requested item was not found';
  }
  
  if (message.includes('duplicate') || message.includes('unique')) {
    return 'This item already exists';
  }
  
  if (message.includes('timeout') || message.includes('connection')) {
    return 'Connection issue. Please try again.';
  }
  
  // Generic fallback
  return 'An error occurred. Please try again.';
};

export const mapAuthError = (error: unknown): string => {
  console.error('Auth error:', error);
  
  const authError = error as { message?: string; status?: number };
  const message = authError?.message?.toLowerCase() || '';
  
  if (message.includes('invalid login')) {
    return 'Invalid email or password';
  }
  
  if (message.includes('email not confirmed')) {
    return 'Please confirm your email address';
  }
  
  if (message.includes('already registered') || message.includes('already exists')) {
    return 'This email is already registered';
  }
  
  if (message.includes('rate limit') || message.includes('too many')) {
    return 'Too many attempts. Please try again later.';
  }
  
  if (message.includes('weak password')) {
    return 'Please use a stronger password';
  }
  
  if (authError?.status === 401) {
    return 'Session expired. Please log in again.';
  }
  
  return 'Authentication failed. Please try again.';
};

/**
 * Creates a safe error to throw that won't expose internal details
 */
export class SafeError extends Error {
  constructor(userMessage: string, originalError?: unknown) {
    super(userMessage);
    this.name = 'SafeError';
    // Log original error for debugging
    if (originalError) {
      console.error('Original error:', originalError);
    }
  }
}