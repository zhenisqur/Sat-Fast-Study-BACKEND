import { PrismaService } from '../database/prisma.service';

export abstract class BaseRepository<T> {
  constructor(protected readonly prisma: PrismaService, protected readonly modelName: string) {}

  async findById(id: string): Promise<T | null> {
    return (this.prisma as any)[this.modelName].findUnique({ where: { id } });
  }
  async findMany(where: Record<string, any> = {}): Promise<T[]> {
    return (this.prisma as any)[this.modelName].findMany({ where });
  }
  async create(data: Partial<T>): Promise<T> {
    return (this.prisma as any)[this.modelName].create({ data });
  }
  async update(id: string, data: Partial<T>): Promise<T> {
    return (this.prisma as any)[this.modelName].update({ where: { id }, data });
  }
  async delete(id: string): Promise<T> {
    return (this.prisma as any)[this.modelName].delete({ where: { id } });
  }
}
