import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class PublishAgreementDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title!: string;

  /*
    Plain text with light structure: a line starting with "## " is a heading,
    "- " a bullet, a blank line separates paragraphs. Long enough for a real
    agreement, short enough that nobody pastes a whole contract PDF in.
  */
  @IsString()
  @MinLength(50)
  @MaxLength(60_000)
  body!: string;
}

export class SignAgreementDto {
  @IsUUID()
  propertyId!: string;

  /*
    The typed signature. Two words minimum is not enforced — some people have
    one name — but three characters keeps "x" from counting as a signature.
  */
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  signatureName!: string;
}
