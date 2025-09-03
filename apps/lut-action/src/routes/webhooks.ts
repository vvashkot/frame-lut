import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { verifySignature } from '../middleware/verifySignature.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { processLUTJob } from '../services/simpleJobProcessor.js';
import { webhookLogger as logger } from '../logger.js';
import { LUTJobRequestSchema } from '../types/jobs.js';

const router = Router();

// Frame.io Custom Action payload schema
const CustomActionPayloadSchema = z.object({
  account_id: z.string().uuid(),
  action_id: z.string().uuid(),
  interaction_id: z.string().uuid(),
  project: z.object({
    id: z.string().uuid(),
  }),
  resource: z.object({
    id: z.string().uuid(),
    type: z.enum(['file', 'folder', 'version_stack']),
  }),
  type: z.string(),
  user: z.object({
    id: z.string().uuid(),
  }),
  workspace: z.object({
    id: z.string().uuid(),
  }),
  data: z.record(z.unknown()).optional(), // Form data from callback
});

/**
 * POST /webhooks/frameio/custom-action
 * Handle Frame.io custom action webhook
 */
router.post(
  '/frameio/custom-action',
  verifySignature,
  asyncHandler(async (req: Request, res: Response) => {
    logger.info({ body: req.body }, 'Received custom action webhook');

    // Validate payload
    const payload = CustomActionPayloadSchema.parse(req.body);

    // Check if this is a form callback (has data field with LUT selection)
    if (payload.data && payload.data.lutId) {
      // User has selected a LUT, process the job
      const jobRequest = LUTJobRequestSchema.parse({
        assetId: payload.resource.id,
        sourceVersionId: null,
        lutId: payload.data.lutId as string,
        idempotencyKey: payload.interaction_id,
        requestedBy: payload.user.id,
        accountId: payload.account_id,
        workspaceId: payload.workspace.id,
        metadata: {
          projectId: payload.project.id,
          resourceType: payload.resource.type,
        },
      });

      // Process job (synchronously returns job ID, processes in background)
      const jobId = await processLUTJob(jobRequest);

      logger.info({ jobId, payload }, 'LUT job started successfully');

      // Return success message to Frame.io
      res.json({
        title: 'LUT Processing Started',
        description: `Your video is being processed with the selected LUT. Job ID: ${jobId}`,
      });
    } else {
      // First interaction - show LUT selection form
      const { lutService } = await import('../services/lutService.js');
      const luts = await lutService.listLUTs();

      // Create options for select field
      const lutOptions = luts.map(lut => ({
        name: lut.name,
        value: lut.id,
      }));

      // Return form callback for LUT selection
      const formResponse = {
        title: 'Select a LUT',
        description: 'Choose a LUT to apply to your video',
        fields: [
          {
            type: 'select',
            label: 'LUT',
            name: 'lutId',
            options: lutOptions,
          },
        ],
      };

      logger.info({ formResponse }, 'Returning LUT selection form');
      res.json(formResponse);
    }
  }),
);

/**
 * POST /webhooks/test
 * Test webhook endpoint (no signature verification)
 */
router.post(
  '/test',
  asyncHandler(async (req: Request, res: Response) => {
    logger.info({ body: req.body }, 'Received test webhook');

    // Echo back the payload
    res.json({
      received: true,
      timestamp: new Date().toISOString(),
      payload: req.body,
    });
  }),
);

export default router;