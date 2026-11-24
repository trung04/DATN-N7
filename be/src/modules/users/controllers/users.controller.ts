import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import {
  ApiCreateOperation,
  ApiDeleteOperation,
  ApiDetailOperation,
  ApiListOperation,
  ApiNoContentOperation,
  ApiUpdateOperation,
} from '../../../common/openapi/api-crud.decorator';
import { CreateUserRequest } from '../dtos/requests/create-user.request';
import { ListUsersRequest } from '../dtos/requests/list-users.request';
import { ResetUserPasswordRequest } from '../dtos/requests/reset-user-password.request';
import { UpdateUserRequest } from '../dtos/requests/update-user.request';
import {
  UserListResponse,
  UserResponse,
} from '../dtos/responses/user.response';
import { UserMapper } from '../mappers/user.mapper';
import { UsersService } from '../services/users.service';

@ApiTags('Users')
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiCreateOperation('Create a user', UserResponse)
  async create(
    @Body() input: CreateUserRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<UserResponse> {
    const user = await this.usersService.create(input);
    response.setHeader('Location', `/api/v1/users/${user.id}`);
    return UserMapper.toResponse(user);
  }

  @Get()
  @ApiListOperation('List users', UserListResponse)
  async findPage(@Query() query: ListUsersRequest): Promise<UserListResponse> {
    const page = await this.usersService.findPage(query);
    return UserMapper.toListResponse(
      page.items,
      query.page,
      query.limit,
      page.total,
    );
  }

  @Get(':userId')
  @ApiDetailOperation('Get a user', UserResponse, 'userId')
  async findById(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<UserResponse> {
    return UserMapper.toResponse(await this.usersService.findById(id));
  }

  @Patch(':userId')
  @ApiUpdateOperation('Update a user', UserResponse, 'userId')
  async update(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() input: UpdateUserRequest,
  ): Promise<UserResponse> {
    return UserMapper.toResponse(await this.usersService.update(id, input));
  }

  @Put(':userId/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentOperation(
    'Reset a user password',
    'userId',
    'Password reset successfully.',
  )
  async resetPassword(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() input: ResetUserPasswordRequest,
  ): Promise<void> {
    await this.usersService.resetPassword(id, input);
  }

  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiDeleteOperation('Delete a user', 'userId')
  async delete(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<void> {
    await this.usersService.delete(id);
  }
}
