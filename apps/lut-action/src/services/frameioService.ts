import axios, { AxiosInstance, AxiosError } from 'axios';
import FormData from 'form-data';
import { statSync, openSync, readSync, closeSync } from 'fs';
import { config } from '../config.js';
import { frameioAuth } from '../auth/frameioAuth.js';
import { frameioLogger as logger, logApiCall } from '../logger.js';
import {
  Asset,
  AssetSchema,
  MediaLinks,
  MediaLinksSchema,
  VersionCreateRequest,
  VersionCreateResponse,
  VersionCreateResponseSchema,
  Comment,
  CommentSchema,
  UploadCompletionRequest,
} from '../types/frameio.js';

export class FrameIOService {
  private static instance: FrameIOService;
  private axiosInstance: AxiosInstance;

  private constructor() {
    this.axiosInstance = axios.create({
      baseURL: config.FRAMEIO_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor for authentication
    this.axiosInstance.interceptors.request.use(async (requestConfig) => {
      try {
        // Always use the frameioAuth service which now handles env vars properly
        const token = await frameioAuth.getAccessToken();
        requestConfig.headers.Authorization = `Bearer ${token}`;
        return requestConfig;
      } catch (error) {
        logger.error({ error }, 'Failed to get access token for request');
        throw error;
      }
    });

    // Add response interceptor for logging
    this.axiosInstance.interceptors.response.use(
      (response) => {
        logApiCall(
          'frameio',
          response.config.method?.toUpperCase() || 'GET',
          response.config.url || '',
          response.config.metadata?.startTime
            ? Date.now() - response.config.metadata.startTime
            : undefined,
          response.status,
        );
        return response;
      },
      (error: AxiosError) => {
        logApiCall(
          'frameio',
          error.config?.method?.toUpperCase() || 'GET',
          error.config?.url || '',
          error.config?.metadata?.startTime
            ? Date.now() - error.config.metadata.startTime
            : undefined,
          error.response?.status,
        );
        throw error;
      },
    );
  }

  static getInstance(): FrameIOService {
    if (!FrameIOService.instance) {
      FrameIOService.instance = new FrameIOService();
    }
    return FrameIOService.instance;
  }

  /**
   * Get asset details
   */
  async getAsset(assetId: string, accountId: string): Promise<Asset> {
    try {
      const response = await this.axiosInstance.get(`/accounts/${accountId}/files/${assetId}`, {
        metadata: { startTime: Date.now() },
      });
      // The response has a 'data' wrapper
      const assetData = response.data?.data || response.data;
      const validated = AssetSchema.parse(assetData);
      logger.debug({ assetId, accountId }, 'Retrieved asset details');
      return validated;
    } catch (error) {
      logger.error({ assetId, accountId, error }, 'Failed to get asset');
      throw error;
    }
  }

  /**
   * Get original media download links
   */
  async getMediaLinksOriginal(assetId: string, accountId: string): Promise<string> {
    try {
      const response = await this.axiosInstance.get(`/accounts/${accountId}/files/${assetId}`, {
        params: { include: 'media_links.original' },
        metadata: { startTime: Date.now() },
      });
      
      // Extract the download URL from the response
      if (response.data?.data?.media_links?.original?.download_url) {
        logger.debug({ assetId, accountId }, 'Retrieved original download URL');
        return response.data.data.media_links.original.download_url;
      }
      
      throw new Error('No original media link found in response');
    } catch (error) {
      logger.error({ assetId, accountId, error }, 'Failed to get media links');
      throw error;
    }
  }

  /**
   * Get all media links (including transcoded versions)
   */
  async getMediaLinks(assetId: string): Promise<MediaLinks> {
    try {
      const response = await this.axiosInstance.get(`/assets/${assetId}/media`, {
        metadata: { startTime: Date.now() },
      });
      const validated = MediaLinksSchema.parse(response.data);
      logger.debug({ assetId }, 'Retrieved media links');
      return validated;
    } catch (error) {
      logger.error({ assetId, error }, 'Failed to get media links');
      throw error;
    }
  }

  /**
   * Create a new file for upload
   */
  async createFile(
    accountId: string,
    folderId: string,
    fileName: string,
    fileSize: number,
  ): Promise<any> {
    try {
      const url = `/accounts/${accountId}/folders/${folderId}/files/local_upload`;
      const payload = {
        data: {
          name: fileName,
          file_size: fileSize,
        },
      };
      
      logger.info({ 
        url, 
        payload, 
        accountId, 
        folderId 
      }, 'Creating file for upload - request details');
      
      const response = await this.axiosInstance.post(
        url,
        payload,
        {
          metadata: { startTime: Date.now() },
        },
      );
      const fileData = response.data.data || response.data;
      
      // Log media_type for debugging
      logger.info({ 
        folderId, 
        fileName, 
        fileData,
        media_type: fileData.media_type,
        filetype: fileData.filetype 
      }, 'Created new file for upload');
      
      return fileData;
    } catch (error: any) {
      logger.error({ 
        accountId, 
        folderId, 
        url: `/accounts/${accountId}/folders/${folderId}/files/local_upload`,
        status: error.response?.status,
        statusText: error.response?.statusText,
        responseData: error.response?.data,
        error 
      }, 'Failed to create file');
      throw error;
    }
  }

  /**
   * Create a file from a remote URL (Frame.io will download it)
   */
  async createRemoteFile(
    accountId: string,
    folderId: string,
    fileName: string,
    sourceUrl: string,
  ): Promise<any> {
    try {
      const url = `/accounts/${accountId}/folders/${folderId}/files/remote_upload`;
      const payload = {
        data: {
          name: fileName,
          source_url: sourceUrl,
        },
      };
      
      logger.info({ 
        url, 
        fileName,
        folderId,
        accountId 
      }, 'Creating remote file upload');
      
      const response = await this.axiosInstance.post(
        url,
        payload,
        {
          metadata: { startTime: Date.now() },
        },
      );
      
      const fileData = response.data.data || response.data;
      
      logger.info({ 
        fileId: fileData.id,
        fileName,
        folderId 
      }, 'Created remote file upload');
      
      return fileData;
    } catch (error: any) {
      logger.error({ 
        accountId, 
        folderId,
        fileName,
        error 
      }, 'Failed to create remote file');
      throw error;
    }
  }

  /**
   * Create a new folder
   */
  async createFolder(
    accountId: string,
    parentId: string,
    folderName: string,
  ): Promise<Asset> {
    try {
      const url = `/accounts/${accountId}/files`;
      const payload = {
        data: {
          name: folderName,
          type: 'folder',
          parent_id: parentId,
        },
      };
      
      logger.info({ 
        url, 
        payload,
        accountId,
        parentId 
      }, 'Creating folder');
      
      const response = await this.axiosInstance.post(
        url,
        payload,
        {
          metadata: { startTime: Date.now() },
        },
      );
      
      const folderData = response.data.data || response.data;
      const validated = AssetSchema.parse(folderData);
      
      logger.info({ 
        folderId: validated.id,
        folderName,
        parentId 
      }, 'Created folder');
      
      return validated;
    } catch (error: any) {
      logger.error({ 
        accountId, 
        parentId,
        folderName,
        error 
      }, 'Failed to create folder');
      throw error;
    }
  }

  /**
   * Upload media file to Frame.io (handles chunked upload)
   */
  async uploadMedia(
    uploadUrls: Array<{ url: string; size: number }>,
    filePath: string,
    mediaType: string,
    onProgress?: (percent: number) => void,
  ): Promise<void> {
    try {
      const fileStats = statSync(filePath);
      const fileSize = fileStats.size;

      logger.info(
        {
          filePath,
          fileSize,
          chunks: uploadUrls.length,
        },
        'Starting chunked upload to Frame.io',
      );

      // Open file for reading
      const fd = openSync(filePath, 'r');
      let currentOffset = 0;
      let totalUploaded = 0;

      try {
        // Upload each chunk
        for (let i = 0; i < uploadUrls.length; i++) {
          const { url, size: chunkSize } = uploadUrls[i];

          // Calculate the actual bytes to read for this chunk
          const bytesToRead = Math.min(chunkSize, fileSize - currentOffset);

          if (bytesToRead <= 0) {
            // No more data to upload
            break;
          }

          logger.debug(
            {
              chunk: i + 1,
              totalChunks: uploadUrls.length,
              offset: currentOffset,
              bytesToRead,
              chunkSize,
            },
            'Uploading chunk',
          );

          // Read chunk into buffer
          const buffer = Buffer.alloc(bytesToRead);
          const bytesRead = readSync(fd, buffer, 0, bytesToRead, currentOffset);

          if (bytesRead !== bytesToRead) {
            logger.warn(
              `Read ${bytesRead} bytes but expected ${bytesToRead} bytes for chunk ${i + 1}`,
            );
          }

          try {
            // Include the required headers for Frame.io presigned URLs
            // According to Frame.io docs, these headers are required:
            // - Content-Type must match the media_type from the create file response
            // - x-amz-acl must be set to 'private'
            const response = await fetch(url, {
              method: 'PUT',
              headers: {
                'Content-Type': mediaType,
                'x-amz-acl': 'private'
              },
              body: buffer,
            });

            if (!response.ok && response.status !== 200 && response.status !== 204) {
              const errorText = await response.text();
              logger.error(
                {
                  chunk: i + 1,
                  status: response.status,
                  errorText,
                },
                'Presigned URL upload failed',
              );
              throw new Error(
                `Upload failed with status ${response.status}: ${errorText}`,
              );
            }

            // Report progress manually since fetch doesn't have built-in progress
            const chunkProgress = bytesToRead;
            const overallProgress = ((totalUploaded + chunkProgress) / fileSize) * 100;
            onProgress?.(overallProgress);
            logger.debug(
              {
                chunk: i + 1,
                totalChunks: uploadUrls.length,
                percent: Math.round(overallProgress),
              },
              'Upload progress',
            );

            logger.debug(
              {
                chunk: i + 1,
                bytesUploaded: bytesToRead,
                totalUploaded: totalUploaded + bytesToRead,
                progress: Math.round(((totalUploaded + bytesToRead) / fileSize) * 100),
              },
              'Chunk uploaded successfully',
            );
          } catch (uploadError: any) {
            logger.error(
              {
                chunk: i + 1,
                url: url.substring(0, 100) + '...',
                bytesToRead,
                errorMessage: uploadError.message || 'Unknown error',
                uploadError: uploadError.toString(),
              },
              'Failed to upload chunk to presigned URL',
            );
            throw uploadError;
          }

          currentOffset += bytesToRead;
          totalUploaded += bytesToRead;
        }

        logger.info(
          {
            filePath,
            size: fileSize,
            chunks: uploadUrls.length,
            totalUploaded,
          },
          'Successfully completed chunked upload',
        );
      } finally {
        // Close the file descriptor
        closeSync(fd);
      }
    } catch (error) {
      logger.error({ filePath, error }, 'Failed to upload media');
      throw error;
    }
  }

  /**
   * Create a version stack linking original and processed files
   * Note: This is an experimental API endpoint
   */
  async createVersionStack(
    accountId: string,
    folderId: string,
    originalFileId: string,
    processedFileId: string,
  ): Promise<any> {
    try {
      const response = await this.axiosInstance.post(
        `/accounts/${accountId}/folders/${folderId}/version_stacks`,
        {
          data: {
            file_ids: [originalFileId, processedFileId],
          },
        },
        {
          headers: {
            'api-version': 'experimental',
          },
          metadata: { startTime: Date.now() },
        },
      );
      logger.info({ originalFileId, processedFileId }, 'Created version stack');
      return response.data;
    } catch (error) {
      logger.error({ accountId, folderId, error }, 'Failed to create version stack');
      throw error;
    }
  }

  /**
   * Post a comment on an asset
   */
  async postComment(
    assetId: string,
    text: string,
    accountId: string,
    timestamp?: number,
  ): Promise<Comment> {
    try {
      const response = await this.axiosInstance.post(
        `/accounts/${accountId}/files/${assetId}/comments`,
        {
          data: {
            text,
            timestamp: timestamp ?? null,
            page: null, // V4 API requires page field
          },
        },
        {
          metadata: { startTime: Date.now() },
        },
      );
      const validated = CommentSchema.parse(response.data.data || response.data);
      logger.info({ assetId, commentId: validated.id }, 'Posted comment');
      return validated;
    } catch (error: any) {
      logger.error({ 
        assetId, 
        accountId,
        status: error.response?.status,
        statusText: error.response?.statusText,
        responseData: error.response?.data,
        error 
      }, 'Failed to post comment');
      throw error;
    }
  }

  /**
   * Update asset metadata
   */
  async updateAsset(assetId: string, updates: Partial<Asset>): Promise<Asset> {
    try {
      const response = await this.axiosInstance.patch(`/assets/${assetId}`, updates, {
        metadata: { startTime: Date.now() },
      });
      const validated = AssetSchema.parse(response.data);
      logger.info({ assetId }, 'Updated asset');
      return validated;
    } catch (error) {
      logger.error({ assetId, error }, 'Failed to update asset');
      throw error;
    }
  }

  /**
   * List children of an asset (folder contents)
   */
  async listAssetChildren(assetId: string, page = 1, perPage = 100, accountId?: string): Promise<Asset[]> {
    try {
      const url = accountId 
        ? `/accounts/${accountId}/files/${assetId}/children`
        : `/assets/${assetId}/children`;
        
      const response = await this.axiosInstance.get(url, {
        params: {
          page,
          per_page: perPage,
        },
        metadata: { startTime: Date.now() },
      });
      
      const responseData = response.data.data || response.data;
      const assets = Array.isArray(responseData) 
        ? responseData.map((item: unknown) => AssetSchema.parse(item))
        : [];
      
      logger.debug({ assetId, count: assets.length }, 'Listed asset children');
      return assets;
    } catch (error) {
      logger.error({ assetId, error }, 'Failed to list asset children');
      throw error;
    }
  }

  /**
   * Mock mode for testing
   */
  enableMockMode(): void {
    logger.warn('Frame.io service is running in mock mode');
    // Override axios instance with mock responses
    this.axiosInstance.interceptors.response.use((response) => {
      // Return mock data based on the endpoint
      if (response.config.url?.includes('/assets/') && response.config.url?.includes('/download')) {
        response.data = 'https://mock-download-url.example.com/file.mp4';
      } else if (response.config.url?.includes('/assets/')) {
        response.data = {
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'test-asset.mp4',
          type: 'file',
          filetype: 'video/mp4',
          filesize: 1024000,
          parent_id: null,
          project_id: '123e4567-e89b-12d3-a456-426614174001',
          workspace_id: '123e4567-e89b-12d3-a456-426614174002',
          account_id: '123e4567-e89b-12d3-a456-426614174003',
          creator_id: '123e4567-e89b-12d3-a456-426614174004',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }
      return response;
    });
  }
}

export const frameioService = FrameIOService.getInstance();