import { promises as fs } from 'fs';
import path from 'path';
import { frameioService } from './frameioService.js';
import { logger } from '../logger.js';
import { spawn } from 'child_process';
import { config } from '../config.js';

/**
 * Process video with LUT using remote URLs (no local download)
 * This is for deployment environments like Railway where local storage is limited
 */
export async function processVideoRemotely(
  assetId: string,
  lutPath: string,
  accountId: string,
  lutName: string
): Promise<{ id: string; versionId: string }> {
  try {
    logger.info({ assetId, accountId, lutName, lutPath }, 'Starting remote video processing');
    
    // Verify LUT file exists
    try {
      await fs.access(lutPath, fs.constants.R_OK);
      logger.info({ lutPath }, 'LUT file verified accessible');
    } catch (err) {
      logger.error({ lutPath, error: err }, 'LUT file not accessible');
      throw new Error(`LUT file not accessible: ${lutPath}`);
    }

    // Get asset details
    const asset = await frameioService.getAsset(assetId, accountId);
    logger.info({ assetId, name: asset.name }, 'Got asset details');

    // Get download URL for remote processing
    const downloadUrl = await frameioService.getMediaLinksOriginal(assetId, accountId);
    logger.info({ assetId }, 'Got download URL for remote processing');

    // Determine parent folder for upload
    let uploadParentId = asset.parent_id;
    if (!uploadParentId) {
      throw new Error('Original asset has no parent');
    }

    // Skip parent type checking for now - just upload to same folder as original
    // The API call to check parent type is failing in production
    logger.info({ uploadParentId }, 'Will upload processed file to same folder as original');

    // Keep the same filename as the original
    const processedFileName = asset.name;
    const outputExt = path.extname(asset.name) || '.mp4';
    
    // Create a temporary output file path
    const tempDir = config.TMP_DIR;
    await fs.mkdir(tempDir, { recursive: true });
    const outputPath = path.join(tempDir, `processed_${assetId}${outputExt}`);

    // Process video with FFmpeg using remote URL as input
    logger.info({ assetId, lutName }, 'Processing video with FFmpeg (remote URL input)');
    
    await new Promise<void>((resolve, reject) => {
      // For 10-bit HEVC input, we need to handle color space conversion explicitly
      // The LUT3D filter expects RGB input, so we need proper conversion
      const escapedLutPath = lutPath
        .replace(/\\/g, '\\\\')  // Escape backslashes
        .replace(/:/g, '\\:')    // Escape colons
        .replace(/'/g, "\\'")    // Escape single quotes
        .replace(/=/g, '\\=')    // Escape equals signs
        .replace(/,/g, '\\,');   // Escape commas
      
      // Build a filter chain that properly handles 10-bit color spaces
      const filterChain = [
        'scale=in_color_matrix=bt2020nc:out_color_matrix=bt709', // Convert color space first
        `lut3d=${escapedLutPath}`,  // Apply LUT
        'format=yuv420p'  // Ensure output format
      ].join(',');
      
      const ffmpegArgs = [
        '-i', downloadUrl,        // Input from remote URL
        '-vf', filterChain,       // Apply filter chain
        '-c:v', 'libx264',        // Video codec
        '-preset', 'fast',        // Faster preset to avoid timeout
        '-crf', '23',             // Reasonable quality
        '-color_trc', 'bt709',    // Set transfer characteristics
        '-colorspace', 'bt709',   // Set colorspace
        '-color_primaries', 'bt709', // Set color primaries
        '-c:a', 'copy',           // Copy audio stream
        '-movflags', '+faststart', // Optimize for streaming
        '-max_muxing_queue_size', '9999', // Prevent muxing issues
        '-y',                     // Overwrite output
        outputPath                // Output file
      ];

      logger.info({ 
        lutPath,
        filterChain,
        outputPath
      }, 'FFmpeg execution details');

      const ffmpeg = spawn(config.FFMPEG_PATH, ffmpegArgs);
      
      let errorOutput = '';
      let progressTimeout: NodeJS.Timeout;
      let lastProgress = Date.now();
      let frameCount = 0;

      // Set a timeout for FFmpeg processing (5 minutes)
      const processTimeout = setTimeout(() => {
        logger.error({ assetId }, 'FFmpeg processing timeout - killing process');
        ffmpeg.kill('SIGTERM');
        reject(new Error('FFmpeg processing timeout after 5 minutes'));
      }, 5 * 60 * 1000);

      // Monitor for progress updates
      const checkProgress = () => {
        const timeSinceLastProgress = Date.now() - lastProgress;
        if (timeSinceLastProgress > 30000) { // 30 seconds without progress
          logger.warn({ assetId, timeSinceLastProgress }, 'No FFmpeg progress detected');
        }
      };
      progressTimeout = setInterval(checkProgress, 10000);

      ffmpeg.stderr.on('data', (data) => {
        const output = data.toString();
        errorOutput += output;
        
        // Check for frame progress
        const frameMatch = output.match(/frame=\s*(\d+)/);
        if (frameMatch) {
          const newFrameCount = parseInt(frameMatch[1], 10);
          if (newFrameCount > frameCount) {
            frameCount = newFrameCount;
            lastProgress = Date.now(); // Reset progress timer on frame update
            logger.info({ frames: frameCount }, 'FFmpeg processing frames');
          }
        } else {
          lastProgress = Date.now(); // Reset progress timer on any output
        }
        
        // Check for specific LUT errors
        if (output.includes('Cannot find color') || output.includes('lut3d') || output.includes('No such file')) {
          logger.error({ lutPath, escapedLutPath }, 'LUT file error detected in FFmpeg output');
        }
        
        // Log verbose output only in debug mode to reduce noise
        if (output.includes('frame=') || output.includes('fps=')) {
          logger.debug({ ffmpeg: output.trim() }, 'FFmpeg progress');
        } else {
          logger.info({ ffmpeg: output.trim() }, 'FFmpeg output');
        }
      });

      ffmpeg.on('close', (code) => {
        clearTimeout(processTimeout);
        clearInterval(progressTimeout);
        
        if (code === 0) {
          logger.info({ assetId }, 'FFmpeg processing completed successfully');
          resolve();
        } else {
          logger.error({ 
            code, 
            errorOutput,
            downloadUrl: downloadUrl.substring(0, 100) + '...',
            lutPath,
            outputPath 
          }, 'FFmpeg processing failed - detailed error');
          reject(new Error(`FFmpeg exited with code ${code}: ${errorOutput}`));
        }
      });

      ffmpeg.on('error', (err) => {
        clearTimeout(processTimeout);
        clearInterval(progressTimeout);
        logger.error({ error: err }, 'FFmpeg spawn error');
        reject(err);
      });
    });

    // Get file size for upload
    const fileStats = await fs.stat(outputPath);
    logger.info({ outputPath, size: fileStats.size }, 'Processed video ready for upload');

    // Create new file in Frame.io
    logger.info({ parentId: uploadParentId, processedFileName, size: fileStats.size }, 
      'Creating new file for upload');
    const newFile = await frameioService.createFile(
      accountId,
      uploadParentId,
      processedFileName,
      fileStats.size
    );

    // Upload the processed file
    const uploadUrls = newFile.upload_urls || newFile.uploadUrls;
    const mediaType = newFile.media_type || newFile.filetype || 'video/quicktime';
    
    if (uploadUrls && uploadUrls.length > 0) {
      logger.info({ fileId: newFile.id, chunks: uploadUrls.length, mediaType }, 
        'Uploading processed file to Frame.io');
      
      await frameioService.uploadMedia(
        uploadUrls,
        outputPath,
        mediaType,
        (percent) => {
          logger.debug({ fileId: newFile.id, percent }, 'Upload progress');
        }
      );

      // Create version stack
      logger.info({ originalAssetId: assetId, processedFileId: newFile.id }, 
        'Creating version stack');
      await frameioService.createVersionStack(
        accountId,
        uploadParentId,
        assetId,
        newFile.id
      );

      // Add comment
      try {
        await frameioService.postComment(
          newFile.id,
          `✨ LUT "${lutName}" has been applied to this video`,
          accountId
        );
      } catch (commentError) {
        logger.warn({ fileId: newFile.id, error: commentError }, 
          'Failed to post comment, but upload succeeded');
      }

      // Clean up temporary file
      try {
        await fs.unlink(outputPath);
        logger.debug({ outputPath }, 'Cleaned up temporary processed file');
      } catch (cleanupError) {
        logger.warn({ outputPath, error: cleanupError }, 'Failed to clean up temp file');
      }

      logger.info({ 
        originalAssetId: assetId, 
        processedFileId: newFile.id 
      }, 'Successfully processed video remotely');

      return {
        id: newFile.id,
        versionId: newFile.id,
      };
    } else {
      throw new Error('No upload URLs provided for new file');
    }
  } catch (error) {
    logger.error({ assetId, error }, 'Failed to process video remotely');
    throw error;
  }
}