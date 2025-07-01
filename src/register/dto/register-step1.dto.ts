import { IsEmail, IsOptional, IsString, ValidateIf, Validate, ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

@ValidatorConstraint({ name: 'AtLeastOneField', async: false })
export class AtLeastOneFieldConstraint implements ValidatorConstraintInterface {
  validate(_value: any, args: ValidationArguments) {
    const object = args.object as RegisterStep1Dto;
    return !!(object.phone || object.email);
  }

  defaultMessage(_args: ValidationArguments) {
    return 'Phải cung cấp ít nhất một trong số điện thoại hoặc email';
  }
}

export class RegisterStep1Dto {
  @ApiProperty({
    description: 'Số điện thoại của người dùng',
    example: '0987654321',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Số điện thoại phải là chuỗi' })
  @ValidateIf((o: RegisterStep1Dto) => !o.email || !!o.phone)
  phone?: string;

  @ApiProperty({
    description: 'Email của người dùng',
    example: 'user@example.com',
    required: false,
  })
  @IsOptional()
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @ValidateIf((o: RegisterStep1Dto) => !o.phone || !!o.email)
  email?: string;

  @Validate(AtLeastOneFieldConstraint)
  _atLeastOneField?: any;
}
