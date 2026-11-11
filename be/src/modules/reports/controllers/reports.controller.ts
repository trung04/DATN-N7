import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../authorization/decorators/roles.decorator';
import { UserEntity, UserRole } from '../../users/entities/user.entity';
import { ReportQueryRequest } from '../dtos/report-query.request';
import { ReportSummaryResponse, ReportTimeseriesResponse } from '../dtos/report.response';
import { ReportsService } from '../services/reports.service';

@ApiTags('Reports')
@Roles(UserRole.ADMIN, UserRole.HOTEL_OWNER)
@Controller({ path: 'reports', version: '1' })
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  summary(
    @CurrentUser() actor: UserEntity,
    @Query() query: ReportQueryRequest,
  ): Promise<ReportSummaryResponse> {
    return this.reportsService.summary(query, actor);
  }

  @Get('timeseries')
  timeseries(
    @CurrentUser() actor: UserEntity,
    @Query() query: ReportQueryRequest,
  ): Promise<ReportTimeseriesResponse> {
    return this.reportsService.timeseries(query, actor);
  }
}
