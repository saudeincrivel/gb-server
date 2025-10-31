import "dotenv/config";
import Elysia from "elysia";
import { Logger } from "./common/logs/logger";
import { getDatabase } from "./database/mongo";
import { EventHandlers } from "./events/index";
import cors from "@elysiajs/cors";
import { GetMediaHandler } from "./events/media/get-media";

const logger = new Logger("local.server");

const PORT = 3131;

const app = new Elysia()
  .use(
    cors({
      origin: true,
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
      allowedHeaders: ["Content-Type", "Authorization"],
      exposeHeaders: ["Content-Type", "Authorization"],
    })
  )
  // Media route handler for direct media access
  .get("/api/media/:id", async ({ params }) => {
    try {
      const db = await getDatabase();
      const mediaHandler = new GetMediaHandler(db);
      
      const result = await mediaHandler.handle({
        id: params.id,
        stream: true
      });
      
      if (!result.success) {
        return new Response(result.message || "Media not found", { status: 404 });
      }
      
      // Return the media content with appropriate headers
      const base64Data = result.mediaContent;
      if (!base64Data) {
        return new Response("Media content not available", { status: 404 });
      }
      
      // Decode base64 to binary
      const binaryData = Buffer.from(base64Data, 'base64');
      
      return new Response(binaryData, {
        headers: {
          "Content-Type": result.contentType || "application/octet-stream",
          "Content-Disposition": `inline; filename="${result.fileName || 'media'}"`
        }
      });
    } catch (error) {
      logger.error("Error handling media request:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  })
  .post("/api", async ({ request }) => {
    try {
      logger.info("Received POST /api request");
      
      const db = await getDatabase();
      const factory = new EventHandlers(db);
      
      // Check if this is a multipart form data request
      const contentType = request.headers.get('content-type') || '';
      
      if (contentType.includes('multipart/form-data')) {
        // Handle multipart form data
        logger.info("Processing multipart form data");
        
        // Parse the form data
        const formData = await request.formData();
        const files: Record<string, any> = {};
        const eventData: Record<string, any> = {};
        
        // Process each form field
        for (const [key, value] of formData.entries()) {
          if (value instanceof File) {
            // This is a file
            const file = value;
            files[key] = {
              name: file.name,
              type: file.type,
              size: file.size,
              content: await file.arrayBuffer().then(Buffer.from)
            };
            logger.info(`Found file: ${file.name} (${file.type})`);
          } else {
            // This is a form field
            eventData[key] = value;
          }
        }
        
        // Parse tags if they're a JSON string
        if (eventData.tags && typeof eventData.tags === 'string') {
          try {
            eventData.tags = JSON.parse(eventData.tags);
          } catch (e) {
            logger.warn("Failed to parse tags JSON", e);
          }
        }
        
        // Convert published to boolean if it's a string
        if (eventData.published && typeof eventData.published === 'string') {
          eventData.published = eventData.published.toLowerCase() === 'true';
        }
        
        // Convert files object to mediaFiles array
        if (Object.keys(files).length > 0) {
          const mediaFiles = Object.values(files).map(file => ({
            name: file.name,
            type: file.type,
            size: file.size,
            content: file.content,
            metadata: {
              name: file.name,
              size: file.size
            }
          }));
          
          // Create the event object with files
          const event = {
            ...eventData,
            mediaFiles
          };
          
          logger.info("Processing event with files", { 
            type: eventData.type,
            name: eventData.name,
            fileCount: mediaFiles.length 
          });
          
          const response = await factory.handle(event);
          return response;
        }
      }
      
      // Regular JSON request
      const body = await request.json() as Record<string, any>;
      logger.info("Processing JSON request", { type: body.type });
      const response = await factory.handle(body);
      return response;
    } catch (error) {
      logger.error("Error handling /api:", error);
      return {
        success: false,
        message: "Internal server error"
      };
    }
  });

app.listen(PORT, () => {
  logger.info(`Aleysia test server listening on http://localhost:${PORT}`);
});
