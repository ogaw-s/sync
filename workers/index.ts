import { Room } from './room';

export { Room };

interface Env {
  ROOM: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS for preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': '*',
        },
      });
    }

    // WebSocket connection
    if (url.pathname === '/ws') {
      const roomId = url.searchParams.get('room') || 'default';
      const id = env.ROOM.idFromName(roomId);
      const room = env.ROOM.get(id);
      return room.fetch(request);
    }

    return new Response('Band Sync WebSocket Server', {
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  },
};
