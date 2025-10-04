import { deleteClicksBefore, getRecentClicks } from '@/helpers/durable-queries';
import { DurableObject } from 'cloudflare:workers';

export class LinkClickTracker extends DurableObject {
	sql: SqlStorage;
	mostRecentOffsetTime: number = 0;
	leastRecentOffsetTime: number = 0;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		this.sql = ctx.storage.sql;

		this.ctx.blockConcurrencyWhile(async () => {
			const [mostRecentOffsetTime, leastRecentOffsetTime] = await Promise.all([
				this.ctx.storage.get<number>('mostRecentOffsetTime'),
				this.ctx.storage.get<number>('leastRecentOffsetTime'),
			]);
			this.mostRecentOffsetTime = mostRecentOffsetTime || this.mostRecentOffsetTime;
			this.leastRecentOffsetTime = leastRecentOffsetTime || this.leastRecentOffsetTime;
			this.setupDatabase();
		});
	}

	setupDatabase() {
		this.sql.exec(`
        CREATE TABLE IF NOT EXISTS geo_link_clicks (
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          country TEXT NOT NULL,
          time INTEGER NOT NULL
        )
      `);
	}

	async addClick(latitude: number, longitude: number, country: string, time: number) {
		this.sql.exec(
			`
      INSERT INTO geo_link_clicks (latitude, longitude, country, time)
      VALUES (?, ?, ?, ?)
    `,
			latitude,
			longitude,
			country,
			time
		);
		const alarm = await this.ctx.storage.getAlarm();
		if (!alarm) {
			const twoSecondsFromNow = Date.now() + 1000 * 2; // 2 seconds from now
			await this.ctx.storage.setAlarm(twoSecondsFromNow);
		}
	}

	async fetch(_: Request) {
		const webSocketPair = new WebSocketPair();
		const [client, server] = Object.values(webSocketPair);
		this.ctx.acceptWebSocket(server);
		return new Response(null, { status: 101, webSocket: client });
	}

	webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): void | Promise<void> {
		console.log('WebSocket closed', code, reason, wasClean);
	}

	async alarm() {
		console.log('LinkClickTracker alarm triggered');
		const clickData = getRecentClicks(this.sql, this.mostRecentOffsetTime);
		const sockets = this.ctx.getWebSockets();
		for (const socket of sockets) {
			socket.send(JSON.stringify(clickData.clicks));
		}
		await this.flushOffsetTimes(clickData.mostRecentTime, clickData.oldestTime);
		deleteClicksBefore(this.sql, clickData.oldestTime);
	}

	async flushOffsetTimes(mostRecentOffsetTime: number, leastRecentOffsetTime: number) {
		this.mostRecentOffsetTime = mostRecentOffsetTime;
		this.leastRecentOffsetTime = leastRecentOffsetTime;
		await this.ctx.storage.put('mostRecentOffsetTime', this.mostRecentOffsetTime);
		await this.ctx.storage.put('leastRecentOffsetTime', this.leastRecentOffsetTime);
	}
}
