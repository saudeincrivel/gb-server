export enum EventType {
  // Post related events
  POST_CREATE = "post_create",
  POST_UPDATE = "post_update",
  POST_GET = "post_get",
  POSTS_GET_ALL = "posts_get_all",
  POSTS_GET_DELTA = "posts_get_delta",
  POSTS_GET_FILTERED = "posts_get_filtered",
  
  // Media related events
  GET_MEDIA = "get_media",
  
  // Admin related events
  ADMIN_CONNECT = "admin_connect",
  
  // Newsletter related events
  NEWSLETTER_SUBSCRIBE = "newsletter_subscribe"
}
