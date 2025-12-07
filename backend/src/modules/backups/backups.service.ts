import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { promises as fs, createReadStream, createWriteStream, ReadStream } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';
import { Service as ServiceEntity } from '../../entities/service.entity';
import { Operator } from '../../entities/operator.entity';
import { OperatorService } from '../../entities/operator-service.entity';
import { Ticket } from '../../entities/ticket.entity';
import { Client } from '../../entities/client.entity';
import { CustomMessage } from '../../entities/custom-message.entity';
import { SystemSetting } from '../../entities/system-setting.entity';
import { Role } from '../../entities/role.entity';
import { Permission } from '../../entities/permission.entity';
import { RolePermission } from '../../entities/role-permission.entity';
import { ReportSnapshot } from '../../entities/report-snapshot.entity';
import { OperatorRole } from '../../entities/operator-role.entity';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { ConfigService } from '@nestjs/config';

interface BackupPayload {
  services: any[];
  operatorServices: any[];
  operators: any[];
  operatorRoles: any[];
  tickets: any[];
  clients: any[];
  customMessages: any[];
  settings: any[];
  roles: any[];
  permissions: any[];
  rolePermissions: any[];
  reportSnapshots: any[];
}

export interface BackupResult {
  fileName: string;
  directory: string;
  fullPath: string;
  generatedAt: Date;
  size: number;
  mode: 'manual' | 'automatic';
}

export interface BackupStatus {
  configuredDirectory: string | null;
  resolvedDirectory: string;
  directoryExists: boolean;
  defaultDirectory: string;
  mysqldumpConfiguredPath: string | null;
  mysqldumpResolvedCommand: string;
  mysqldumpCommandSource: 'setting' | 'env' | 'default';
  mysqldumpAvailable: boolean;
  lastGeneratedAt: string | null;
  lastAutomaticAt: string | null;
  lastManualAt: string | null;
  lastFailureAt: string | null;
  lastFileName: string | null;
  lastDirectory: string;
  lastSize: number | null;
  lastError: string | null;
  enabled: boolean;
  time: string;
}

interface CreateBackupOptions {
  directory?: string;
  mode?: 'manual' | 'automatic';
  triggeredBy?: string | null;
}

interface ResolvedFile {
  fileName: string;
  directory: string;
  fullPath: string;
  size: number;
  stream: ReadStream;
}

interface DatabaseConnectionConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  provider: 'railway' | 'env';
}

interface DatabaseDumpInfo {
  fileName: string;
  size: number;
  provider: string;
  host: string;
  database: string;
}

interface MysqldumpInfo {
  configuredPath: string | null;
  envPath: string | null;
  command: string;
  source: 'setting' | 'env' | 'default';
  available: boolean;
}

@Injectable()
export class BackupsService {
  private readonly logger = new Logger(BackupsService.name);
  private readonly defaultDirectory: string;

  constructor(
    @InjectRepository(ServiceEntity)
    private readonly servicesRepo: Repository<ServiceEntity>,
    @InjectRepository(Operator)
    private readonly operatorsRepo: Repository<Operator>,
    @InjectRepository(OperatorService)
    private readonly operatorServicesRepo: Repository<OperatorService>,
    @InjectRepository(OperatorRole)
    private readonly operatorRolesRepo: Repository<OperatorRole>,
    @InjectRepository(Ticket)
    private readonly ticketsRepo: Repository<Ticket>,
    @InjectRepository(Client)
    private readonly clientsRepo: Repository<Client>,
    @InjectRepository(CustomMessage)
    private readonly customMessagesRepo: Repository<CustomMessage>,
    @InjectRepository(SystemSetting)
    private readonly systemSettingsRepo: Repository<SystemSetting>,
    @InjectRepository(Role)
    private readonly rolesRepo: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionsRepo: Repository<Permission>,
    @InjectRepository(RolePermission)
    private readonly rolePermissionsRepo: Repository<RolePermission>,
    @InjectRepository(ReportSnapshot)
    private readonly reportSnapshotsRepo: Repository<ReportSnapshot>,
    private readonly systemSettingsService: SystemSettingsService,
    private readonly configService: ConfigService,
  ) {
    this.defaultDirectory = this.computeDefaultDirectory();
  }

