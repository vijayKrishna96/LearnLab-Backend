class APIResponse {
  static success(data, message = "Success", statusCode = 200) {
    return {
      success: true,
      statusCode,
      message,
      data
    };
  }

  static error(message, statusCode = 500, errors = null) {
    return {
      success: false,
      statusCode,
      message,
      ...(errors && { errors }) // Include validation errors if present
    };
  }

  static paginated(data, page, limit, total, message = "Success") {
    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      message,
      data,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages,
        hasNextPage: Number(page) < totalPages
      }
    };
  }
}

module.exports = APIResponse;
