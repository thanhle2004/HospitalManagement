import { Injectable } from '@nestjs/common';
import { Patient, PatientType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type Db = PrismaService | Prisma.TransactionClient;
export type PatientWithType = Patient & { patientType: PatientType };

@Injectable()
export class PatientsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByPhone(phone: string, db: Db = this.prisma): Promise<Patient | null> {
    return db.patient.findUnique({ where: { phone } });
  }

  findById(
    id: string,
    db: Db = this.prisma,
  ): Promise<PatientWithType | null> {
    return db.patient.findUnique({
      where: { id },
      include: { patientType: true },
    });
  }

  create(
    data: Prisma.PatientCreateInput,
    db: Db = this.prisma,
  ): Promise<Patient> {
    return db.patient.create({ data });
  }

  incrementTokenVersion(id: string, db: Db = this.prisma): Promise<Patient> {
    return db.patient.update({
      where: { id },
      data: { tokenVersion: { increment: 1 } },
    });
  }

  findDefaultPatientType(db: Db = this.prisma): Promise<PatientType | null> {
    return db.patientType.findUnique({ where: { code: 'STANDARD' } });
  }
}
