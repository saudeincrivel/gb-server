export interface EventHandler {
  handle(event: any): Promise<any>;
}
