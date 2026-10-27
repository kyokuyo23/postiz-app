import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { shuffle } from 'lodash';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { ChatAnthropic } from '@langchain/anthropic';
import {
  aiProvider,
  claudeModel,
} from '@gitroom/nestjs-libraries/ai/ai.provider';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'sk-proj-',
});

const PicturePrompt = z.object({
  prompt: z.string(),
});

const VoicePrompt = z.object({
  voice: z.string(),
});

/**
 * Claude path for the text helpers below (used when ANTHROPIC_API_KEY is set,
 * see ai.provider). The OpenAI path is unchanged. Images always use OpenAI.
 */
const useClaude = () => aiProvider() === 'anthropic';
const claude = (temperature?: number) =>
  new ChatAnthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: claudeModel(),
    maxTokens: 8192,
    ...(temperature !== undefined ? { temperature } : {}),
  });

const claudeStructured = async <T extends z.ZodTypeAny>(
  schema: T,
  name: string,
  system: string,
  user: string
): Promise<z.infer<T>> =>
  (await claude()
    .withStructuredOutput(schema, { name })
    .invoke([
      ['system', system],
      ['human', user],
    ])) as z.infer<T>;

const claudeText = async (system: string, user: string, temperature?: number) => {
  const result = await claude(temperature).invoke([
    ['system', system],
    ['human', user],
  ]);
  return typeof result.content === 'string'
    ? result.content
    : result.content
        .map((part: any) => (part.type === 'text' ? part.text : ''))
        .join('');
};

@Injectable()
export class OpenaiService {
  async generateImage(prompt: string, isVertical = false) {
    // gpt-image models always return base64 (b64_json) and do not accept the
    // `response_format` parameter, unlike the deprecated dall-e-3.
    const generate = (
      await openai.images.generate({
        prompt,
        model: 'chatgpt-image-latest',
        size: isVertical ? '1024x1536' : '1024x1024',
      })
    ).data[0];

    return generate.b64_json;
  }

  async generatePromptForPicture(prompt: string) {
    if (useClaude()) {
      return (
        (
          await claudeStructured(
            PicturePrompt,
            'picturePrompt',
            `You are an assistant that take a description and style and generate a prompt that will be used later to generate images, make it a very long and descriptive explanation, and write a lot of things for the renderer like, if it's realistic describe the camera`,
            `prompt: ${prompt}`
          )
        ).prompt || ''
      );
    }
    return (
      (
        await openai.chat.completions.parse({
          model: 'gpt-4.1',
          messages: [
            {
              role: 'system',
              content: `You are an assistant that take a description and style and generate a prompt that will be used later to generate images, make it a very long and descriptive explanation, and write a lot of things for the renderer like, if it${"'"}s realistic describe the camera`,
            },
            {
              role: 'user',
              content: `prompt: ${prompt}`,
            },
          ],
          response_format: zodResponseFormat(PicturePrompt, 'picturePrompt'),
        })
      ).choices[0].message.parsed?.prompt || ''
    );
  }

  async generateVoiceFromText(prompt: string) {
    if (useClaude()) {
      return (
        (
          await claudeStructured(
            VoicePrompt,
            'voice',
            `You are an assistant that takes a social media post and convert it to a normal human voice, to be later added to a character, when a person talk they don't use "-", and sometimes they add pause with "..." to make it sounds more natural, make sure you use a lot of pauses and make it sound like a real person`,
            `prompt: ${prompt}`
          )
        ).voice || ''
      );
    }
    return (
      (
        await openai.chat.completions.parse({
          model: 'gpt-4.1',
          messages: [
            {
              role: 'system',
              content: `You are an assistant that takes a social media post and convert it to a normal human voice, to be later added to a character, when a person talk they don\'t use "-", and sometimes they add pause with "..." to make it sounds more natural, make sure you use a lot of pauses and make it sound like a real person`,
            },
            {
              role: 'user',
              content: `prompt: ${prompt}`,
            },
          ],
          response_format: zodResponseFormat(VoicePrompt, 'voice'),
        })
      ).choices[0].message.parsed?.voice || ''
    );
  }

