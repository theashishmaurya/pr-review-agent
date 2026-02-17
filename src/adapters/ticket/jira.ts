// Jira Ticket Adapter (Stub for Phase 2)

import { TicketAdapter } from './base';
import { Ticket, TicketContext } from '../../types';

interface JiraConfig {
  url: string;
  token: string;
}

export class JiraAdapter implements TicketAdapter {
  readonly name = 'jira';
  private config: JiraConfig;

  constructor(config: JiraConfig) {
    this.config = config;
  }

  matches(ticketId: string): boolean {
    return /^[A-Z]+-\d+$/.test(ticketId);
  }

  async getTicket(ticketId: string): Promise<Ticket> {
    // TODO: Implement Jira API call
    throw new Error('Jira adapter not implemented yet (Phase 2)');
  }

  async getTicketContext(ticketId: string): Promise<TicketContext> {
    // TODO: Implement Jira API call
    throw new Error('Jira adapter not implemented yet (Phase 2)');
  }
}
