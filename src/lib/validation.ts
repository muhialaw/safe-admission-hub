interface ValidationResult {
  valid: boolean;
  error?: string;
  errors?: string[];
}

export const validateEmail = (email: string): ValidationResult => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    return {
      valid: false,
      error: 'Please enter a valid email address',
    };
  }
  return { valid: true };
};

export const validatePassword = (password: string): ValidationResult => {
  const errors: string[] = [];

  if (!password) {
    return {
      valid: false,
      error: 'Password is required',
      errors: ['Password is required'],
    };
  }

  if (password.length < 8) {
    errors.push('At least 8 characters');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('At least one lowercase letter');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('At least one uppercase letter');
  }

  if (!/\d/.test(password)) {
    errors.push('At least one number');
  }

  if (errors.length > 0) {
    return {
      valid: false,
      error: `Password must include: ${errors.join(', ')}`,
      errors,
    };
  }

  return { valid: true };
};

export const validateName = (name: string): ValidationResult => {
  if (!name || name.trim().length < 2) {
    return {
      valid: false,
      error: 'Name must be at least 2 characters',
    };
  }

  if (name.trim().length > 100) {
    return {
      valid: false,
      error: 'Name must not exceed 100 characters',
    };
  }

  return { valid: true };
};
