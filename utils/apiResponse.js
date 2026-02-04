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
    return {
      success: true,
      message,
      data,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit)
      }
    };
  }
}

export default APIResponse;