import { createHash } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';

type UnknownRow = Record<string, unknown>;

const prisma = new PrismaClient();

const stringify = (value: unknown): string =>
  JSON.stringify(
    value,
    (_key, current) =>
      typeof current === 'bigint' ? current.toString() : current,
    2,
  );

async function optionalQuery<T>(
  label: string,
  query: () => Promise<T>,
  warnings: string[],
): Promise<T | []> {
  try {
    return await query();
  } catch {
    warnings.push(`${label} unavailable for the current database account`);
    return [];
  }
}

async function main(): Promise<void> {
  const outputDirectory = resolve(
    process.argv[2] ?? '../artifacts/db-inventory',
  );
  const generatedAt = new Date();
  const timestamp = generatedAt.toISOString().replace(/[:.]/g, '-');
  const warnings: string[] = [];

  const database = await prisma.$queryRaw<UnknownRow[]>`
    SELECT
      DATABASE() AS databaseName,
      @@version AS serverVersion,
      @@version_comment AS serverDistribution,
      @@character_set_database AS characterSet,
      @@collation_database AS collation,
      @@transaction_isolation AS transactionIsolation
  `;

  const tables = await prisma.$queryRaw<UnknownRow[]>`
    SELECT
      TABLE_NAME AS tableName,
      TABLE_TYPE AS tableType,
      ENGINE AS engine,
      TABLE_ROWS AS estimatedRows,
      DATA_LENGTH AS dataBytes,
      INDEX_LENGTH AS indexBytes,
      CREATE_TIME AS createdAt,
      UPDATE_TIME AS updatedAt
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
    ORDER BY TABLE_TYPE, TABLE_NAME
  `;

  const columns = await prisma.$queryRaw<UnknownRow[]>`
    SELECT
      TABLE_NAME AS tableName,
      ORDINAL_POSITION AS ordinalPosition,
      COLUMN_NAME AS columnName,
      COLUMN_TYPE AS columnType,
      IS_NULLABLE AS isNullable,
      COLUMN_DEFAULT AS defaultValue,
      COLUMN_KEY AS columnKey,
      EXTRA AS extra
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    ORDER BY TABLE_NAME, ORDINAL_POSITION
  `;

  const indexes = await prisma.$queryRaw<UnknownRow[]>`
    SELECT
      TABLE_NAME AS tableName,
      INDEX_NAME AS indexName,
      NON_UNIQUE AS nonUnique,
      SEQ_IN_INDEX AS sequenceInIndex,
      COLUMN_NAME AS columnName,
      COLLATION AS collation,
      CARDINALITY AS cardinality,
      INDEX_TYPE AS indexType
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
    ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX
  `;

  const constraints = await prisma.$queryRaw<UnknownRow[]>`
    SELECT
      tc.TABLE_NAME AS tableName,
      tc.CONSTRAINT_NAME AS constraintName,
      tc.CONSTRAINT_TYPE AS constraintType,
      kcu.COLUMN_NAME AS columnName,
      kcu.REFERENCED_TABLE_NAME AS referencedTableName,
      kcu.REFERENCED_COLUMN_NAME AS referencedColumnName,
      rc.UPDATE_RULE AS updateRule,
      rc.DELETE_RULE AS deleteRule
    FROM information_schema.TABLE_CONSTRAINTS tc
    LEFT JOIN information_schema.KEY_COLUMN_USAGE kcu
      ON kcu.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA
      AND kcu.TABLE_NAME = tc.TABLE_NAME
      AND kcu.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
    LEFT JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
      ON rc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA
      AND rc.TABLE_NAME = tc.TABLE_NAME
      AND rc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
    WHERE tc.CONSTRAINT_SCHEMA = DATABASE()
    ORDER BY tc.TABLE_NAME, tc.CONSTRAINT_NAME, kcu.ORDINAL_POSITION
  `;

  const triggers = await prisma.$queryRaw<UnknownRow[]>`
    SELECT
      TRIGGER_NAME AS triggerName,
      EVENT_MANIPULATION AS eventManipulation,
      EVENT_OBJECT_TABLE AS eventObjectTable,
      ACTION_TIMING AS actionTiming,
      ACTION_ORIENTATION AS actionOrientation
    FROM information_schema.TRIGGERS
    WHERE TRIGGER_SCHEMA = DATABASE()
    ORDER BY TRIGGER_NAME
  `;

  const routines = await prisma.$queryRaw<UnknownRow[]>`
    SELECT
      ROUTINE_NAME AS routineName,
      ROUTINE_TYPE AS routineType,
      DATA_TYPE AS dataType,
      IS_DETERMINISTIC AS isDeterministic,
      SQL_DATA_ACCESS AS sqlDataAccess,
      CREATED AS createdAt,
      LAST_ALTERED AS lastAlteredAt
    FROM information_schema.ROUTINES
    WHERE ROUTINE_SCHEMA = DATABASE()
    ORDER BY ROUTINE_TYPE, ROUTINE_NAME
  `;

  const events = await prisma.$queryRaw<UnknownRow[]>`
    SELECT
      EVENT_NAME AS eventName,
      STATUS AS status,
      EVENT_TYPE AS eventType,
      INTERVAL_VALUE AS intervalValue,
      INTERVAL_FIELD AS intervalField,
      STARTS AS startsAt,
      ENDS AS endsAt,
      LAST_EXECUTED AS lastExecutedAt
    FROM information_schema.EVENTS
    WHERE EVENT_SCHEMA = DATABASE()
    ORDER BY EVENT_NAME
  `;

  const migrations = await optionalQuery(
    'Prisma migration history',
    () =>
      prisma.$queryRaw<UnknownRow[]>`
        SELECT
          migration_name AS migrationName,
          checksum,
          started_at AS startedAt,
          finished_at AS finishedAt,
          rolled_back_at AS rolledBackAt,
          applied_steps_count AS appliedStepsCount
        FROM _prisma_migrations
        ORDER BY started_at
      `,
    warnings,
  );

  const slowStatements = await optionalQuery(
    'performance_schema statement digests',
    () =>
      prisma.$queryRaw<UnknownRow[]>`
        SELECT
          DIGEST AS digest,
          DIGEST_TEXT AS normalizedStatement,
          COUNT_STAR AS executionCount,
          ROUND(SUM_TIMER_WAIT / 1000000000000, 6) AS totalSeconds,
          ROUND(AVG_TIMER_WAIT / 1000000000000, 6) AS averageSeconds,
          SUM_ROWS_EXAMINED AS rowsExamined,
          SUM_ROWS_SENT AS rowsSent,
          FIRST_SEEN AS firstSeenAt,
          LAST_SEEN AS lastSeenAt
        FROM performance_schema.events_statements_summary_by_digest
        WHERE SCHEMA_NAME = DATABASE() AND DIGEST IS NOT NULL
        ORDER BY SUM_TIMER_WAIT DESC
        LIMIT 20
      `,
    warnings,
  );

  const recordCounts: Record<string, string> = {};
  for (const table of tables) {
    if (table.tableType !== 'BASE TABLE') continue;
    const tableName = String(table.tableName);
    const escapedTableName = tableName.replace(/`/g, '``');
    const rows = await prisma.$queryRawUnsafe<Array<{ rowCount: bigint }>>(
      `SELECT COUNT(*) AS rowCount FROM \`${escapedTableName}\``,
    );
    recordCounts[tableName] = String(rows[0]?.rowCount ?? 0);
  }

  const snapshot = {
    formatVersion: 1,
    generatedAt: generatedAt.toISOString(),
    scope: 'metadata-and-counts-only',
    database: database[0] ?? null,
    summary: {
      tableCount: tables.filter((table) => table.tableType === 'BASE TABLE')
        .length,
      viewCount: tables.filter((table) => table.tableType === 'VIEW').length,
      triggerCount: triggers.length,
      routineCount: routines.length,
      eventCount: events.length,
      migrationCount: migrations.length,
    },
    recordCounts,
    tables,
    columns,
    indexes,
    constraints,
    triggers,
    routines,
    events,
    migrations,
    slowStatements,
    warnings,
  };
  const snapshotJson = stringify(snapshot);
  const checksum = createHash('sha256').update(snapshotJson).digest('hex');
  const report = stringify({ ...snapshot, sha256: checksum });
  const outputPath = resolve(outputDirectory, `inventory-${timestamp}.json`);

  await mkdir(outputDirectory, { recursive: true });
  await writeFile(outputPath, `${report}\n`, { encoding: 'utf8', flag: 'wx' });

  process.stdout.write(
    `${stringify({ outputPath, sha256: checksum, ...snapshot.summary, warnings })}\n`,
  );
}

main()
  .catch((error: unknown) => {
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    process.stderr.write(`Database inventory failed (${errorName})\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
