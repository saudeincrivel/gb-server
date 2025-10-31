import { Db } from "mongodb";
import { v4 as uuidv4 } from "uuid";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { Logger } from "../../common/logs/logger";
import { COLLECTIONS } from "../../database/schemas";
import type { Media, Post } from "../../database/schemas";
import type { EventHandler } from "../types/event-handler";
import type { PostCreateEvent } from "../types/schemas";

const logger = new Logger("PostCreateHandler");

export class PostCreateHandler implements EventHandler {
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

  private generateS3Url(s3Key: string): string {
    return `https://${this.bucketName}.s3.sa-east-1.amazonaws.com/${s3Key}`;
  }

  async handle(
    event: PostCreateEvent
  ): Promise<{ success: boolean; post: Post }> {
    logger.info("Creating new post", { name: event.name });

    try {
      const now = new Date();
      const postId = uuidv4();

      let postMedias: Array<Media> = [];

      if (event.mediaFiles && event.mediaFiles.length > 0) {
        postMedias = await this.processMediaFiles(event.mediaFiles);
        logger.info(`Processed ${postMedias.length} media files for post`, {
          postId,
        });
      }

      const post: Post = {
        id: postId,
        name: event.name,
        description: event.description || "",
        tags: event.tags || [],
        medias: postMedias,
        postal: event.postal !== undefined ? event.postal : 0,
        published: event.published || false,
        views: 0,
        createdAt: now,
        updatedAt: now,
      };

      if (post.published) {
        post.publishedAt = now;
      }

      await this.db.collection(COLLECTIONS.POSTS).insertOne(post);

      logger.info("Post created successfully", { id: post.id });
      return { success: true, post };
    } catch (error) {
      logger.error("Failed to create post", error);
      throw error;
    }
  }

  /**
   * Process media files, upload them to S3
   */
  private async processMediaFiles(
    mediaFiles: Array<{
      name: string;
      type: string;
      size: number;
      content: Buffer;
      metadata: any;
    }>
  ): Promise<Array<Media>> {
    const processedMedias: Array<Media> = [];

    for (const file of mediaFiles) {
      try {
        const fileId = uuidv4();
        const fileExtension = this.getFileExtension(file.name);
        const fileName = `${fileId}${fileExtension}`;

        const mediaType = file.type.startsWith("video/") ? "video" : "image";

        const s3Key = `media/${mediaType}s/${fileName}`;

        await this.uploadToS3(file.content, s3Key, file.type);

        const directS3Url = this.generateS3Url(s3Key);

        processedMedias.push({
          id: fileId,
          type: mediaType,
          url: directS3Url,
          s3Key,
          metadata: {
            originalName: file.name,
            size: file.size,
            contentType: file.type,
            ...file.metadata,
          },
        });

        logger.info(`Uploaded media file: ${file.name}`, {
          fileId,
          type: mediaType,
        });
      } catch (error) {
        logger.error(`Failed to process media file: ${file.name}`, error);
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
