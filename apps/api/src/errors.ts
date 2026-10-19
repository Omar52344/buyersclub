export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 400,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Recurso no encontrado') {
    super('NOT_FOUND', message, 404);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'No tienes permiso para esta acción') {
    super('FORBIDDEN', message, 403);
  }
}
