import { IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class AdminUpdatePasswordDto {
  @IsString()
  @MinLength(1, { message: 'La contraseña es requerida.' })
  @MaxLength(10, { message: 'La contraseña no debe superar 10 caracteres.' })
  
  password!: string;
}
