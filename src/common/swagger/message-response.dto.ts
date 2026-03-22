import { ApiProperty } from '@nestjs/swagger';

/** Standard JSON message envelope (used in Swagger response models). */
export class MessageResponseDto {
  @ApiProperty({ example: 'Operation completed successfully' })
  message: string;
}
