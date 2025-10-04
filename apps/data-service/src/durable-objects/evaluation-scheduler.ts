import { DurableObject } from 'cloudflare:workers';

interface ClickData {
	accountId: string;
	linkId: string;
	destinationUrl: string;
	destinationCountryCode: string;
}

export class EvaluationScheduler extends DurableObject {
	clickData: ClickData | undefined;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		ctx.blockConcurrencyWhile(async () => {
			this.clickData = await ctx.storage.get<ClickData>('click_data');
		});
	}

	async collectLinkClick({ accountId, linkId, destinationUrl, destinationCountryCode }: ClickData) {
		this.clickData = {
			accountId,
			linkId,
			destinationUrl,
			destinationCountryCode,
		};
		await this.ctx.storage.put('click_data', this.clickData);

		const alarm = await this.ctx.storage.getAlarm();
		if (!alarm) {
			const tenSecondsFromNow = Date.now() + 1000 * 10; // 10 seconds from now
			await this.ctx.storage.setAlarm(tenSecondsFromNow);
		}
	}

	async alarm() {
		console.log('EvaluationScheduler alarm triggered');

		const clickData = this.clickData;
		if (!clickData) throw new Error('No click data found');

		await this.env.DESTINATION_EVALUATION_WORKFLOW.create({
			params: {
				accountId: clickData.accountId,
				linkId: clickData.linkId,
				destinationUrl: clickData.destinationUrl,
				destinationCountryCode: clickData.destinationCountryCode,
			},
		});
	}
}
