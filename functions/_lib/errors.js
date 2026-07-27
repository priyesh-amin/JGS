export class AppError extends Error {
  constructor(status, code, message, details = undefined) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function isUniqueConstraintError(error) {
  const message = String(error?.message || error);
  return message.includes('UNIQUE constraint failed');
}

