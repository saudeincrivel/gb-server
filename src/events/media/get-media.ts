import { Db } from "mongodb";
import { S3Client, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { Logger } from "../../common/logs/logger";
import type { EventHandler } from "../types/event-handler";
import { Readable } from "stream";

const logger = new Logger("GetMediaHandler");

export class GetMediaHandler implements EventHandler {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor(db: Db) {
    // We keep the db parameter for compatibility with other handlers
    this.s3Client = new S3Client({ region: "sa-east-1" });
    this.bucketName = Bun.env.MEDIA_BUCKET_NAME || "gb-media";
  }
  
  /**
   * Generate a direct S3 URL for a media file
   * @param s3Key The S3 key for the media file
   * @returns The direct S3 URL
   */
  private generateS3Url(s3Key: string): string {
    // Format: https://{bucketName}.s3.{region}.amazonaws.com/{objectKey}
    return `https://${this.bucketName}.s3.sa-east-1.amazonaws.com/${s3Key}`;
  }

  handle = async (event: any) => {
    try {
      logger.info("Processing get media event", { event, id: event.id, stream: event.stream });

      // If ID is provided, get a specific media item
      if (event.id) {
        // The ID is now used directly as the S3 key or to determine the S3 key
        const s3Key = event.id;
        logger.info("Attempting to fetch media from S3", { s3Key, bucketName: this.bucketName });
        
        try {
          // First check if the object exists in S3
          const headCommand = new HeadObjectCommand({
            Bucket: this.bucketName,
            Key: s3Key,
          });
          
          try {
            logger.info("Sending HeadObjectCommand to S3");
            const headResponse = await this.s3Client.send(headCommand);
            logger.info("S3 HeadObject response received", { contentType: headResponse.ContentType });
            
            // Determine media type from content type
            const contentType = headResponse.ContentType || '';
            const type = contentType.startsWith('video/') ? 'video' : 'image';
            
            // If the request is for streaming the actual media content
            if (event.stream) {
              const command = new GetObjectCommand({
                Bucket: this.bucketName,
                Key: s3Key,
              });

              const response = await this.s3Client.send(command);

              // Convert the S3 stream to a buffer
              const mediaContent = await this.streamToBuffer(
                response.Body as Readable
              );

              return {
                success: true,
                mediaContent: mediaContent.toString("base64"),
                contentType: contentType,
                fileName: s3Key.split('/').pop() || s3Key,
              };
            }

            // Extract metadata from S3 object
            const metadata = {
              contentType,
              size: headResponse.ContentLength,
              lastModified: headResponse.LastModified,
              ...headResponse.Metadata, // Include any custom metadata from S3
            };

            // Generate direct S3 URL
            const directS3Url = this.generateS3Url(s3Key);
            
            // Return media metadata with direct S3 URL
            return {
              success: true,
              media: {
                id: s3Key,
                type,
                s3Key,
                url: directS3Url,
                metadata,
              },
            };
          } catch (error) {
            logger.error("Media object not found in S3:", { s3Key, error: error instanceof Error ? error.message : String(error) });
            return {
              success: false,
              message: "Media not found",
              error: error instanceof Error ? error.message : String(error),
              s3Key,
              bucketName: this.bucketName
            };
          }
        } catch (error) {
          logger.error("Error retrieving media from S3:", error);
          return {
            success: false,
            message: "Failed to retrieve media",
          };
        }
      }
      // Otherwise, list media items from S3 (with pagination)
      else {
        try {
          const prefix = event.prefix || '';
          const maxKeys = event.limit || 20;
          const continuationToken = event.continuationToken;
          
          const command = new ListObjectsV2Command({
            Bucket: this.bucketName,
            Prefix: prefix,
            MaxKeys: maxKeys,
            ContinuationToken: continuationToken,
          });
          
          const response = await this.s3Client.send(command);
          
          // Map S3 objects to media items
          const media = (response.Contents || []).map(item => {
            const key = item.Key || '';
            const fileName = key.split('/').pop() || key;
            const contentType = this.getContentTypeFromFileName(fileName);
            const type = contentType.startsWith('video/') ? 'video' : 'image';
            
            // Generate direct S3 URL
            const directS3Url = this.generateS3Url(key);
            
            return {
              id: key,
              type,
              s3Key: key,
              url: directS3Url,
              metadata: {
                contentType,
                size: item.Size,
                lastModified: item.LastModified,
                fileName,
              },
            };
          });
          
          return {
            success: true,
            media,
            total: response.KeyCount || 0,
            isTruncated: response.IsTruncated,
            nextContinuationToken: response.NextContinuationToken,
          };
        } catch (error) {
          logger.error("Error listing media from S3:", error);
          return {
            success: false,
            message: "Failed to list media",
          };
        }
      }
    } catch (error) {
      logger.error("Error handling get media event:", error);
      return {
        success: false,
        message: "Failed to retrieve media",
      };
    }
  };

  private streamToBuffer = (stream: Readable): Promise<Buffer> => {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on("error", reject);
      stream.on("end", () => resolve(Buffer.concat(chunks)));
    });
  };

  private getContentTypeFromFileName(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'gif':
        return 'image/gif';
      case 'webp':
        return 'image/webp';
      case 'mp4':
        return 'video/mp4';
      case 'webm':
        return 'video/webm';
      case 'mov':
        return 'video/quicktime';
      default:
        return 'application/octet-stream';
    }
  }
}