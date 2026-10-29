import { IntegrationValidationTool } from '@gitroom/nestjs-libraries/chat/tools/integration.validation.tool';
import { IntegrationTriggerTool } from '@gitroom/nestjs-libraries/chat/tools/integration.trigger.tool';
import { IntegrationSchedulePostTool } from './integration.schedule.post';
import { GenerateVideoOptionsTool } from '@gitroom/nestjs-libraries/chat/tools/generate.video.options.tool';
import { VideoFunctionTool } from '@gitroom/nestjs-libraries/chat/tools/video.function.tool';
import { GenerateVideoTool } from '@gitroom/nestjs-libraries/chat/tools/generate.video.tool';
import { GenerateImageTool } from '@gitroom/nestjs-libraries/chat/tools/generate.image.tool';
import { IntegrationListTool } from '@gitroom/nestjs-libraries/chat/tools/integration.list.tool';
import { GroupListTool } from '@gitroom/nestjs-libraries/chat/tools/group.list.tool';
import { UploadFromUrlTool } from '@gitroom/nestjs-libraries/chat/tools/upload.from.url.tool';
import { engagementTools } from '@gitroom/nestjs-libraries/chat/tools/engagement.tools';
import { affiliateTools } from '@gitroom/nestjs-libraries/chat/tools/affiliate.tools';
import { PostsListTool } from '@gitroom/nestjs-libraries/chat/tools/posts.list.tool';
import { DeletePostTool } from '@gitroom/nestjs-libraries/chat/tools/delete.post.tool';
import { PostSettingsTool } from '@gitroom/nestjs-libraries/chat/tools/post.settings.tool';
import { MediaListTool } from '@gitroom/nestjs-libraries/chat/tools/media.list.tool';

export const toolList = [
  IntegrationListTool,
  GroupListTool,
  IntegrationValidationTool,
  IntegrationTriggerTool,
  IntegrationSchedulePostTool,
  GenerateVideoOptionsTool,
  VideoFunctionTool,
  GenerateVideoTool,
  GenerateImageTool,
  UploadFromUrlTool,
  PostsListTool,
  DeletePostTool,
  PostSettingsTool,
  MediaListTool,
  ...engagementTools,
  ...affiliateTools,
];
