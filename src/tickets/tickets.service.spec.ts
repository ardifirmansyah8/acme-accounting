/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { Op } from 'sequelize';

import { TicketsService } from './tickets.service';
import {
  Ticket,
  TicketCategory,
  TicketStatus,
  TicketType,
} from '../../db/models/Ticket';
import { User, UserRole } from '../../db/models/User';
import { Company } from '../../db/models/Company';

// Mock the models
jest.mock('../../db/models/Ticket');
jest.mock('../../db/models/User');
jest.mock('../../db/models/Company');

describe('TicketsService', () => {
  let service: TicketsService;
  let mockTransaction: any;

  // Mock data
  const mockUser = {
    id: 1,
    companyId: 1,
    role: UserRole.corporateSecretary,
    createdAt: new Date(),
  };

  const mockDirector = {
    id: 2,
    companyId: 1,
    role: UserRole.director,
    createdAt: new Date(),
  };

  const mockTicket = {
    id: 1,
    companyId: 1,
    assigneeId: 1,
    category: TicketCategory.corporate,
    type: TicketType.registrationAddressChange,
    status: TicketStatus.open,
  };

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock transaction object
    mockTransaction = {
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
    };

    // Mock Ticket.sequelize.transaction
    (Ticket as any).sequelize = {
      transaction: jest.fn().mockResolvedValue(mockTransaction),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [TicketsService],
    }).compile();

    service = module.get<TicketsService>(TicketsService);
  });

  describe('findAll', () => {
    it('should return all tickets with includes', async () => {
      const expectedTickets = [mockTicket];
      (Ticket.findAll as jest.Mock).mockResolvedValue(expectedTickets);

      const result = await service.findAll();

      expect(Ticket.findAll).toHaveBeenCalledWith({
        include: [Company, User],
      });
      expect(result).toEqual(expectedTickets);
    });
  });

  describe('mappingRoleAndCategory', () => {
    it('should return correct mapping for managementReport', () => {
      const result = (service as any).mappingRoleAndCategory(
        TicketType.managementReport,
      );

      expect(result).toEqual({
        category: TicketCategory.accounting,
        userRole: UserRole.accountant,
      });
    });

    it('should return correct mapping for registrationAddressChange', () => {
      const result = (service as any).mappingRoleAndCategory(
        TicketType.registrationAddressChange,
      );

      expect(result).toEqual({
        category: TicketCategory.corporate,
        userRole: UserRole.corporateSecretary,
      });
    });

    it('should return correct mapping for strikeOff', () => {
      const result = (service as any).mappingRoleAndCategory(
        TicketType.strikeOff,
      );

      expect(result).toEqual({
        category: TicketCategory.management,
        userRole: UserRole.director,
      });
    });

    it('should throw ConflictException for unsupported ticket type', () => {
      expect(() => {
        (service as any).mappingRoleAndCategory('invalidType' as TicketType);
      }).toThrow(ConflictException);
    });
  });

  describe('create', () => {
    beforeEach(() => {
      (User.findAll as jest.Mock).mockResolvedValue([mockUser]);
      (Ticket.findOne as jest.Mock).mockResolvedValue(null);
      (Ticket.create as jest.Mock).mockResolvedValue(mockTicket);
      (Ticket.update as jest.Mock).mockResolvedValue([1]);
    });

    describe('managementReport ticket', () => {
      it('should create managementReport ticket successfully', async () => {
        const accountant = { ...mockUser, role: UserRole.accountant };
        (User.findAll as jest.Mock).mockResolvedValue([accountant]);

        const newTicketDto = {
          type: TicketType.managementReport,
          companyId: 1,
        };

        const result = await service.create(newTicketDto);

        expect(User.findAll).toHaveBeenCalledWith({
          where: { companyId: 1, role: UserRole.accountant },
          order: [['createdAt', 'DESC']],
        });

        expect(Ticket.create).toHaveBeenCalledWith({
          companyId: 1,
          assigneeId: accountant.id,
          category: TicketCategory.accounting,
          type: TicketType.managementReport,
          status: TicketStatus.open,
        });

        expect(result).toEqual(mockTicket);
      });

      it('should allow multiple accountants for managementReport', async () => {
        const accountants = [
          { ...mockUser, id: 1, role: UserRole.accountant },
          { ...mockUser, id: 2, role: UserRole.accountant },
        ];
        (User.findAll as jest.Mock).mockResolvedValue(accountants);

        const newTicketDto = {
          type: TicketType.managementReport,
          companyId: 1,
        };

        const result = await service.create(newTicketDto);

        expect(result).toEqual(mockTicket);
        expect(Ticket.create).toHaveBeenCalledWith({
          companyId: 1,
          assigneeId: accountants[0].id, // Should take the first one
          category: TicketCategory.accounting,
          type: TicketType.managementReport,
          status: TicketStatus.open,
        });
      });
    });

    describe('registrationAddressChange ticket', () => {
      it('should create registrationAddressChange ticket successfully', async () => {
        const newTicketDto = {
          type: TicketType.registrationAddressChange,
          companyId: 1,
        };

        const result = await service.create(newTicketDto);

        expect(Ticket.findOne).toHaveBeenCalledWith({
          where: {
            companyId: 1,
            type: TicketType.registrationAddressChange,
            status: TicketStatus.open,
          },
        });

        expect(User.findAll).toHaveBeenCalledWith({
          where: { companyId: 1, role: UserRole.corporateSecretary },
          order: [['createdAt', 'DESC']],
        });

        expect(result).toEqual(mockTicket);
      });

      it('should throw ConflictException if duplicate registrationAddressChange exists', async () => {
        (Ticket.findOne as jest.Mock).mockResolvedValue(mockTicket);

        const newTicketDto = {
          type: TicketType.registrationAddressChange,
          companyId: 1,
        };

        await expect(service.create(newTicketDto)).rejects.toThrow(
          new ConflictException(
            `Duplicate type ${TicketType.registrationAddressChange}, ticket already exists`,
          ),
        );
      });

      it('should fallback to director when no corporate secretary found', async () => {
        (User.findAll as jest.Mock)
          .mockResolvedValueOnce([]) // No corporate secretary
          .mockResolvedValueOnce([mockDirector]); // Director found

        const newTicketDto = {
          type: TicketType.registrationAddressChange,
          companyId: 1,
        };

        const result = await service.create(newTicketDto);

        expect(User.findAll).toHaveBeenCalledTimes(2);
        expect(User.findAll).toHaveBeenNthCalledWith(1, {
          where: { companyId: 1, role: UserRole.corporateSecretary },
          order: [['createdAt', 'DESC']],
        });
        expect(User.findAll).toHaveBeenNthCalledWith(2, {
          where: { companyId: 1, role: UserRole.director },
          order: [['createdAt', 'DESC']],
        });

        expect(result).toEqual(mockTicket);
      });

      it('should throw ConflictException if multiple corporate secretaries found', async () => {
        const secretaries = [mockUser, { ...mockUser, id: 2 }];
        (User.findAll as jest.Mock).mockResolvedValue(secretaries);

        const newTicketDto = {
          type: TicketType.registrationAddressChange,
          companyId: 1,
        };

        await expect(service.create(newTicketDto)).rejects.toThrow(
          new ConflictException(
            `Multiple users with role ${UserRole.corporateSecretary}. Cannot create a ticket`,
          ),
        );
      });

      it('should throw ConflictException if multiple directors found during fallback', async () => {
        const directors = [mockDirector, { ...mockDirector, id: 3 }];
        (User.findAll as jest.Mock)
          .mockResolvedValueOnce([]) // No corporate secretary
          .mockResolvedValueOnce(directors); // Multiple directors

        const newTicketDto = {
          type: TicketType.registrationAddressChange,
          companyId: 1,
        };

        await expect(service.create(newTicketDto)).rejects.toThrow(
          new ConflictException(
            `Multiple users with role ${UserRole.director}. Cannot create a ticket`,
          ),
        );
      });
    });

    describe('strikeOff ticket', () => {
      it('should create strikeOff ticket and resolve other tickets', async () => {
        (User.findAll as jest.Mock).mockResolvedValue([mockDirector]);

        const newTicketDto = {
          type: TicketType.strikeOff,
          companyId: 1,
        };

        const result = await service.create(newTicketDto);

        expect(Ticket.sequelize?.transaction).toHaveBeenCalled();

        expect(Ticket.create).toHaveBeenCalledWith(
          {
            companyId: 1,
            assigneeId: mockDirector.id,
            category: TicketCategory.management,
            type: TicketType.strikeOff,
            status: TicketStatus.open,
          },
          { transaction: mockTransaction },
        );

        expect(Ticket.update).toHaveBeenCalledWith(
          { status: TicketStatus.resolved },
          {
            where: {
              companyId: 1,
              status: TicketStatus.open,
              id: { [Op.ne]: mockTicket.id },
            },
            transaction: mockTransaction,
          },
        );

        expect(mockTransaction.commit).toHaveBeenCalled();
        expect(result).toEqual(mockTicket);
      });

      it('should rollback transaction if strikeOff creation fails', async () => {
        (User.findAll as jest.Mock).mockResolvedValue([mockDirector]);
        (Ticket.create as jest.Mock).mockRejectedValue(
          new Error('Database error'),
        );

        const newTicketDto = {
          type: TicketType.strikeOff,
          companyId: 1,
        };

        await expect(service.create(newTicketDto)).rejects.toThrow(
          'Database error',
        );

        expect(mockTransaction.rollback).toHaveBeenCalled();
        expect(mockTransaction.commit).not.toHaveBeenCalled();
      });

      it('should throw ConflictException if multiple directors found for strikeOff', async () => {
        const directors = [mockDirector, { ...mockDirector, id: 3 }];
        (User.findAll as jest.Mock).mockResolvedValue(directors);

        const newTicketDto = {
          type: TicketType.strikeOff,
          companyId: 1,
        };

        await expect(service.create(newTicketDto)).rejects.toThrow(
          new ConflictException(
            `Multiple users with role ${UserRole.director}. Cannot create a ticket`,
          ),
        );
      });
    });

    describe('error cases', () => {
      it('should throw ConflictException if no assignee found', async () => {
        (User.findAll as jest.Mock).mockResolvedValue([]);

        const newTicketDto = {
          type: TicketType.managementReport,
          companyId: 1,
        };

        await expect(service.create(newTicketDto)).rejects.toThrow(
          new ConflictException(
            `Cannot find user with role ${UserRole.accountant} to create a ticket`,
          ),
        );
      });

      it('should throw ConflictException if no director found during fallback', async () => {
        (User.findAll as jest.Mock)
          .mockResolvedValueOnce([]) // No corporate secretary
          .mockResolvedValueOnce([]); // No director

        const newTicketDto = {
          type: TicketType.registrationAddressChange,
          companyId: 1,
        };

        await expect(service.create(newTicketDto)).rejects.toThrow(
          new ConflictException(
            `Cannot find user with role ${UserRole.director} to create a ticket`,
          ),
        );
      });
    });
  });
});
