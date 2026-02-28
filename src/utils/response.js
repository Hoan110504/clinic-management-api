/**
 * Response Helpers
 * Standardized API response format
 */

/**
 * Success response
 * @param {Object} res - Express response object
 * @param {any} data - Response data
 * @param {string} message - Success message
 * @param {number} statusCode - HTTP status code
 */
const successResponse = (res, data = null, message = 'Thành công', statusCode = 200) => {
  const response = {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  };

  return res.status(statusCode).json(response);
};

/**
 * Created response (201)
 * @param {Object} res - Express response object
 * @param {any} data - Created resource data
 * @param {string} message - Success message
 */
const createdResponse = (res, data = null, message = 'Tạo mới thành công') => {
  return successResponse(res, data, message, 201);
};

/**
 * No content response (204)
 * @param {Object} res - Express response object
 */
const noContentResponse = (res) => {
  return res.status(204).send();
};

/**
 * Paginated response
 * @param {Object} res - Express response object
 * @param {Object} options - Pagination options
 */
const paginatedResponse = (res, {
  data,
  page,
  limit,
  total,
  message = 'Thành công',
}) => {
  const totalPages = Math.ceil(total / limit);
  
  const response = {
    success: true,
    message,
    data,
    pagination: {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
    timestamp: new Date().toISOString(),
  };

  return res.status(200).json(response);
};

/**
 * Error response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code
 * @param {string} code - Error code
 * @param {Array} details - Error details
 */
const errorResponse = (
  res,
  message = 'Đã có lỗi xảy ra',
  statusCode = 500,
  code = 'INTERNAL_ERROR',
  details = null
) => {
  const response = {
    success: false,
    error: {
      code,
      message,
      statusCode,
      timestamp: new Date().toISOString(),
    },
  };

  if (details) {
    response.error.details = details;
  }

  return res.status(statusCode).json(response);
};

module.exports = {
  successResponse,
  createdResponse,
  noContentResponse,
  paginatedResponse,
  errorResponse,
};
