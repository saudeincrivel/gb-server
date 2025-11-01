import { Db } from "mongodb";
import { Logger } from "../common/logs/logger";
import { AdminConnectHandler } from "./admin/admin-connect";
import { NewsletterSubscribeHandler } from "./news-letter/newsletter-subscribe";
import { GetMediaHandler } from "./media/get-media";
import { PostCreateHandler } from "./posts/post-create";
import { PostGetHandler } from "./posts/post-get";
import { PostUpdateHandler } from "./posts/post-update";
import { PostsGetAllHandler } from "./posts/posts-get-all";
import { PostsGetDeltaHandler } from "./posts/posts-get-delta";
import { PostsGetFilteredHandler } from "./posts/posts-get-filtered";
import type { EventHandler } from "./types/event-handler";
import { EventType } from "./types/event-type";
import { safeParseJson } from "../common/utils";

const logger = new Logger("EventHandlers");

type HandlerRegistry = Partial<Record<EventType, EventHandler>>;

export class EventHandlers {
  private readonly handlers: HandlerRegistry;

  constructor(db: Db) {
    this.handlers = {
      // Post related handlers
      [EventType.POST_CREATE]: new PostCreateHandler(db),
      [EventType.POST_UPDATE]: new PostUpdateHandler(db),
      [EventType.POST_GET]: new PostGetHandler(db),
      [EventType.POSTS_GET_ALL]: new PostsGetAllHandler(db),
      [EventType.POSTS_GET_DELTA]: new PostsGetDeltaHandler(db),
      [EventType.POSTS_GET_FILTERED]: new PostsGetFilteredHandler(db),

      // Media related handlers
      [EventType.GET_MEDIA]: new GetMediaHandler(db),

      // Admin related handlers
      [EventType.ADMIN_CONNECT]: new AdminConnectHandler(db),

      // Newsletter related handlers
      [EventType.NEWSLETTER_SUBSCRIBE]: new NewsletterSubscribeHandler(db),
    };
  }

  handle = async (eventType: EventType, event: any) => {
    logger.info("Handling event", { eventType, event });

    logger.info(`Processing event: ${eventType}`);

    try {
      const handler = this.handlers[eventType];

      if (!handler) {
        logger.warn(`Unknown event type: ${eventType}`);
        throw new Error(`Unknown event type: ${eventType}`);
      }

      return await handler.handle(event);
    } catch (error) {
      logger.error(`Error handling event ${eventType}:`, error);
      throw error;
    }
  };
}
