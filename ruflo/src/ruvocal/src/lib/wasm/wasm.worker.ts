/**
 * WASM MCP Web Worker — Off-main-thread JSON-RPC server.
 *
 * Owns one WasmMcpServer + one WasmGallery instance and proxies the MCP
 * surface (handle_message) plus the most common gallery operations
 * (list / search / count / setActive / getActive) so the main thread
 * never blocks on the ~300ms WASM compile or on tool execution.
 *
 * Wire format (request → main → worker):
 *   { id: number, method: "load" | "callMcp" | "gallery.X", params?: unknown }
 *
 * Wire format (response → worker → main):
 *   { id: number, result?: unknown, error?: string }
 *
 * Side-channel: { id: 0, type: "log", level, args } — forwarded console output.
 */

import { loadWasm } from "./index";
import type { WasmMcpServer, WasmGallery, GalleryTemplate, SearchResult } from "./index";

interface WorkerRequest {
	id: number;
	method: string;
	params?: unknown;
}

interface WorkerResponse {
	id: number;
	result?: unknown;
	error?: string;
}

let mcpServer: WasmMcpServer | null = null;
let gallery: WasmGallery | null = null;
let loadPromise: Promise<void> | null = null;

const ctx = self as unknown as Worker;

function reply(id: number, result?: unknown, error?: string) {
	const msg: WorkerResponse = { id };
	if (error !== undefined) msg.error = error;
	else msg.result = result;
	ctx.postMessage(msg);
}

async function ensureLoaded(): Promise<void> {
	if (mcpServer && gallery) return;
	if (loadPromise) return loadPromise;

	loadPromise = (async () => {
		const wasm = await loadWasm();
		if (!wasm) throw new Error("Failed to load WASM module in worker");
		mcpServer = new wasm.WasmMcpServer();
		gallery = new wasm.WasmGallery();

		// Initialize the JSON-RPC handshake the same way the store does.
		const initReq = JSON.stringify({
			jsonrpc: "2.0",
			id: 1,
			method: "initialize",
			params: {
				protocolVersion: "2024-11-05",
				clientInfo: { name: "ruvocal-ui-worker", version: "1.0.0" },
			},
		});
		const initRes = JSON.parse(mcpServer.handle_message(initReq));
		if (initRes.error) throw new Error(initRes.error.message ?? "MCP init failed");
	})();

	await loadPromise;
}

ctx.addEventListener("message", async (event: MessageEvent<WorkerRequest>) => {
	const { id, method, params } = event.data;

	try {
		await ensureLoaded();
		if (!mcpServer || !gallery) throw new Error("WASM not initialized");

		switch (method) {
			case "load":
				reply(id, true);
				return;

			case "callMcp": {
				const message = JSON.stringify(params);
				const response = mcpServer.handle_message(message);
				reply(id, JSON.parse(response));
				return;
			}

			case "gallery.list":
				reply(id, gallery.list() as GalleryTemplate[]);
				return;

			case "gallery.listByCategory":
				reply(id, gallery.listByCategory(params as string) as GalleryTemplate[]);
				return;

			case "gallery.search":
				reply(id, gallery.search(params as string) as SearchResult[]);
				return;

			case "gallery.get":
				reply(id, gallery.get(params as string) as GalleryTemplate);
				return;

			case "gallery.setActive":
				gallery.setActive(params as string);
				reply(id, true);
				return;

			case "gallery.getActive":
				reply(id, gallery.getActive());
				return;

			case "gallery.count":
				reply(id, gallery.count());
				return;

			case "gallery.getCategories":
				reply(id, gallery.getCategories());
				return;

			default:
				reply(id, undefined, `Unknown method: ${method}`);
		}
	} catch (err) {
		reply(id, undefined, err instanceof Error ? err.message : String(err));
	}
});

// Signal readiness to anyone listening for it.
ctx.postMessage({ id: 0, type: "ready" });
