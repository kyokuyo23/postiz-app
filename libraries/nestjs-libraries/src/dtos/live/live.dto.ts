import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class LiveDestinationDto {
  @IsIn(['youtube', 'facebook', 'custom'])
  kind: 'youtube' | 'facebook' | 'custom';

  /** Connected channel (YouTube / Facebook Page). */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  integrationId?: string;

  /** Label for custom targets, e.g. "TikTok". */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  name?: string;

  /** Custom targets: server URL (rtmp:// or rtmps://). */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  serverUrl?: string;

  /** Custom targets: stream key. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  streamKey?: string;
}

export class LiveSessionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  /** RTMP = live from OBS/phone, VIDEO = a video from the media library. */
  @IsIn(['RTMP', 'VIDEO'])
  source: 'RTMP' | 'VIDEO';

  @IsDateString()
  scheduledAt: string;

  /** VIDEO: path of a video from the media library. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  mediaPath?: string;

  @IsOptional()
  @IsBoolean()
  loop?: boolean;

  /** VIDEO: total live time in minutes (required with loop). */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(720)
  durationMinutes?: number;

  @IsOptional()
  @IsIn(['public', 'unlisted'])
  privacy?: 'public' | 'unlisted';

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => LiveDestinationDto)
  destinations: LiveDestinationDto[];
}

/** Body MediaMTX sends to its HTTP auth hook. */
export class LiveAuthDto {
  @IsOptional() @IsString() @MaxLength(200) user?: string;
  @IsOptional() @IsString() @MaxLength(200) password?: string;
  @IsOptional() @IsString() @MaxLength(100) ip?: string;
  @IsOptional() @IsString() @MaxLength(30) action?: string;
  @IsOptional() @IsString() @MaxLength(300) path?: string;
  @IsOptional() @IsString() @MaxLength(30) protocol?: string;
  @IsOptional() @IsString() @MaxLength(100) id?: string;
  @IsOptional() @IsString() @MaxLength(1000) query?: string;
  @IsOptional() @IsString() @MaxLength(2000) token?: string;
}
