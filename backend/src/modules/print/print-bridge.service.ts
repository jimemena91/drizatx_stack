import { Injectable } from '@nestjs/common';

export interface ConnectedBridgeSession {
  bridgeId: string;
  socketId: string;
  connectedAt: Date;
  lastHeartbeatAt: Date;
}

@Injectable()
export class PrintBridgeService {
  private readonly connectedBridges = new Map<string, ConnectedBridgeSession>();

  registerConnection(bridgeId: string, socketId: string) {
    const session: ConnectedBridgeSession = {
      bridgeId,
      socketId,
      connectedAt: new Date(),
      lastHeartbeatAt: new Date(),
    };

    this.connectedBridges.set(bridgeId, session);

    return session;
  }

  unregisterConnectionBySocketId(socketId: string) {
    for (const [bridgeId, session] of this.connectedBridges.entries()) {
      if (session.socketId === socketId) {
        this.connectedBridges.delete(bridgeId);
        return true;
      }
    }

    return false;
  }

  updateHeartbeat(bridgeId: string) {
    const session = this.connectedBridges.get(bridgeId);
    if (!session) {
      return null;
    }

    session.lastHeartbeatAt = new Date();
    this.connectedBridges.set(bridgeId, session);

    return session;
  }

  getConnectedBridge(bridgeId: string) {
    return this.connectedBridges.get(bridgeId) ?? null;
  }

  listConnectedBridges() {
    return Array.from(this.connectedBridges.values());
  }
}
