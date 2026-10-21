export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

export const notFound = (what: string) => new HttpError(404, `${what} não encontrado(a)`);
export const forbidden = (msg = 'Acesso negado') => new HttpError(403, msg);
