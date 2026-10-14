import { continueAsNew, proxyActivities, sleep } from '@temporalio/workflow';
import { CommentsActivity } from '@gitroom/orchestrator/activities/comments.activity';

const { syncComments } = proxyActivities<CommentsActivity>({
  startToCloseTimeout: '10 minute',
  taskQueue: 'main',
  retry: {
    maximumAttempts: 3,
    backoffCoefficient: 2,
    initialInterval: '1 minute',
  },
});

/** Polling interval; keeps API usage modest (YouTube quota, Threads rate limits). */
const INTERVAL_MS = 10 * 60 * 1000;
/** Restart with a fresh history periodically to keep the event history small. */
const ITERATIONS_BEFORE_CONTINUE = 100;

export async function commentSyncWorkflow({
  integrationId,
}: {
  integrationId: string;
}) {
  for (let i = 0; i < ITERATIONS_BEFORE_CONTINUE; i++) {
    try {
      const { stop } = await syncComments(integrationId);
      if (stop) {
        return;
      }
    } catch (err) {
      // errors are recorded on the sync row; keep polling
    }
    await sleep(INTERVAL_MS);
  }
  await continueAsNew<typeof commentSyncWorkflow>({ integrationId });
}
