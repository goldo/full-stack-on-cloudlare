import { caputreLinkInBackground, getDestinationForCountry, getRoutingDestinations } from '@/helpers/route-ops';
import { cloudflareInfoSchema } from '@repo/data-ops/zod-schema/links';
import { LinkClickMessageType } from '@repo/data-ops/zod-schema/queue';
import { Hono } from 'hono';

export const App = new Hono<{ Bindings: Env }>();

App.get('/click-socket', async (c) => {
	const upgradeHeader = c.req.header('Upgrade');
	if (!upgradeHeader || upgradeHeader !== 'websocket') return c.text('Expected Upgrade: websocket', 426);
	const accountId = c.req.header('account-id');
	if (!accountId) return c.text('No headers provided', 400);
	const doIt = c.env.LINK_CLICK_TRACKER_OBJECT.idFromName(accountId);
	const stub = c.env.LINK_CLICK_TRACKER_OBJECT.get(doIt);
	return await stub.fetch(c.req.raw);
});

App.get('/:id', async (c) => {
	const id = c.req.param('id');
	const linkInfo = await getRoutingDestinations(c.env, id);

	if (!linkInfo) return c.text('Destination not found', 404);

	const cfHeaders = cloudflareInfoSchema.safeParse(c.req.raw.cf);
	if (!cfHeaders.success) return c.text('Invalid Cloudflare headers', 400);

	const headers = cfHeaders.data;
	const destination = getDestinationForCountry(linkInfo, headers.country);

	const queueMessage: LinkClickMessageType = {
		type: 'LINK_CLICK',
		data: {
			id,
			destination,
			accountId: linkInfo.accountId,
			country: headers.country,
			latitude: headers.latitude,
			longitude: headers.longitude,
			timestamp: new Date().toISOString(),
		},
	};
	c.executionCtx.waitUntil(caputreLinkInBackground(c.env, queueMessage));

	return c.redirect(destination);
});
