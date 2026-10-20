export type PasswordStrength = 'weak' | 'medium' | 'strong';

export interface PasswordStrengthResult {
  score: 0 | 1 | 2 | 3;
  strength: PasswordStrength;
}

function hasLowercase(value: string) {
  return /[a-z]/.test(value);
}

function hasUppercase(value: string) {
  return /[A-Z]/.test(value);
}

function hasDigit(value: string) {
  return /\d/.test(value);
}

function hasSpecial(value: string) {
  return /[^A-Za-z0-9]/.test(value);
}

export function isAcceptedRegisterPassword(value: string) {
  return value.length >= 8 && hasLowercase(value) && hasUppercase(value) && hasDigit(value);
}

export function evaluatePasswordStrength(value: string): PasswordStrengthResult {
  if (!value) {
    return { score: 0, strength: 'weak' };
  }

  let score = 0;

  if (value.length >= 8) {
    score += 1;
  }

  if (hasLowercase(value) && hasUppercase(value)) {
    score += 1;
  }

  if (hasDigit(value)) {
    score += 1;
  }

  if (value.length >= 12 || hasSpecial(value)) {
    score = Math.min(3, score + 1);
  }

  if (score <= 1) {
    return { score: Math.max(1, score) as 1, strength: 'weak' };
  }

  if (score === 2) {
    return { score: 2, strength: 'medium' };
  }

  return { score: 3, strength: 'strong' };
}
