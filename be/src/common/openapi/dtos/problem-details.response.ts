import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProblemValidationErrorResponse {
  @ApiProperty({ example: 'name should not be empty' })
  message: string;
}

export class ProblemDetailsResponse {
  @ApiProperty({ example: 'about:blank' })
  type: string;

  @ApiProperty({ example: 'Bad Request' })
  title: string;

  @ApiProperty({ example: 400 })
  status: number;

  @ApiProperty({ example: 'Request validation failed.' })
  detail: string;

  @ApiProperty({ example: '/api/v1/places' })
  instance: string;

  @ApiProperty({ example: 'VALIDATION_FAILED' })
  code: string;

  @ApiPropertyOptional({ example: 'request-id-123' })
  traceId?: string;

  @ApiPropertyOptional({ type: [ProblemValidationErrorResponse] })
  errors?: ProblemValidationErrorResponse[];
}
