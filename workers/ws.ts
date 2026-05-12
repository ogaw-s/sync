import { Room } from './room';

export { Room };

interface Env {
  ROOM: DurableObjectNamespace;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const roomId = new URL(context.request.url).searchParams.get('room') || 'default';
  const id = context.env.ROOM.idFromName(roomId);
  const room = context.env.ROOM.get(id);
  return room.fetch(context.request);
};
