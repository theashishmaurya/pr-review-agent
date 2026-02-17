// Ticket Adapter Base Interface

import { Ticket, TicketContext } from '../../types';

export interface TicketAdapter {
  readonly name: string;
  
  getTicket(ticketId: string): Promise<Ticket>;
  getTicketContext(ticketId: string): Promise<TicketContext>;
  matches(ticketId: string): boolean;
}
