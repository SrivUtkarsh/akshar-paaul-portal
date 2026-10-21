// Small helpers shared by routes. asyncRoute forwards promise errors to Express.
export const asyncRoute = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

export function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
