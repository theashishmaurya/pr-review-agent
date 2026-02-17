// Linear Ticket Adapter (Stub for Phase 2)

import { TicketAdapter } from './base';
import { Ticket, TicketContext } from '../../types';

interface LinearConfig {
  apiKey: string;
}

export class LinearAdapter implements TicketAdapter {
  readonly name = 'linear';
  private config: LinearConfig;

  constructor(config: LinearConfig) {
    this.config = config;
  }

  matches(ticketId: string): boolean {
    return /^[A-Z]{2,}-\d+$/.test(ticketId);
  }

  async getTicket(ticketId: string): Promise<Ticket> {
    // TODO: Implement Linear API call
    throw new Error('Linear adapter not implemented yet (Phase 2)');
  }

  async getTicketContext(ticketId: string): Promise<TicketContext> {
    // TODO: Implement Linear API call
    throw new Error('Linear adapter not implemented yet (Phase 2)');
  }
}
