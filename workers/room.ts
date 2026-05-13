interface Client {
  id: string;
  ready: boolean;
  ws: WebSocket;
}

interface Message {
  type: string;
  clientId?: string;
}

export class Room {
  private clients: Map<string, Client> = new Map();

  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    const clientId = crypto.randomUUID();

    server.accept();

    this.clients.set(clientId, {
      id: clientId,
      ready: false,
      ws: server,
    });

    server.send(JSON.stringify({ type: 'welcome', clientId }));
    this.broadcastStatus();

    server.addEventListener('message', (event) => {
      this.handleMessage(clientId, event.data as string);
    });

    server.addEventListener('close', () => {
      this.clients.delete(clientId);
      this.broadcastStatus();
    });

    server.addEventListener('error', () => {
      this.clients.delete(clientId);
      this.broadcastStatus();
    });

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  private handleMessage(clientId: string, data: string): void {
    let message: Message;
    try {
      message = JSON.parse(data);
    } catch {
      return;
    }

    switch (message.type) {
      case 'ready':
        this.handleReady(clientId);
        break;
      case 'unready':
        this.handleUnready(clientId);
        break;
      case 'start':
        this.handleStart();
        break;
    }
  }

  private handleReady(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.ready = true;
      this.broadcastStatus();
    }
  }

  private handleUnready(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.ready = false;
      this.broadcastStatus();
    }
  }

  private handleStart(): void {
    
    const message = JSON.stringify({ type: 'countdown' });
    this.broadcast(message);
  }

  private broadcastStatus(): void {
    const clients = Array.from(this.clients.values()).map((c) => ({
      id: c.id,
      ready: c.ready,
    }));
    const message = JSON.stringify({ type: 'status', clients });
    this.broadcast(message);
  }

  private broadcast(message: string): void {
    for (const client of this.clients.values()) {
      try {
        client.ws.send(message);
      } catch {
        // Client disconnected
      }
    }
  }
}
