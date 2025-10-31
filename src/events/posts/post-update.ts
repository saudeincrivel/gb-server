import { Db } from "mongodb";
import { v4 as uuidv4 } from "uuid";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { Logger } from "../../common/logs/logger";
import { COLLECTIONS } from "../../database/schemas";
import type { Post } from "../../database/schemas";
import type { EventHandler } from "../types/event-handler";
import type { PostUpdateEvent } from "../types/schemas";

const logger = new Logger("PostUpdateHandler");

export class PostUpdateHandler implements EventHandler {
  private db: Db;
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly baseUrl: string;

  constructor(db: Db) {
    this.db = db;
    this.s3Client = new S3Client({ region: "sa-east-1" });
    this.bucketName = Bun.env.MEDIA_BUCKET_NAME || "gb-media";
    
    // Use environment-specific base URL or default to localhost for development
    this.baseUrl = Bun.env.API_BASE_URL || "http://localhost:3131";
  }

  async handle(event: PostUpdateEvent): Promise<{ success: boolean; post: Post | null }> {
    logger.info("Updating post", { id: event.id });

    try {
      const now = new Date();
      const updateData: Partial<Post> = {
        updatedAt: now,
      };

      // Process media files if they exist
      let newMedias: Array<{ id: string; type: 'image' | 'video'; s3Key: string; metadata: any }> = [];
      
      if (event.mediaFiles && event.mediaFiles.length > 0) {
        newMedias = await this.processMediaFiles(event.mediaFiles);
        logger.info(`Processed ${newMedias.length} media files for post update`, { id: event.id });
      }
      
      // Add fields to update only if they are provided
      if (event.name !== undefined) updateData.name = event.name;
      if (event.description !== undefined) updateData.description = event.description;
      if (event.tags !== undefined) updateData.tags = event.tags;
      
      // Handle medias update
      if (newMedias.length > 0) {
        // Get the current post to append to existing medias
        const currentPost = await this.db.collection(COLLECTIONS.POSTS).findOne({ id: event.id });
        if (currentPost) {
          updateData.medias = [...(currentPost.medias || []), ...newMedias];
        } else {
          updateData.medias = newMedias;
        }
      }
      
      if (event.postal !== undefined) updateData.postal = event.postal;
      
      // Handle published status change
      if (event.published !== undefined) {
        updateData.published = event.published;
        
        // If post is being published for the first time, set publishedAt
        if (event.published) {
          const existingPost = await this.db.collection(COLLECTIONS.POSTS).findOne({ id: event.id });
          if (existingPost && !existingPost.published) {
            updateData.publishedAt = now;
          }
        }
      }

      const result = await this.db.collection(COLLECTIONS.POSTS).findOneAndUpdate(
        { id: event.id },
        { $set: updateData },
        { returnDocument: "after" }
      );

      if (!result) {
        logger.warn("Post not found for update", { id: event.id });
        return { success: false, post: null };
      }
      
      logger.info("Post updated successfully", { id: event.id });
      return { success: true, post: result as unknown as Post };
    } catch (error) {
      logger.error("Failed to update post", error);
      throw error;
    }
  }
  
  /**
   * Process media files, upload them to S3
   */
  private async processMediaFiles(
    mediaFiles: Array<{name: string; type: string; size: number; content: Buffer; metadata: any}>
  ): Promise<Array<{ id: string; type: 'image' | 'video'; s3Key: string; metadata: any }>> {
    const processedMedias: Array<{ id: string; type: 'image' | 'video'; s3Key: string; metadata: any }> = [];
    
    for (const file of mediaFiles) {
      try {
        // Generate a unique ID for the file
        const fileId = uuidv4();
        const fileExtension = this.getFileExtension(file.name);
        const fileName = `${fileId}${fileExtension}`;
        
        // Determine if it's a video or image
        const mediaType = file.type.startsWith("video/") ? 'video' : 'image';
        
        // Create S3 key
        const s3Key = `media/${mediaType}s/${fileName}`;
        
        // Upload to S3
        await this.uploadToS3(file.content, s3Key, file.type);
        
        // Create media record in database
        const mediaDoc = {
          id: fileId,
          fileName,
          originalName: file.name,
          contentType: file.type,
          size: file.size,
          s3Key,
          type: mediaType,
          metadata: {
            uploadedAt: new Date(),
            ...file.metadata
          }
        };
        
        await this.db.collection("media").insertOne(mediaDoc);
        
        // Add to post medias
        processedMedias.push({
          id: fileId,
          type: mediaType,
          s3Key,
          metadata: {
            originalName: file.name,
            size: file.size,
            contentType: file.type,
            ...file.metadata
          }
        });
        
        logger.info(`Uploaded media file: ${file.name}`, { fileId, type: mediaType });
      } catch (error) {
        logger.error(`Failed to process media file: ${file.name}`, error);
        // Continue with other files even if one fails
      }
    }
    
    return processedMedias;
  }
  
  /**
   * Upload file to S3 bucket
   */
  private async uploadToS3(
    fileContent: Buffer,
    key: string,
    contentType: string
  ): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: fileContent,
      ContentType: contentType,
    });

    await this.s3Client.send(command);
  }
  
  /**
   * Get file extension from filename
   */
  private getFileExtension(filename: string): string {
    const parts = filename.split(".");
    return parts.length > 1 ? `.${parts[parts.length - 1]}` : "";
  }
}
