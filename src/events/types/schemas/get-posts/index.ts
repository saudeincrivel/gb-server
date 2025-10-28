import { z } from "zod";
import { EventType } from "../../event-type";

export const postsGetAllEventSchema = z.object({
  type: z.literal(EventType.POSTS_GET_ALL),
  data: z.object({
    page: z.number().optional(),
    limit: z.number().optional(),
  }),
});

export type PostsGetAllEvent = z.infer<typeof postsGetAllEventSchema>;
