import { Injectable } from '@nestjs/common';
import { PatientType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type Db = PrismaService | Prisma.TransactionClient;

@Injectable()
export class PatientTypesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByCode(code: string, db: Db = this.prisma): Promise<PatientType | null> {
    return db.patientType.findUnique({ where: { code } });
  }

  create(data: Prisma.PatientTypeCreateInput, db: Db = this.prisma): Promise<PatientType> {
    return db.patientType.create({ data });
  }

  findAll(db: Db = this.prisma): Promise<PatientType[]> {
    return db.patientType.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  findById(id: number, db: Db = this.prisma): Promise<PatientType | null> {
    return db.patientType.findFirst({ where: { id, deletedAt: null } });
  }

  update(
    id: number,
    data: Prisma.PatientTypeUpdateInput,
    db: Db = this.prisma,
  ): Promise<PatientType> {
    return db.patientType.update({ where: { id }, data });
  }

  softDelete(id: number, db: Db = this.prisma): Promise<PatientType> {
    return db.patientType.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