  async createBackup(options: CreateBackupOptions = {}): Promise<BackupResult> {
    const mode = options.mode ?? 'manual';
    const payload = await this.collectBackupPayload();

    const directory = await this.ensureDirectoryExists(
      options.directory ?? (await this.getConfiguredDirectoryValue()) ?? this.defaultDirectory,
    );
    const generatedAt = new Date();
    const fileName = `drizatx-backup-${this.formatTimestamp(generatedAt)}.tar.gz`;
    const fullPath = path.join(directory, path.basename(fileName));

    let tempDir: string | null = null;
    let archiveSize = 0;

    try {
      const connection = this.resolveDatabaseConnection();

      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'drizatx-backup-'));

      const dumpFileName = `database-${this.formatTimestamp(generatedAt)}.sql`;
      const dumpFilePath = path.join(tempDir, dumpFileName);
      const dumpInfo = await this.dumpDatabaseToFile(connection, dumpFilePath);

      const metadata = {
        generatedAt: generatedAt.toISOString(),
        mode,
        version: '2.0',
        directory,
        counts: {
          services: payload.services.length,
          operatorServices: payload.operatorServices.length,
          operators: payload.operators.length,
          operatorRoles: payload.operatorRoles.length,
          tickets: payload.tickets.length,
          clients: payload.clients.length,
          customMessages: payload.customMessages.length,
          settings: payload.settings.length,
          roles: payload.roles.length,
          permissions: payload.permissions.length,
          rolePermissions: payload.rolePermissions.length,
          reportSnapshots: payload.reportSnapshots.length,
        },
        databaseDump: {
          fileName: dumpFileName,
          size: dumpInfo.size,
          provider: connection.provider,
          host: connection.host,
          database: connection.database,
          generatedAt: generatedAt.toISOString(),
        },
      };

      const serialized = JSON.stringify({ metadata, data: payload }, null, 2);
      const jsonFileName = 'backup.json';
      await fs.writeFile(path.join(tempDir, jsonFileName), serialized, 'utf8');

      await this.createTarArchive(fullPath, tempDir, [jsonFileName, dumpFileName]);

      const stats = await fs.stat(fullPath);
      archiveSize = stats.size;

