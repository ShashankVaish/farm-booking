import { Injectable } from '@nestjs/common';
import { paginated } from '../../common/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSupportTicketDto } from './dto/support.dto';

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, dto: CreateSupportTicketDto) {
    return this.prisma.supportTicket.create({
      data: {
        userId,
        subject: dto.subject.trim(),
        message: dto.message.trim(),
        priority: dto.priority,
      },
    });
  }

  async listMine(userId: string, page: number, limit: number) {
    const where = { userId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.supportTicket.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.supportTicket.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }
}
