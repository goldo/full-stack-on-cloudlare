import { App } from '@/hono/app';
import { handleLinkClick } from '@/queue-handlers/link-clicks';
import { initDatabase } from '@repo/data-ops/database';
import { QueueMessageSchema } from '@repo/data-ops/zod-schema/queue';
import { WorkerEntrypoint } from 'cloudflare:workers';

export { DestinationEvaluationWorkflow } from '@/workflows/destination-evalutation-workflow';

export { EvaluationScheduler } from '@/durable-objects/evaluation-scheduler';
export { LinkClickTracker } from '@/durable-objects/link-click-tracker';

export default class DataService extends WorkerEntrypoint<Env> {
	constructor(ctx: ExecutionContext, env: Env) {
		super(ctx, env);
		initDatabase(env.DB);
	}
	fetch(request: Request) {
		return App.fetch(request, this.env, this.ctx);
	}
	async queue(batch: MessageBatch<unknown>) {
		if (batch.queue === 'smart-links-data-dead-letter-stage') {
			console.log('Dead letter queue message', batch.messages);
			return;
		}

		if (batch.queue === 'smart-links-data-queue-stage') {
			for (const message of batch.messages) {
				console.log('Queue message', message.body);
				const event = QueueMessageSchema.parse(message.body);
				if (event.type === 'LINK_CLICK') {
					await handleLinkClick(this.env, event);
				}
			}
		}
	}
}
