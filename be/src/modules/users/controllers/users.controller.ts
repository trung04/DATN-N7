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
import type { Response } from 'express';
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

@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  async create(
    @Body() input: CreateUserRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<UserResponse> {
    const user = await this.usersService.create(input);
    response.setHeader('Location', `/api/v1/users/${user.id}`);
    return UserMapper.toResponse(user);
  }

  @Get()
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
  async findById(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<UserResponse> {
    return UserMapper.toResponse(await this.usersService.findById(id));
  }

  @Patch(':userId')
  async update(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() input: UpdateUserRequest,
  ): Promise<UserResponse> {
    return UserMapper.toResponse(await this.usersService.update(id, input));
  }

  @Put(':userId/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() input: ResetUserPasswordRequest,
  ): Promise<void> {
    await this.usersService.resetPassword(id, input);
  }

  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<void> {
    await this.usersService.delete(id);
  }
}
