import { getLink } from '@repo/data-ops/queries/links';
import { linkSchema, LinkSchemaType } from '@repo/data-ops/zod-schema/links';
import { LinkClickMessageType } from '@repo/data-ops/zod-schema/queue';

export function getDestinationForCountry(linkInfo: LinkSchemaType, countryCode?: string) {
	console.log('getDestinationForCountry', linkInfo.linkId, countryCode);
	if (!countryCode) return linkInfo.destinations.default;

	// Check if the country code exists in destinations
	if (linkInfo.destinations[countryCode]) return linkInfo.destinations[countryCode];

	// If not, return the default destination
	return linkInfo.destinations.default;
}

async function getLinkInfoFromKv(env: Env, id: string) {
	const linkInfo = await env.CACHE.get(id);
	if (!linkInfo) return null;
	try {
		const parsedLinkInfo = JSON.parse(linkInfo);
		return linkSchema.parse(parsedLinkInfo);
	} catch (error) {
		console.error('Error parsing link info from KV', error);
		return null;
	}
}

const TTL_TIME = 60 * 60 * 24 * 1; // 1 day

async function saveLinkInfoToKv(env: Env, id: string, linkInfo: LinkSchemaType) {
	try {
		await env.CACHE.put(id, JSON.stringify(linkInfo), {
			expirationTtl: TTL_TIME,
		});
	} catch (error) {
		console.error('Error saving link info to KV', error);
	}
}

export async function getRoutingDestinations(env: Env, id: string) {
	console.log('getRoutingDestinations', id);
	const linkInfo = await getLinkInfoFromKv(env, id);
	console.log('returning from kv', linkInfo);
	if (linkInfo) return linkInfo;

	const linkInfoFromDb = await getLink(id);
	console.log('returning from db', linkInfoFromDb);
	if (!linkInfoFromDb) return null;

	await saveLinkInfoToKv(env, id, linkInfoFromDb);
	return linkInfoFromDb;
}

export async function scheduleEvalWorkflow(env: Env, event: LinkClickMessageType) {
	const doId = env.EVALUATION_SCHEDULAR.idFromName(`${event.data.id}:${event.data.destination}`);
	const stub = env.EVALUATION_SCHEDULAR.get(doId);
	await stub.collectLinkClick({
		accountId: event.data.accountId,
		linkId: event.data.id,
		destinationUrl: event.data.destination,
		destinationCountryCode: 'UNKNOWN',
	});
}

export async function caputreLinkInBackground(env: Env, event: LinkClickMessageType) {
	await env.QUEUE.send(event);
	if (!event.data.latitude || !event.data.longitude || !event.data.country) return;

	const doId = env.LINK_CLICK_TRACKER_OBJECT.idFromName(event.data.accountId);
	const stub = env.LINK_CLICK_TRACKER_OBJECT.get(doId);

	await stub.addClick(event.data.latitude, event.data.longitude, event.data.country, Date.now());
}