      await this.recordSuccess({ fileName, directory, fullPath, generatedAt, size: archiveSize, mode });
    } catch (error: any) {
      const message = error?.message ?? 'Error desconocido al generar el respaldo.';
      this.logger.error(`No se pudo generar el respaldo ${mode}`, error?.stack ?? message);

      if (error instanceof BadRequestException) {
        throw error;
      }

      if (this.isPermissionError(error)) {
        throw new BadRequestException(
          'No se pudo guardar el respaldo en la carpeta seleccionada. Verifica los permisos de escritura.',
        );
      }

      throw new BadRequestException(`No se pudo generar el respaldo: ${this.truncate(message, 400)}`);
    } finally {
      if (tempDir) {
        await this.safeRemoveDirectory(tempDir);
      }
    }

    this.logger.log(`Respaldo ${mode} generado en ${fullPath}`);

    return { fileName, directory, fullPath, generatedAt, size: archiveSize, mode };
  }

  async shouldRunAutomaticBackup(now: Date): Promise<boolean> {
    if (!(await this.isAutomaticEnabled())) return false;

    const { hour, minute } = await this.getConfiguredTime();
    if (now.getHours() !== hour || now.getMinutes() !== minute) return false;

    const lastAutomatic = await this.getSettingValue('backup.lastAutomaticAt');
    if (!lastAutomatic) return true;

    const last = new Date(lastAutomatic);
    if (Number.isNaN(last.getTime())) return true;

    const sameDay =
      last.getFullYear() === now.getFullYear() &&
      last.getMonth() === now.getMonth() &&
      last.getDate() === now.getDate();

    if (!sameDay) return true;

    const diffMs = Math.abs(now.getTime() - last.getTime());
    return diffMs >= 60_000;
  }

  async getStatus(): Promise<BackupStatus> {
    const [
      configuredDirectory,
      lastGeneratedAt,
      lastAutomaticAt,
      lastManualAt,
      lastFailureAt,
      lastFileName,
      lastDirectory,
      lastSize,
      lastError,
      enabled,
      time,
    ] = await Promise.all([
      this.getSettingValue('backup.directory'),
      this.getSettingValue('backup.lastGeneratedAt'),
      this.getSettingValue('backup.lastAutomaticAt'),
      this.getSettingValue('backup.lastManualAt'),
      this.getSettingValue('backup.lastFailureAt'),
      this.getSettingValue('backup.lastGeneratedFile'),
      this.getSettingValue('backup.lastDirectory'),
      this.getSettingValue('backup.lastSize'),
      this.getSettingValue('backup.lastError'),
      this.getSettingValue('backup.enabled'),
      this.getSettingValue('backup.time'),
    ]);

    const configured = configuredDirectory?.trim() || null;
    const resolvedDirectory = this.normalizeDirectory(configured ?? this.defaultDirectory);
    const exists = await this.pathExists(resolvedDirectory);
    const size = lastSize ? Number.parseInt(lastSize, 10) : null;
    const normalizedTime = this.normalizeTime(time ?? '02:00');
    const mysqldumpInfo = await this.resolveMysqldumpInfo();

    return {
      configuredDirectory: configured,
      resolvedDirectory,
      directoryExists: exists,
      defaultDirectory: this.defaultDirectory,
      mysqldumpConfiguredPath: mysqldumpInfo.configuredPath,
      mysqldumpResolvedCommand: mysqldumpInfo.command,
      mysqldumpCommandSource: mysqldumpInfo.source,
      mysqldumpAvailable: mysqldumpInfo.available,
      lastGeneratedAt: lastGeneratedAt ?? null,
      lastAutomaticAt: lastAutomaticAt ?? null,
      lastManualAt: lastManualAt ?? null,
      lastFailureAt: lastFailureAt ?? null,
      lastFileName: lastFileName ?? null,
      lastDirectory: lastDirectory?.trim() || resolvedDirectory,
      lastSize: Number.isFinite(size) ? size : null,
      lastError: lastError?.trim() ? lastError : null,
      enabled: this.normalizeBoolean(enabled, true),
      time: normalizedTime.formatted,
    };
  }

  async getBackupFile(fileName: string): Promise<ResolvedFile> {
    const safeName = path.basename(fileName);
    const directories = await this.collectCandidateDirectories();

    for (const directory of directories) {
      const fullPath = path.join(directory, safeName);
      try {
        const stats = await fs.stat(fullPath);
        if (!stats.isFile()) continue;
        return {
          fileName: safeName,
          directory,
          fullPath,
          size: stats.size,
          stream: createReadStream(fullPath),
        };
      } catch (error) {
        continue;
      }
    }

    throw new NotFoundException('Respaldo no encontrado');
  }

  async registerAutomaticFailure(error: Error): Promise<void> {
    const message = this.truncate(error?.message || 'Error desconocido al generar el respaldo');
    const iso = new Date().toISOString();
    await Promise.all([
      this.systemSettingsService.set(
        'backup.lastError',
        message,
        'Último error ocurrido al generar un respaldo',
      ),
      this.systemSettingsService.set(
        'backup.lastFailureAt',
        iso,
        'Fecha del último error al generar un respaldo',
      ),
    ]);
  }

  private computeDefaultDirectory(): string {
    const fromEnv = process.env.BACKUP_DIRECTORY?.trim();
    if (fromEnv) {
      return this.normalizeDirectory(fromEnv);
    }
    return path.resolve(process.cwd(), 'storage', 'backups');
  }

  private normalizeDirectory(raw: string): string {
    const trimmed = raw?.trim();
    if (!trimmed) return this.defaultDirectory;
    if (path.isAbsolute(trimmed)) return path.normalize(trimmed);
    return path.resolve(trimmed);
  }

  private async ensureDirectoryExists(rawDirectory: string): Promise<string> {
    const normalized = this.normalizeDirectory(rawDirectory);
    await fs.mkdir(normalized, { recursive: true });
    return normalized;
  }

  async listDirectories(rawPath?: string | null) {
    const target = this.normalizeDirectory(rawPath ?? '');

    try {
      const entries = await fs.readdir(target, { withFileTypes: true });
      const directories = entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => ({
          name: entry.name,
          path: path.resolve(target, entry.name),
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'es'));

      const parsed = path.parse(target);
      const isRoot = path.resolve(target) === path.resolve(parsed.root);

      return {
        path: target,
        parent: isRoot ? null : path.resolve(target, '..'),
        entries: directories,
      };
    } catch (error: any) {
      this.logger.error(`No se pudo explorar el directorio ${target}`, error?.stack ?? error?.message);
      throw new BadRequestException(
        error?.code === 'ENOENT'
          ? 'La carpeta seleccionada no existe.'
          : 'No se pudo explorar el directorio indicado.',
      );
    }
  }

  async createDirectory(rawPath: string) {
    const trimmed = rawPath?.trim();
    if (!trimmed) {
      throw new BadRequestException('Debes indicar la ruta completa de la carpeta a crear.');
    }

    const normalized = this.normalizeDirectory(trimmed);

    try {
      await fs.mkdir(normalized, { recursive: true });
      return {
        path: normalized,
        created: true,
      };
    } catch (error: any) {
      this.logger.error(`No se pudo crear la carpeta ${normalized}`, error?.stack ?? error?.message);
      throw new BadRequestException(
        error?.code === 'EACCES'
          ? 'No tenemos permisos para crear la carpeta en esa ubicación.'
          : 'No se pudo crear la carpeta solicitada.',
      );
    }
  }

  private async getConfiguredDirectoryValue(): Promise<string | null> {
    const setting = await this.systemSettingsRepo.findOne({ where: { key: 'backup.directory' } });
    if (!setting || !setting.value?.trim()) return null;
    return setting.value.trim();
  }

  private async collectCandidateDirectories(): Promise<string[]> {
    const candidates: string[] = [];
    const configured = await this.getConfiguredDirectoryValue();
    if (configured) candidates.push(this.normalizeDirectory(configured));

    const lastDirectory = await this.getSettingValue('backup.lastDirectory');
    if (lastDirectory) candidates.push(this.normalizeDirectory(lastDirectory));

    candidates.push(this.defaultDirectory);

    return Array.from(new Set(candidates));
  }

  private resolveDatabaseConnection(): DatabaseConnectionConfig {
    const databaseUrl = this.configService.get<string>('DATABASE_URL')?.trim();

    if (databaseUrl) {
      try {
        const parsed = new URL(databaseUrl);
        const database = parsed.pathname.replace(/^\//, '').trim();
        if (!database) {
          throw new BadRequestException(
            'La variable DATABASE_URL no indica el nombre de la base de datos para el respaldo.',
          );
        }

        const username = decodeURIComponent(parsed.username ?? '');
        if (!username) {
          throw new BadRequestException(
            'La variable DATABASE_URL no indica el usuario para la conexión a la base de datos.',
          );
        }

        return {
          host: parsed.hostname,
          port: parsed.port ? Number.parseInt(parsed.port, 10) : 3306,
          username,
          password: decodeURIComponent(parsed.password ?? ''),
          database,
          provider: 'railway',
        };
      } catch (error: any) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        throw new BadRequestException(
          'La variable DATABASE_URL no tiene el formato esperado para generar el respaldo de la base de datos.',
        );
      }
    }

    const host = this.configService.get<string>('DATABASE_HOST');
    const database = this.configService.get<string>('DATABASE_NAME');
    const username = this.configService.get<string>('DATABASE_USERNAME');
    const password = this.configService.get<string>('DATABASE_PASSWORD') ?? '';
    const portValue = this.configService.get<string>('DATABASE_PORT');
    const port = portValue ? Number.parseInt(portValue, 10) : 3306;

    if (!host || !database || !username) {
      throw new BadRequestException(
        'No se encontró la configuración de conexión a la base de datos. Verifica las variables de entorno.',
      );
    }

    const normalizedHost = host.trim();
    const normalizedDatabase = database.trim();
    const normalizedUsername = username.trim();

    if (!normalizedHost || !normalizedDatabase || !normalizedUsername) {
      throw new BadRequestException(
        'La configuración de la base de datos contiene valores vacíos. Verifica host, usuario y nombre.',
      );
    }

    return {
      host: normalizedHost,
      port: Number.isFinite(port) ? port : 3306,
      username: normalizedUsername,
      password,
      database: normalizedDatabase,
      provider: 'env',
    };
  }

  private async dumpDatabaseToFile(
    config: DatabaseConnectionConfig,
    outputPath: string,
  ): Promise<DatabaseDumpInfo> {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    const mysqldumpInfo = await this.resolveMysqldumpInfo();
    const mysqldumpCommand = mysqldumpInfo.command;

    if (!mysqldumpInfo.available) {
      throw new BadRequestException(
        `No se encontró el comando "${mysqldumpCommand}". ` +
          'Configura la ruta completa del ejecutable mysqldump en los ajustes del sistema.',
      );
    }
    const args = [
      `--host=${config.host}`,
      `--port=${config.port}`,
      `--user=${config.username}`,
      '--single-transaction',
      '--quick',
      '--routines',
      '--events',
      '--set-gtid-purged=OFF',
      config.database,
    ];

    const env = { ...process.env };
    if (config.password !== undefined) {
      env.MYSQL_PWD = config.password;
    }

    return new Promise<DatabaseDumpInfo>((resolve, reject) => {
      let settled = false;
      const safeReject = (error: Error) => {
        if (!settled) {
          settled = true;
          reject(error);
        }
      };
      const safeResolve = (value: DatabaseDumpInfo) => {
        if (!settled) {
          settled = true;
          resolve(value);
        }
      };

      const child = spawn(mysqldumpCommand, args, { env });

      if (!child.stdout) {
        safeReject(new Error('mysqldump no entregó datos por la salida estándar.'));
        return;
      }

      let stderr = '';
      child.stderr?.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      child.on('error', (error: NodeJS.ErrnoException) => {
        if (error?.code === 'ENOENT') {
          safeReject(
            new Error(
              `No se encontró el comando "${mysqldumpCommand}". Instala mysqldump o configura ` +
                'BACKUP_MYSQLDUMP_PATH/MYSQLDUMP_PATH con la ruta correcta.',
            ),
          );
          return;
        }

        safeReject(
          new Error(
            `No se pudo ejecutar mysqldump para generar el respaldo de la base de datos: ${error.message}`,
          ),
        );
      });

      const output = createWriteStream(outputPath);
      output.on('error', (error) => {
        safeReject(
          new Error(
            `No se pudo escribir el volcado de la base de datos en el disco: ${error.message}`,
          ),
        );
        child.kill('SIGTERM');
      });

      const finishPromise = new Promise<void>((resolveFinish, rejectFinish) => {
        output.on('finish', resolveFinish);
        output.on('error', rejectFinish);
      });

      child.stdout.pipe(output);

      child.on('close', async (code) => {
        try {
          await finishPromise;
        } catch (error: any) {
          safeReject(
            new Error(
              `No se pudo finalizar la escritura del volcado de la base de datos: ${error?.message ?? error}`,
            ),
          );
          return;
        }

        if (code !== 0) {
          const message = stderr.trim() || `mysqldump finalizó con código ${code}`;
          safeReject(new Error(message));
          return;
        }

        fs.stat(outputPath)
          .then((stats) =>
            safeResolve({
              fileName: path.basename(outputPath),
              size: stats.size,
              provider: config.provider,
              host: config.host,
              database: config.database,
            }),
          )
          .catch((error: any) =>
            safeReject(
              new Error(
                `No se pudo obtener información del volcado de la base de datos generado: ${
                  error?.message ?? error
                }`,
              ),
            ),
          );
      });
    });
  }

  private async createTarArchive(targetPath: string, sourceDir: string, files: string[]): Promise<void> {
    await fs.mkdir(path.dirname(targetPath), { recursive: true });

    await new Promise<void>((resolve, reject) => {
      const child = spawn('tar', ['-czf', targetPath, ...files], { cwd: sourceDir });
      let stderr = '';

      child.stderr?.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      child.on('error', (error) => {
        reject(
          new Error(`No se pudo ejecutar el comando tar para empaquetar el respaldo: ${error.message}`),
        );
      });

      child.on('close', (code) => {
        if (code !== 0) {
          const message = stderr.trim() || `tar finalizó con código ${code}`;
          reject(new Error(message));
        } else {
          resolve();
        }
      });
    });
  }

  private async safeRemoveDirectory(directory: string): Promise<void> {
    try {
      await fs.rm(directory, { recursive: true, force: true });
    } catch (error: any) {
      this.logger.warn(
        `No se pudo eliminar el directorio temporal del respaldo (${directory}): ${error?.message ?? error}`,
      );
    }
  }

  private isPermissionError(error: unknown): boolean {
    if (!error) return false;
    const code = (error as any)?.code;
    if (code && `${code}`.toUpperCase() === 'EACCES') {
      return true;
    }
    const message = ((error as any)?.message ?? '').toString().toLowerCase();
    return message.includes('permission denied') || message.includes('acceso denegado');
  }

  private async collectBackupPayload(): Promise<BackupPayload> {
    const [
      services,
      operatorServices,
      operators,
      operatorRoles,
      tickets,
      clients,
      customMessages,
      settings,
      roles,
      permissions,
      rolePermissions,
      reportSnapshots,
    ] = await Promise.all([
      this.servicesRepo.find(),
      this.operatorServicesRepo.find(),
      this.operatorsRepo.find(),
      this.operatorRolesRepo.find(),
      this.ticketsRepo.find(),
      this.clientsRepo.find(),
      this.customMessagesRepo.find(),
      this.systemSettingsRepo.find(),
      this.rolesRepo.find(),
      this.permissionsRepo.find(),
      this.rolePermissionsRepo.find(),
      this.reportSnapshotsRepo.find(),
    ]);

    return {
      services: services.map((item) => this.serializeService(item)),
      operatorServices: operatorServices.map((item) => this.serializeOperatorService(item)),
      operators: operators.map((item) => this.serializeOperator(item)),
      operatorRoles: operatorRoles.map((item) => this.serializeOperatorRole(item)),
      tickets: tickets.map((item) => this.serializeTicket(item)),
      clients: clients.map((item) => this.serializeClient(item)),
      customMessages: customMessages.map((item) => this.serializeCustomMessage(item)),
      settings: settings.map((item) => this.serializeSetting(item)),
      roles: roles.map((item) => this.serializeRole(item)),
      permissions: permissions.map((item) => this.serializePermission(item)),
      rolePermissions: rolePermissions.map((item) => this.serializeRolePermission(item)),
      reportSnapshots: reportSnapshots.map((item) => this.serializeReportSnapshot(item)),
    };
  }

  private serializeService(service: ServiceEntity) {
    return {
      id: service.id,
      name: service.name,
      prefix: service.prefix,
      nextTicketNumber: service.nextTicketNumber,
      active: Boolean(service.active),
      priority: service.priority,
      estimatedTime: service.estimatedTime,
      maxAttentionTime: service.maxAttentionTime ?? null,
      systemLocked: Boolean((service as any).systemLocked ?? false),
      createdAt: this.toIso(service.createdAt),
      updatedAt: this.toIso(service.updatedAt),
    };
  }

  private serializeOperator(operator: Operator) {
    return {
      id: operator.id,
      name: operator.name,
      username: operator.username,
      email: operator.email ?? null,
      position: operator.position ?? null,
      active: Boolean(operator.active),
      createdAt: this.toIso(operator.createdAt),
      updatedAt: this.toIso(operator.updatedAt),
    };
  }

  private serializeOperatorService(link: OperatorService) {
    return {
      operatorId: link.operatorId,
      serviceId: link.serviceId,
      active: Boolean(link.active),
      weight: link.weight,
      createdAt: this.toIso(link.createdAt),
      updatedAt: this.toIso(link.updatedAt),
    };
  }

  private serializeOperatorRole(link: OperatorRole) {
    return {
      id: link.id,
      operatorId: link.operatorId,
      roleId: link.roleId,
      createdAt: this.toIso(link.createdAt),
      updatedAt: this.toIso(link.updatedAt),
    };
  }

  private serializeTicket(ticket: Ticket) {
    return {
      id: ticket.id,
      number: ticket.number,
      serviceId: ticket.serviceId,
      operatorId: ticket.operatorId ?? null,
      clientId: ticket.clientId ?? null,
      status: ticket.status,
      createdAt: this.toIso(ticket.createdAt),
      calledAt: this.toIso(ticket.calledAt),
      startedAt: this.toIso(ticket.startedAt),
      completedAt: this.toIso(ticket.completedAt),
      attentionDuration: ticket.attentionDuration ?? null,
      absentAt: this.toIso(ticket.absentAt),
      requeuedAt: this.toIso(ticket.requeuedAt),
      priority: ticket.priority,
      estimatedWaitTime: ticket.estimatedWaitTime ?? null,
      actualWaitTime: ticket.actualWaitTime ?? null,
      mobilePhone: ticket.mobilePhone ?? null,
      notificationSent: Boolean(ticket.notificationSent),
      qrScannedAt: this.toIso(ticket.qrScannedAt),
    };
  }

  private serializeClient(client: Client) {
    return {
      id: client.id,
      dni: client.dni,
      name: client.name,
      email: client.email ?? null,
      phone: client.phone ?? null,
      vip: Boolean(client.vip),
      createdAt: this.toIso(client.createdAt),
      updatedAt: this.toIso(client.updatedAt),
    };
  }

  private serializeCustomMessage(message: CustomMessage) {
    return {
      id: message.id,
      title: message.title,
      content: message.content,
      type: message.type,
      active: Boolean(message.active),
      priority: message.priority,
      startDate: this.toIso(message.startDate),
      endDate: this.toIso(message.endDate),
      mediaUrl: message.mediaUrl ?? null,
      mediaType: message.mediaType ?? null,
      createdAt: this.toIso(message.createdAt),
      updatedAt: this.toIso(message.updatedAt),
    };
  }

  private serializeSetting(setting: SystemSetting) {
    return {
      id: setting.id,
      key: setting.key,
      value: setting.value,
      description: setting.description ?? null,
      updatedAt: this.toIso(setting.updatedAt),
    };
  }

  private serializeRole(role: Role) {
    return {
      id: role.id,
      slug: role.slug,
      name: role.name,
      description: role.description ?? null,
      createdAt: this.toIso(role.createdAt),
      updatedAt: this.toIso(role.updatedAt),
    };
  }

  private serializePermission(permission: Permission) {
    return {
      id: permission.id,
      slug: permission.slug,
      name: permission.name,
      description: permission.description ?? null,
      createdAt: this.toIso(permission.createdAt),
      updatedAt: this.toIso(permission.updatedAt),
    };
  }

  private serializeRolePermission(link: RolePermission) {
    return {
      id: link.id,
      roleId: link.roleId,
      permissionId: link.permissionId,
      createdAt: this.toIso(link.createdAt),
      updatedAt: this.toIso(link.updatedAt),
    };
  }

  private serializeReportSnapshot(snapshot: ReportSnapshot) {
    return {
      id: snapshot.id,
      type: snapshot.type,
      from: this.toIso(snapshot.from),
      to: this.toIso(snapshot.to),
      serviceId: snapshot.serviceId ?? null,
      operatorId: snapshot.operatorId ?? null,
      granularity: snapshot.granularity ?? null,
      createdByUserId: snapshot.createdByUserId ?? null,
      ticketNumberFrom: snapshot.ticketNumberFrom ?? null,
      ticketNumberTo: snapshot.ticketNumberTo ?? null,
      data: snapshot.data ?? {},
      createdAt: this.toIso(snapshot.createdAt),
      calcVersion: snapshot.calcVersion ?? null,
    };
  }

  private toIso(value: Date | string | null | undefined): string | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  }

  private async recordSuccess(result: BackupResult): Promise<void> {
    const iso = result.generatedAt.toISOString();
    const tasks = [
      this.systemSettingsService.set(
        'backup.lastGeneratedAt',
        iso,
        'Fecha del último respaldo generado',
      ),
      this.systemSettingsService.set(
        'backup.lastGeneratedFile',
        result.fileName,
        'Nombre del archivo del último respaldo',
      ),
      this.systemSettingsService.set(
        'backup.lastDirectory',
        result.directory,
        'Directorio donde se almacenó el último respaldo',
      ),
      this.systemSettingsService.set(
        'backup.lastSize',
        String(result.size),
        'Tamaño del último respaldo en bytes',
      ),
      this.systemSettingsService.set(
        'backup.lastError',
        '',
        'Último error de respaldo',
      ),
      this.systemSettingsService.set(
        'backup.lastFailureAt',
        '',
        'Fecha del último error al generar un respaldo',
      ),
    ];

    if (result.mode === 'automatic') {
      tasks.push(
        this.systemSettingsService.set(
          'backup.lastAutomaticAt',
          iso,
          'Fecha del último respaldo automático',
        ),
      );
    } else {
      tasks.push(
        this.systemSettingsService.set(
          'backup.lastManualAt',
          iso,
          'Fecha del último respaldo manual',
        ),
      );
    }

    await Promise.all(tasks);
  }

  private async isAutomaticEnabled(): Promise<boolean> {
    const value = await this.getSettingValue('backup.enabled');
    return this.normalizeBoolean(value, true);
  }

  private normalizeBoolean(value: string | null | undefined, fallback: boolean): boolean {
    if (value === undefined || value === null || value.trim() === '') return fallback;
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on', 'si', 'sí'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
    return fallback;
  }

  private async getConfiguredTime(): Promise<{ hour: number; minute: number; formatted: string }> {
    const value = await this.getSettingValue('backup.time');
    return this.normalizeTime(value ?? '02:00');
  }

  private normalizeTime(value: string): { hour: number; minute: number; formatted: string } {
    const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec((value ?? '').trim());
    if (!match) {
      return { hour: 2, minute: 0, formatted: '02:00' };
    }
    const hour = Number.parseInt(match[1], 10);
    const minute = Number.parseInt(match[2], 10);
    const formatted = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    return { hour, minute, formatted };
  }

  private async getSettingValue(key: string): Promise<string | null> {
    const setting = await this.systemSettingsRepo.findOne({ where: { key } });
    return setting?.value ?? null;
  }

  private async resolveMysqldumpInfo(): Promise<MysqldumpInfo> {
    const configured = this.sanitizeExecutablePath(await this.getSettingValue('backup.mysqldumpPath'));
    const envConfigured = this.sanitizeExecutablePath(
      this.configService.get<string>('BACKUP_MYSQLDUMP_PATH') ??
        this.configService.get<string>('MYSQLDUMP_PATH') ??
        null,
    );

    const command = configured ?? envConfigured ?? 'mysqldump';
    const source: MysqldumpInfo['source'] = configured ? 'setting' : envConfigured ? 'env' : 'default';
    const available = await this.commandExists(command);

    return {
      configuredPath: configured,
      envPath: envConfigured,
      command,
      source,
      available,
    };
  }

  private sanitizeExecutablePath(raw: string | null | undefined): string | null {
    const trimmed = raw?.trim();
    if (!trimmed) {
      return null;
    }

    const unquoted = trimmed.replace(/^['"]+|['"]+$/g, '');
    return unquoted.trim() || null;
  }

  private async commandExists(command: string): Promise<boolean> {
    const normalized = command?.trim();
    if (!normalized) {
      return false;
    }

    if (path.isAbsolute(normalized)) {
      try {
        const stats = await fs.stat(normalized);
        return stats.isFile() || stats.isSymbolicLink();
      } catch {
        return false;
      }
    }

    if (normalized.includes('/') || normalized.includes('\\')) {
      try {
        const stats = await fs.stat(path.resolve(normalized));
        return stats.isFile() || stats.isSymbolicLink();
      } catch {
        return false;
      }
    }

    const hasExtension = Boolean(path.extname(normalized));
    const candidates: string[] = [normalized];

    if (process.platform === 'win32' && !hasExtension) {
      const rawExts = process.env.PATHEXT?.split(';').filter(Boolean) ?? ['.EXE', '.CMD', '.BAT', '.COM'];
      for (const ext of rawExts) {
        const cleanExt = ext.startsWith('.') ? ext : `.${ext}`;
        candidates.push(`${normalized}${cleanExt}`);
      }
    }

    const pathEntries = process.env.PATH?.split(path.delimiter).filter(Boolean) ?? [];
    for (const entry of pathEntries) {
      for (const candidate of candidates) {
        const resolved = path.join(entry, candidate);
        try {
          const stats = await fs.stat(resolved);
          if (stats.isFile() || stats.isSymbolicLink()) {
            return true;
          }
        } catch {
          continue;
        }
      }
    }

    return false;
  }

  private async pathExists(directory: string): Promise<boolean> {
    try {
      await fs.access(directory);
      return true;
    } catch {
      return false;
    }
  }

  private formatTimestamp(date: Date): string {
    const pad = (value: number) => value.toString().padStart(2, '0');
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(
      date.getMinutes(),
    )}${pad(date.getSeconds())}`;
  }

  private truncate(value: string, max = 2000): string {
    if (!value) return '';
    return value.length <= max ? value : `${value.slice(0, max)}…`;
  }
}
