import type { AppRouter } from "../../../server/routers";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

export type Quest = inferRouterOutputs<AppRouter>["quests"]["list"][number];
export type QuestDetail = inferRouterOutputs<AppRouter>["quests"]["getById"];
export type QuestCreateInput = inferRouterInputs<AppRouter>["quests"]["create"];
export type QuestAnswerInput = inferRouterInputs<AppRouter>["quests"]["answer"];
