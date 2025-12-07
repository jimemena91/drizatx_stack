import { IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class AdminUpdatePasswordDto {
  @IsString()
  @MinLength(3, { message: 'La contraseña debe tener al menos 3 caracteres.' })
  @MaxLength(10, { message: 'La contraseña no debe superar 10 caracteres.' })
  
  password!: string;
}
