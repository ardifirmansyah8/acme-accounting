import { Body, Controller, Get, Post } from '@nestjs/common';

import { newTicketDto, TicketDto } from './tickets.dto';
import { TicketsService } from './tickets.service';

@Controller('api/v1/tickets')
export class TicketsController {
  constructor(private ticketsService: TicketsService) {}

  @Get()
  async findAll(): Promise<TicketDto[]> {
    const tickets = await this.ticketsService.findAll();

    return tickets.map((ticket) => ({
      id: ticket.id,
      type: ticket.type,
      companyId: ticket.companyId,
      assigneeId: ticket.assigneeId,
      status: ticket.status,
      category: ticket.category,
    }));
  }

  @Post()
  async create(@Body() newTicketDto: newTicketDto): Promise<TicketDto> {
    const ticket = await this.ticketsService.create(newTicketDto);
    const ticketDto: TicketDto = {
      id: ticket.id,
      type: ticket.type,
      assigneeId: ticket.assigneeId,
      status: ticket.status,
      category: ticket.category,
      companyId: ticket.companyId,
    };

    return ticketDto;
  }
}
