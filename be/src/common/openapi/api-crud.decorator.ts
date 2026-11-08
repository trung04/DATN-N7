import { Type, applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
} from '@nestjs/swagger';
import { ProblemDetailsResponse } from './dtos/problem-details.response';

const validationError = ApiBadRequestResponse({
  description: 'Invalid request body, query, or path parameter.',
  type: ProblemDetailsResponse,
});

const notFoundError = ApiNotFoundResponse({
  description: 'The requested resource does not exist.',
  type: ProblemDetailsResponse,
});

const conflictError = ApiConflictResponse({
  description: 'The request conflicts with an existing resource.',
  type: ProblemDetailsResponse,
});

export function ApiCreateOperation(
  summary: string,
  responseType: Type<unknown>,
  options: { conflict?: boolean } = {},
): MethodDecorator {
  return applyDecorators(
    ApiOperation({ summary }),
    ApiCreatedResponse({
      description: 'Resource created successfully.',
      type: responseType,
      headers: {
        Location: {
          description: 'URL of the created resource.',
          schema: { type: 'string' },
        },
      },
    }),
    validationError,
    ...(options.conflict === false ? [] : [conflictError]),
  );
}

export function ApiListOperation(
  summary: string,
  responseType: Type<unknown>,
): MethodDecorator {
  return applyDecorators(
    ApiOperation({ summary }),
    ApiOkResponse({
      description: 'Paginated resource collection.',
      type: responseType,
    }),
    validationError,
  );
}

export function ApiDetailOperation(
  summary: string,
  responseType: Type<unknown>,
  parameterName: string,
): MethodDecorator {
  return applyDecorators(
    ApiOperation({ summary }),
    ApiParam({ name: parameterName, format: 'uuid' }),
    ApiOkResponse({ description: 'Resource details.', type: responseType }),
    validationError,
    notFoundError,
  );
}

export function ApiUpdateOperation(
  summary: string,
  responseType: Type<unknown>,
  parameterName: string,
  options: { conflict?: boolean } = {},
): MethodDecorator {
  return applyDecorators(
    ApiOperation({ summary }),
    ApiParam({ name: parameterName, format: 'uuid' }),
    ApiOkResponse({
      description: 'Resource updated successfully.',
      type: responseType,
    }),
    validationError,
    notFoundError,
    ...(options.conflict === false ? [] : [conflictError]),
  );
}

export function ApiDeleteOperation(
  summary: string,
  parameterName: string,
): MethodDecorator {
  return applyDecorators(
    ApiOperation({ summary }),
    ApiParam({ name: parameterName, format: 'uuid' }),
    ApiNoContentResponse({ description: 'Resource deleted successfully.' }),
    validationError,
    notFoundError,
  );
}

export function ApiNoContentOperation(
  summary: string,
  parameterName: string,
  description: string,
): MethodDecorator {
  return applyDecorators(
    ApiOperation({ summary }),
    ApiParam({ name: parameterName, format: 'uuid' }),
    ApiNoContentResponse({ description }),
    validationError,
    notFoundError,
  );
}
