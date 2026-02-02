export function notFound(req, res) {
  res.status(400).json({ error: 'Route not found' });
}

export function errorHandler(err, req, res) {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Something went wrong...' });
}
