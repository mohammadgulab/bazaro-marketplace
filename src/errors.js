// A small error type so routes can say "404, not found" in one line.
class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const notFound = (what = 'Resource') => new HttpError(404, `${what} not found`);

module.exports = { HttpError, notFound };
