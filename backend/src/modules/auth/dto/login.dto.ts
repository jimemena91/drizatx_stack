// src/modules/auth/dto/login.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator'
import { Transform } from 'class-transformer'

/**
 * Decorador custom → exige que al menos venga email o username
 */
function OneOfEmailOrUsername(validationOptions?: ValidationOptions) {
  return function (object: any, propertyName: string) {
    registerDecorator({
      name: 'OneOfEmailOrUsername',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(_: any, args: ValidationArguments) {
          const { email, username } = args.object as any
          return (
            (typeof email === 'string' && email.trim() !== '') ||
            (typeof username === 'string' && username.trim() !== '')
          )
        },
        defaultMessage() {
          return 'Debes enviar email o username.'
        },
      },
    })
  }
}

export class LoginDto {
  @ApiPropertyOptional({
    description: 'Email (alternativo a username)',
    example: 'admin@drizatx.com',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email?: string

  @ApiPropertyOptional({
    description: 'Username (alternativo a email)',
    example: 'admin',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  username?: string

  @ApiProperty({
    description: 'Password',
    minLength: 3,
    example: 'admin123',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(3) // 👈 ahora coincide con el mínimo que dijiste
  @OneOfEmailOrUsername()
  password!: string
}
