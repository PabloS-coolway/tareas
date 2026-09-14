import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PasswordHasher } from '../application/ports';

/** Adapter: hash de contraseñas con bcrypt (coste 10). */
@Injectable()
export class BcryptHasher implements PasswordHasher {
  private readonly rounds = 10;

  hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.rounds);
  }

  compare(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
