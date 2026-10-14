import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDefined,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export const COMMENT_STATUSES = ['PENDING', 'RESOLVED', 'IGNORED'] as const;
export type CommentStatus = (typeof COMMENT_STATUSES)[number];
export const MATCH_TYPES = ['any', 'all', 'every'] as const;

export class CommentsListQueryDto {
  @IsOptional()
  @IsIn(COMMENT_STATUSES)
  status?: CommentStatus;

  @IsOptional()
  @IsString()
  integrationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  page?: number;
}

export class CommentStatsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsIn([3, 7, 14, 30])
  days?: number;
}

export class UpdateCommentStatusDto {
  @IsDefined()
  @IsIn(COMMENT_STATUSES)
  status: CommentStatus;
}

export class ReplyCommentDto {
  @IsDefined()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  text: string;
}

export class HideCommentDto {
  @IsDefined()
  @IsBoolean()
  hide: boolean;
}

export class CommentSourceDto {
  @IsDefined()
  @IsBoolean()
  enabled: boolean;
}

class RuleFieldsDto {
  @IsDefined()
  @IsIn(MATCH_TYPES)
  matchType: (typeof MATCH_TYPES)[number];

  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  keywords: string[];

  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  excludeKeywords: string[];

  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  replies: string[];

  @IsDefined()
  @IsBoolean()
  hide: boolean;

  @IsDefined()
  @IsIn(COMMENT_STATUSES)
  markAs: CommentStatus;
}

export class CommentAutomationDto extends RuleFieldsDto {
  @IsDefined()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  integrations: string[];
}

export class CommentTemplateDto extends RuleFieldsDto {
  @IsDefined()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;
}

export class ActiveDto {
  @IsDefined()
  @IsBoolean()
  active: boolean;
}

export class ResearchQueryDto {
  @IsDefined()
  @IsString()
  integrationId: string;

  @IsDefined()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  q: string;
}
