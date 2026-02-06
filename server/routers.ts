import { COOKIE_NAME, NOT_ADMIN_ERR_MSG } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import { invokeLLM } from "./_core/llm";

const decodeBase64 = (input: string) => {
  if (typeof atob === "function") {
    const binary = atob(input);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  if (typeof Buffer !== "undefined") {
    return Uint8Array.from(Buffer.from(input, "base64"));
  }

  throw new Error("Base64 decoding is not supported in this environment.");
};

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  caseStudies: router({
    // 全事例一覧取得(公開)
    list: publicProcedure.query(async ({ ctx }) => {
      const cases = await db.getAllCaseStudies();
      
      // ログイン済みの場合はお気に入り情報も付与
      if (ctx.user) {
        const favorites = await db.getUserFavorites(ctx.user.id);
        const favoriteIds = new Set(favorites.map(f => f.caseStudyId));
        
        return cases.map(c => ({
          ...c,
          tools: JSON.parse(c.tools),
          steps: JSON.parse(c.steps),
          tags: JSON.parse(c.tags),
          isFavorite: favoriteIds.has(c.id),
        }));
      }
      
      return cases.map(c => ({
        ...c,
        tools: JSON.parse(c.tools),
        steps: JSON.parse(c.steps),
        tags: JSON.parse(c.tags),
        isFavorite: false,
      }));
    }),

    // 事例詳細取得
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        const caseStudy = await db.getCaseStudyById(input.id);
        if (!caseStudy) return null;
        
        const isFav = ctx.user ? await db.isFavorite(ctx.user.id, input.id) : false;
        
        return {
          ...caseStudy,
          tools: JSON.parse(caseStudy.tools),
          steps: JSON.parse(caseStudy.steps),
          tags: JSON.parse(caseStudy.tags),
          isFavorite: isFav,
        };
      }),

    // 新規事例作成(認証必須)
    create: protectedProcedure
      .input(
        z.object({
          title: z.string().min(1),
          description: z.string().min(1),
          category: z.enum(["prompt", "automation", "tools", "business"]),
          tools: z.array(z.string()),
          challenge: z.string().min(1),
          solution: z.string().min(1),
          steps: z.array(z.string()),
          impact: z.string().optional(),
          thumbnailUrl: z.string().optional(),
          thumbnailKey: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.loginMethod !== "google") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Google login required to post.",
          });
        }
        // AIでタグを自動生成
        const tags = await generateTags({
          title: input.title,
          description: input.description,
          tools: input.tools,
          category: input.category,
        });

        const result = await db.createCaseStudy({
          userId: ctx.user.id,
          title: input.title,
          description: input.description,
          category: input.category,
          tools: JSON.stringify(input.tools),
          challenge: input.challenge,
          solution: input.solution,
          steps: JSON.stringify(input.steps),
          impact: input.impact || null,
          thumbnailUrl: input.thumbnailUrl || null,
          thumbnailKey: input.thumbnailKey || null,
          tags: JSON.stringify(tags),
          isRecommended: 0,
        });

        return { success: true, id: Number(result.insertId) };
      }),

    // 事例更新(認証必須)
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          title: z.string().min(1),
          description: z.string().min(1),
          category: z.enum(["prompt", "automation", "tools", "business"]),
          tools: z.array(z.string()),
          challenge: z.string().min(1),
          solution: z.string().min(1),
          steps: z.array(z.string()),
          impact: z.string().optional(),
          thumbnailUrl: z.string().optional(),
          thumbnailKey: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.loginMethod !== "google") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Google login required to post.",
          });
        }

        const caseStudy = await db.getCaseStudyById(input.id);
        if (!caseStudy) return { success: false };

        if (caseStudy.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
        }

        const tags = await generateTags({
          title: input.title,
          description: input.description,
          tools: input.tools,
          category: input.category,
        });

        await db.updateCaseStudy(input.id, {
          title: input.title,
          description: input.description,
          category: input.category,
          tools: JSON.stringify(input.tools),
          challenge: input.challenge,
          solution: input.solution,
          steps: JSON.stringify(input.steps),
          impact: input.impact || null,
          thumbnailUrl: input.thumbnailUrl || null,
          thumbnailKey: input.thumbnailKey || null,
          tags: JSON.stringify(tags),
        });

        return { success: true };
      }),

    // お気に入りトグル
    toggleFavorite: protectedProcedure
      .input(z.object({ caseStudyId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const isFav = await db.isFavorite(ctx.user.id, input.caseStudyId);
        
        if (isFav) {
          await db.removeFavorite(ctx.user.id, input.caseStudyId);
          return { isFavorite: false };
        } else {
          await db.addFavorite(ctx.user.id, input.caseStudyId);
          return { isFavorite: true };
        }
      }),

    // お気に入り一覧取得
    getFavorites: protectedProcedure.query(async ({ ctx }) => {
      const favorites = await db.getUserFavorites(ctx.user.id);
      return favorites.map(f => ({
        ...f.caseStudy,
        tools: JSON.parse(f.caseStudy.tools),
        steps: JSON.parse(f.caseStudy.steps),
        tags: JSON.parse(f.caseStudy.tags),
        isFavorite: true,
      }));
    }),

    // delete case study
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const caseStudy = await db.getCaseStudyById(input.id);
        if (!caseStudy) return { success: false };

        if (caseStudy.userId !== ctx.user.id && ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
        }

        await db.deleteCaseStudy(input.id);
        return { success: true };
      }),

    // 画像アップロード
    uploadImage: protectedProcedure
      .input(
        z.object({
          filename: z.string(),
          contentType: z.string(),
          base64Data: z.string(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { storagePut } = await import("./storage");
        
        // Base64データをBufferに変換
        const buffer = decodeBase64(input.base64Data);
        
        // ランダムなサフィックスを追加してユニークなファイル名を生成
        const randomSuffix = Math.random().toString(36).substring(2, 15);
        const fileKey = `case-studies/${ctx.user.id}/${input.filename}-${randomSuffix}`;
        
        const result = await storagePut(fileKey, buffer, input.contentType);
        
        return {
          url: result.url,
          key: result.key,
        };
      }),
  }),
});

/**
 * AIを使ってタグを自動生成
 */
async function generateTags(data: {
  title: string;
  description: string;
  tools: string[];
  category: string;
}): Promise<string[]> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that generates relevant tags for AI use cases. Return only a JSON array of 3-5 short tags in Japanese.",
        },
        {
          role: "user",
          content: `Generate tags for this AI use case:\nTitle: ${data.title}\nDescription: ${data.description}\nTools: ${data.tools.join(", ")}\nCategory: ${data.category}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "tags",
          strict: true,
          schema: {
            type: "object",
            properties: {
              tags: {
                type: "array",
                items: { type: "string" },
                description: "Array of 3-5 relevant tags",
              },
            },
            required: ["tags"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (content && typeof content === "string") {
      const parsed = JSON.parse(content);
      return parsed.tags || [];
    }
  } catch (error) {
    console.error("Failed to generate tags:", error);
  }

  // フォールバック: 基本的なタグを返す
  return [data.category, ...data.tools.slice(0, 2)];
}

export type AppRouter = typeof appRouter;
