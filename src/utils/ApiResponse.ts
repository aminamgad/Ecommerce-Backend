export interface ApiSuccessResponse<T> {
  success: true;
  message: string;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  errors?: string[];
}

export function successResponse<T>(
  message: string,
  data: T
): ApiSuccessResponse<T> {
  return {
    success: true,
    message,
    data,
  };
}

export function errorResponse(
  message: string,
  errors?: string[]
): ApiErrorResponse {
  return {
    success: false,
    message,
    ...(errors && errors.length > 0 ? { errors } : {}),
  };
}
