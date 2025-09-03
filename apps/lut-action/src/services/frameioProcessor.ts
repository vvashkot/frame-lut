import { promises as fs } from 'fs';
import path from 'path';
import axios from 'axios';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { frameioService } from './frameioService.js';
import { logger } from '../logger.js';

/**
 * Download an asset from Frame.io
 */
export async function downloadAsset(
  assetId: string,
  tempDir: string,
  accountId?: string
): Promise<string> {
  if (!accountId) {
    throw new Error('accountId is required for downloading assets');
  }
  
  try {
    // Get asset details
    const asset = await frameioService.getAsset(assetId, accountId);
    logger.info({ assetId, accountId, name: asset.name }, 'Getting asset details');

    // Get download URL
    const downloadUrl = await frameioService.getMediaLinksOriginal(assetId, accountId);
    logger.info({ assetId }, 'Got download URL');

    // Determine file extension
    const ext = path.extname(asset.name) || '.mp4';
    const outputPath = path.join(tempDir, `input_${assetId}${ext}`);

    // Download the file
    logger.info({ assetId, outputPath }, 'Downloading asset');
    const response = await axios({
      method: 'GET',
      url: downloadUrl,
      responseType: 'stream',
    });

    const writer = createWriteStream(outputPath);
    await pipeline(response.data, writer);

    logger.info({ assetId, outputPath, size: asset.file_size || asset.filesize }, 'Asset downloaded successfully');
    return outputPath;
  } catch (error) {
    logger.error({ assetId, error }, 'Failed to download asset');
    throw error;
  }
}

/**
 * Upload processed video back to Frame.io using version stacks
 */
export async function uploadProcessedVideo(
  filePath: string,
  originalAssetId: string,
  lutName: string,
  accountId?: string
): Promise<{ id: string; versionId: string }> {
  if (!accountId) {
    throw new Error('accountId is required for uploading videos');
  }
  
  try {
    const fileName = path.basename(filePath);
    const fileStats = await fs.stat(filePath);

    logger.info({ originalAssetId, accountId, fileName, size: fileStats.size }, 'Starting upload process');

    // Get the original asset details
    const originalAsset = await frameioService.getAsset(originalAssetId, accountId);
    let uploadParentId = originalAsset.parent_id;

    if (!uploadParentId) {
      throw new Error('Original asset has no parent');
    }

    // Check if the parent is a folder, if not we need to find or create one
    let parentInfo;
    try {
      parentInfo = await frameioService.getAsset(uploadParentId, accountId);
      logger.info({ 
        parentId: uploadParentId, 
        parentType: parentInfo.type,
        parentName: parentInfo.name 
      }, 'Parent entity info');
      
      if (parentInfo.type !== 'folder') {
        // Parent is not a folder (likely a project root)
        // We need to find or create a folder for processed videos
        logger.info({ 
          parentId: uploadParentId, 
          parentType: parentInfo.type 
        }, 'Parent is not a folder, looking for LUT_Processed folder');
        
        // Try to find an existing "LUT_Processed" folder
        const children = await frameioService.listAssetChildren(uploadParentId, 1, 100, accountId);
        const processedFolder = children.find(child => 
          child.type === 'folder' && child.name === 'LUT_Processed'
        );
        
        if (processedFolder) {
          uploadParentId = processedFolder.id;
          logger.info({ folderId: uploadParentId }, 'Using existing LUT_Processed folder');
        } else {
          // Create a new folder for processed videos
          const newFolder = await frameioService.createFolder(
            accountId,
            uploadParentId,
            'LUT_Processed'
          );
          uploadParentId = newFolder.id;
          logger.info({ folderId: uploadParentId }, 'Created new LUT_Processed folder');
        }
      }
    } catch (err) {
      logger.error({ 
        parentId: uploadParentId, 
        error: err 
      }, 'Error checking parent type, cannot proceed');
      throw new Error(`Failed to verify upload location: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Create a new file for the processed video
    const processedFileName = `${path.parse(originalAsset.name).name}_LUT_${lutName}${path.extname(fileName)}`;
    
    logger.info({ parentId: uploadParentId, processedFileName, size: fileStats.size }, 'Creating new file for upload');
    const newFile = await frameioService.createFile(
      accountId,
      uploadParentId,
      processedFileName,
      fileStats.size
    );

    // Get the upload URLs from the response (Frame.io returns an array for chunked uploads)
    const uploadUrls = newFile.upload_urls || newFile.uploadUrls;
    const mediaType = newFile.media_type || newFile.filetype || 'video/quicktime';
    
    if (uploadUrls && uploadUrls.length > 0) {
      logger.info({ 
        fileId: newFile.id, 
        chunks: uploadUrls.length,
        mediaType 
      }, 'Uploading processed file to Frame.io');
      
      await frameioService.uploadMedia(
        uploadUrls,
        filePath,
        mediaType,
        (percent) => {
          logger.debug({ fileId: newFile.id, percent }, 'Upload progress');
        }
      );

      logger.info({ originalAssetId, processedFileId: newFile.id }, 'Creating version stack');
      
      // Create a version stack linking original and processed files
      const versionStack = await frameioService.createVersionStack(
        accountId,
        uploadParentId,
        originalAssetId,
        newFile.id
      );

      // Add a comment to indicate LUT was applied
      try {
        await frameioService.postComment(
          newFile.id,
          `✨ LUT "${lutName}" has been applied to this video`,
          accountId
        );
      } catch (commentError) {
        // Log the error but don't fail the entire job since the upload succeeded
        logger.warn({ 
          fileId: newFile.id, 
          error: commentError 
        }, 'Failed to post comment, but upload succeeded');
      }

      logger.info({ 
        originalAssetId, 
        processedFileId: newFile.id,
        versionStackId: versionStack.id 
      }, 'Successfully created version stack with processed video');

      return {
        id: newFile.id,
        versionId: newFile.id, // For backward compatibility
      };
    } else {
      // Log the actual response to understand what fields are available
      logger.error({ newFile }, 'No upload URLs found in createFile response');
      throw new Error('No upload URLs provided for new file. Response fields: ' + Object.keys(newFile).join(', '));
    }
  } catch (error) {
    logger.error({ originalAssetId, error }, 'Failed to upload processed video');
    throw error;
  }
}