export class ChatSystem {
  constructor({ proximityRadius = 20, rateLimitMs = 2000, maxMessages = 100 } = {}) {
    this.proximityRadius = proximityRadius;
    this.rateLimitMs = rateLimitMs;
    this.maxMessages = maxMessages;
    this.messages = [];
    this.lastSendTime = 0;
    this.onNewMessage = null;
  }

  canSend() {
    const now = Date.now();
    if (now - this.lastSendTime < this.rateLimitMs) return false;
    this.lastSendTime = now;
    return true;
  }

  addMessage(msg) {
    this.messages.push(msg);
    if (this.messages.length > this.maxMessages) {
      this.messages.shift();
    }
    if (this.onNewMessage) this.onNewMessage(msg);
  }

  isInRange(posA, posB) {
    const dx = posA.x - posB.x;
    const dz = posA.z - posB.z;
    return (dx * dx + dz * dz) <= this.proximityRadius * this.proximityRadius;
  }

  getVisibleMessages(localPos) {
    return this.messages.filter(m => {
      const dx = localPos.x - (m.senderPosition?.x || 0);
      const dz = localPos.z - (m.senderPosition?.z || 0);
      return (dx * dx + dz * dz) <= this.proximityRadius * this.proximityRadius;
    });
  }

  setLocalPosition(pos) {
    this.localPosition = pos;
  }
}
