import { ConflictException, Injectable } from '@nestjs/common';
import { Op } from 'sequelize';

import { Company } from '../../db/models/Company';
import {
  Ticket,
  TicketCategory,
  TicketStatus,
  TicketType,
} from '../../db/models/Ticket';
import { User, UserRole } from '../../db/models/User';
import { newTicketDto } from './tickets.dto';

@Injectable()
export class TicketsService {
  async findAll(): Promise<Ticket[]> {
    return await Ticket.findAll({ include: [Company, User] });
  }

  private mappingRoleAndCategory(type: TicketType) {
    switch (type) {
      case TicketType.managementReport:
        return {
          category: TicketCategory.accounting,
          userRole: UserRole.accountant,
        };
      case TicketType.registrationAddressChange:
        return {
          category: TicketCategory.corporate,
          userRole: UserRole.corporateSecretary,
        };
      case TicketType.strikeOff:
        return {
          category: TicketCategory.management,
          userRole: UserRole.director,
        };
      default:
        throw new ConflictException(
          `Ticket with this type ${type as string} is not supported`,
        );
    }
  }

  async create(newTicketDto: newTicketDto): Promise<Ticket> {
    const { type, companyId } = newTicketDto;

    if (type === TicketType.registrationAddressChange) {
      const existingTicket = await Ticket.findOne({
        where: {
          companyId: companyId,
          type: TicketType.registrationAddressChange,
          status: TicketStatus.open,
        },
      });

      if (existingTicket) {
        throw new ConflictException(
          `Duplicate type ${TicketType.registrationAddressChange}, ticket already exists`,
        );
      }
    }

    const { category, userRole } = this.mappingRoleAndCategory(type);
    let role = userRole;
    let assignees = await User.findAll({
      where: { companyId, role },
      order: [['createdAt', 'DESC']],
    });

    // find director role if ticket type is registrationAddressChange and no corporate secretary found
    if (type === TicketType.registrationAddressChange && !assignees.length) {
      role = UserRole.director;
      assignees = await User.findAll({
        where: { companyId, role },
        order: [['createdAt', 'DESC']],
      });
    }

    if (!assignees.length)
      throw new ConflictException(
        `Cannot find user with role ${role} to create a ticket`,
      );

    if (type !== TicketType.managementReport && assignees.length > 1)
      throw new ConflictException(
        `Multiple users with role ${role}. Cannot create a ticket`,
      );

    const assignee = assignees[0];

    if (type === TicketType.strikeOff) {
      const transaction = await Ticket.sequelize?.transaction();

      try {
        const ticket = await Ticket.create(
          {
            companyId,
            assigneeId: assignee.id,
            category,
            type,
            status: TicketStatus.open,
          },
          { transaction },
        );

        await Ticket.update(
          { status: TicketStatus.resolved },
          {
            where: {
              companyId,
              status: TicketStatus.open,
              id: { [Op.ne]: ticket.id },
            },
            transaction,
          },
        );

        await transaction?.commit();

        return ticket;
      } catch (error) {
        await transaction?.rollback();
        throw error;
      }
    } else {
      const ticket = await Ticket.create({
        companyId,
        assigneeId: assignee.id,
        category,
        type,
        status: TicketStatus.open,
      });

      return ticket;
    }
  }
}