  async generatePosts(content: string) {
    if (useClaude()) {
      const single = z.object({ posts: z.array(z.object({ post: z.string() })) });
      const runs = await Promise.all(
        Array.from({ length: 5 }).flatMap(() => [
          claudeStructured(
            single,
            'posts',
            'Generate a Twitter post from the content without emojis. Return exactly one post in the array.',
            content
          ).catch(() => ({ posts: [] })),
          claudeStructured(
            single,
            'posts',
            'Generate a thread for social media from the content without emojis. Return each post of the thread as an element of the array.',
            content
          ).catch(() => ({ posts: [] })),
        ])
      );
      return shuffle(runs.map((r) => r.posts));
    }
    const posts = (
      await Promise.all([
        openai.chat.completions.create({
          messages: [
            {
              role: 'assistant',
              content:
                'Generate a Twitter post from the content without emojis in the following JSON format: { "post": string } put it in an array with one element',
            },
            {
              role: 'user',
              content: content!,
            },
          ],
          n: 5,
          temperature: 1,
          model: 'gpt-4.1',
        }),
        openai.chat.completions.create({
          messages: [
            {
              role: 'assistant',
              content:
                'Generate a thread for social media in the following JSON format: Array<{ "post": string }> without emojis',
            },
            {
              role: 'user',
              content: content!,
            },
          ],
          n: 5,
          temperature: 1,
          model: 'gpt-4.1',
        }),
      ])
    ).flatMap((p) => p.choices);

    return shuffle(
      posts.map((choice) => {
        const { content } = choice.message;
        const start = content?.indexOf('[')!;
        const end = content?.lastIndexOf(']')!;
        try {
          return JSON.parse(
            '[' +
              content
                ?.slice(start + 1, end)
                .replace(/\n/g, ' ')
                .replace(/ {2,}/g, ' ') +
              ']'
          );
        } catch (e) {
          return [];
        }
      })
    );
  }
  async extractWebsiteText(content: string) {
    if (useClaude()) {
      const article = await claudeText(
        'You take a full website text, and extract only the article content',
        content
      );
      return this.generatePosts(article);
    }
    const websiteContent = await openai.chat.completions.create({
      messages: [
        {
          role: 'assistant',
          content:
            'You take a full website text, and extract only the article content',
        },
        {
          role: 'user',
          content,
        },
      ],
      model: 'gpt-4.1',
    });

    const { content: articleContent } = websiteContent.choices[0].message;

    return this.generatePosts(articleContent!);
  }

  async separatePosts(content: string, len: number) {
    const SeparatePostsPrompt = z.object({
      posts: z.array(z.string()),
    });

    const SeparatePostPrompt = z.object({
      post: z.string().max(len),
    });

    if (useClaude()) {
      const split =
        (
          await claudeStructured(
            SeparatePostsPrompt,
            'separatePosts',
            `You are an assistant that take a social media post and break it to a thread, each post must be minimum ${
              len - 10
            } and maximum ${len} characters, keeping the exact wording and break lines, however make sure you split posts based on context`,
            content
          )
        ).posts || [];
      return {
        posts: await Promise.all(
          split.map(async (post) => {
            if (post.length <= len) {
              return post;
            }
            for (let retries = 4; retries > 0; retries--) {
              try {
                const shrunk = (
                  await claudeStructured(
                    z.object({ post: z.string() }),
                    'separatePost',
                    `You are an assistant that take a social media post and shrink it to be maximum ${len} characters, keeping the exact wording and break lines`,
                    post
                  )
                ).post;
                if (shrunk && shrunk.length <= len) {
                  return shrunk;
                }
              } catch (e) {
                /* retry */
              }
            }
            return post;
          })
        ),
      };
    }

    const posts =
      (
        await openai.chat.completions.parse({
          model: 'gpt-4.1',
          messages: [
            {
              role: 'system',
              content: `You are an assistant that take a social media post and break it to a thread, each post must be minimum ${
                len - 10
              } and maximum ${len} characters, keeping the exact wording and break lines, however make sure you split posts based on context`,
            },
            {
              role: 'user',
              content: content,
            },
          ],
          response_format: zodResponseFormat(
            SeparatePostsPrompt,
            'separatePosts'
          ),
        })
      ).choices[0].message.parsed?.posts || [];

    return {
      posts: await Promise.all(
        posts.map(async (post: any) => {
          if (post.length <= len) {
            return post;
          }

          let retries = 4;
          while (retries) {
            try {
              return (
                (
                  await openai.chat.completions.parse({
                    model: 'gpt-4.1',
                    messages: [
                      {
                        role: 'system',
                        content: `You are an assistant that take a social media post and shrink it to be maximum ${len} characters, keeping the exact wording and break lines`,
                      },
                      {
                        role: 'user',
                        content: post,
                      },
                    ],
                    response_format: zodResponseFormat(
                      SeparatePostPrompt,
                      'separatePost'
                    ),
                  })
                ).choices[0].message.parsed?.post || ''
              );
            } catch (e) {
              retries--;
            }
          }

          return post;
        })
      ),
    };
  }

  async generateSlidesFromText(text: string) {
    for (let i = 0; i < 3; i++) {
      try {
        const message = `You are an assistant that takes a text and break it into slides, each slide should have an image prompt and voice text to be later used to generate a video and voice, image prompt should capture the essence of the slide and also have a back dark gradient on top, image prompt should not contain text in the picture, generate between 3-5 slides maximum`;
        if (useClaude()) {
          return (
            (
              await claudeStructured(
                z.object({
                  slides: z
                    .array(
                      z.object({
                        imagePrompt: z.string(),
                        voiceText: z.string(),
                      })
                    )
                    .describe('an array of slides'),
                }),
                'slides',
                message,
                text
              )
            ).slides || []
          );
        }
        const parse =
          (
            await openai.chat.completions.parse({
              model: 'gpt-4.1',
              messages: [
                {
                  role: 'system',
                  content: message,
                },
                {
                  role: 'user',
                  content: text,
                },
              ],
              response_format: zodResponseFormat(
                z.object({
                  slides: z
                    .array(
                      z.object({
                        imagePrompt: z.string(),
                        voiceText: z.string(),
                      })
                    )
                    .describe('an array of slides'),
                }),
                'slides'
              ),
            })
          ).choices[0].message.parsed?.slides || [];

        return parse;
      } catch (err) {
        console.log(err);
      }
    }

    return [];
  }
}
