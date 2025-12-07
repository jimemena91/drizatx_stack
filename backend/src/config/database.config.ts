// backend/src/config/database.config.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSourceOptions } from 'typeorm';
import { TypeOrmOptionsFactory } from '@nestjs/typeorm';
import { join } from 'path';

// Entidades
import { Ticket } from '../entities/ticket.entity';
import { Operator } from '../entities/operator.entity';
import { Service } from '../entities/service.entity';
import { Client } from '../entities/client.entity';
import { OperatorService } from '../entities/operator-service.entity';
import { SystemSetting } from '../entities/system-setting.entity';
import { ReportSnapshot } from '../entities/report-snapshot.entity';
import { CustomMessage } from '../entities/custom-message.entity';
import { Role } from '../entities/role.entity';
import { Permission } from '../entities/permission.entity';
import { OperatorRole } from '../entities/operator-role.entity';
import { OperatorShift } from '../entities/operator-shift.entity';
import { OperatorAvailability } from '../entities/operator-availability.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { AuditLog } from '../entities/audit-log.entity';

@Injectable()
export class DatabaseConfig implements TypeOrmOptionsFactory {
  constructor(private readonly config: ConfigService) {}

  createTypeOrmOptions(): DataSourceOptions {
    const databaseUrl = this.config.get<string>('DATABASE_URL');

    // Base común para todos los entornos
    const base: DataSourceOptions = {
      type: 'mysql',
      // Importar entidades explícitas ayuda al tree-shaking y a la DX
      entities: [
        Ticket,
        Operator,
        OperatorRole,
        Role,
        RolePermission,
        Permission,
        Service,
        Client,
        OperatorService,
        OperatorShift,
        OperatorAvailability,
        SystemSetting,
        ReportSnapshot,
        CustomMessage,
        AuditLog,
      ],
      // Nunca autogenerar schema en staging/prod
      synchronize: false,
      // Habilitá logs con TYPEORM_LOGGING=true cuando necesites investigar
      logging: this.config.get<string>('TYPEORM_LOGGING', 'false') === 'true',
      timezone: 'Z',

      // Rutas de migraciones en runtime (app compilada a JS dentro de dist/)
      // __dirname = backend/dist/config en runtime, por eso subimos un nivel
      migrations: [join(__dirname, '..', 'migrations', '*{.js,.ts}')],
      // Ejecutar migraciones al arrancar SOLO si lo pedimos por env var
      migrationsRun:
        this.config.get<string>('TYPEORM_MIGRATIONS_RUN', 'false') === 'true',
    };

    // Preferimos una única variable con URI completa: DATABASE_URL
    if (databaseUrl) {
      return {
        ...base,
        url: databaseUrl, // mysql://user:pass@host:port/db
        // Si en algún proveedor necesitas SSL, podés habilitarlo así:
        // extra: { ssl: { rejectUnauthorized: false } },
      };
    }

    // Fallback para desarrollo local con variables separadas
    return {
      ...base,
      host: this.config.get<string>('DATABASE_HOST', 'localhost'),
      port: parseInt(this.config.get<string>('DATABASE_PORT', '3306'), 10),
      username: this.config.get<string>('DATABASE_USERNAME', 'root'),
      password: this.config.get<string>('DATABASE_PASSWORD', ''),
      database: this.config.get<string>('DATABASE_NAME', 'drizatx'),
    };
  }
}
