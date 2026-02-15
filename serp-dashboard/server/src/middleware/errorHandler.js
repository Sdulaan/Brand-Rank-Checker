function notFoundHandler(_req, res) {
  res.status(404).json({ message: 'Route not found' });
}

function errorHandler(err, _req, res, _next) {
  const status = err.statusCode || 500;
  const response = {
    message: err.message || 'Internal server error'
  };

  if (err.details) {
    response.details = err.details;
  }

  if (status >= 500) {
    console.error(err);
  }

  res.status(status).json(response);
}

module.exports = { notFoundHandler, errorHandler };
