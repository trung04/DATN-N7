import { Injectable } from '@nestjs/common';
import { hash, truncates } from 'bcryptjs';
import { PasswordTooLongException } from '../../exceptions/user.exceptions';
import type { PasswordHasher } from '../../interfaces/password-hasher.interface';

@Injectable()
export class BcryptPasswordHasher implements PasswordHasher {
  private readonly rounds = 12;

  async hash(password: string): Promise<string> {
    if (truncates(password)) throw new PasswordTooLongException();
    return await hash(password, this.rounds);
  }
}
