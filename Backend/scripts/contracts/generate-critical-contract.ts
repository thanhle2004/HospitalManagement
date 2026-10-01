import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { OpenAPIObject } from '@nestjs/swagger';
import { AppModule } from '../../src/app.module';
import { createOpenApiDocument } from '../../src/openapi';

const CRITICAL_PATHS = [
  '/api/v1/auth/sessions/current',
  '/activity-logs',
  '/simulation/benchmark/run',
  '/simulation/benchmark/compare',
] as const;

async function main(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  await app.init();
  try {
    const full = createOpenApiDocument(app);
    const paths = Object.fromEntries(
      CRITICAL_PATHS.map((path) => {
        const item = full.paths[path];
        if (!item) throw new Error(`Critical OpenAPI path missing: ${path}`);
        return [path, item];
      }),
    );
    const referencedSchemas = new Set<string>();
    const visitRefs = (value: unknown): void => {
      if (!value || typeof value !== 'object') return;
      if ('$ref' in value && typeof value.$ref === 'string') {
        const prefix = '#/components/schemas/';
        if (value.$ref.startsWith(prefix)) {
          const name = value.$ref.slice(prefix.length);
          if (!referencedSchemas.has(name)) {
            referencedSchemas.add(name);
            visitRefs(full.components?.schemas?.[name]);
          }
        }
      }
      for (const child of Object.values(value)) visitRefs(child);
    };
    visitRefs(paths);
    const document: OpenAPIObject = {
      ...full,
      info: { ...full.info, title: 'HospitalManagement Critical Staff Contract' },
      paths,
      components: {
        ...full.components,
        schemas: Object.fromEntries(
          [...referencedSchemas]
            .sort()
            .map((name) => [name, full.components?.schemas?.[name]] as const)
            .filter((entry): entry is readonly [string, NonNullable<(typeof entry)[1]>] => entry[1] !== undefined),
        ),
      },
    };
    const output = resolve(process.cwd(), '../contracts/critical-staff.openapi.json');
    await writeFile(output, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  } finally {
    await app.close();
  }
}

void main();
