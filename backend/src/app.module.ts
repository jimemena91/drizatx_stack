import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DatabaseConfig } from "./config/database.config";
import { ServicesModule } from "./modules/services/services.module";
import { OperatorsModule } from "./modules/operators/operators.module";
import { TicketsModule } from "./modules/tickets/tickets.module";
import { ClientsModule } from "./modules/clients/clients.module";
import { QueueModule } from "./modules/queue/queue.module";
import { SystemSettingsModule } from "./modules/system-settings/system-settings.module";
import { HealthModule } from "./health/health.module";
import { AuthModule } from "./modules/auth/auth.module";
import { CustomMessagesModule } from "./modules/custom-messages/custom-messages.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { AclModule } from "./modules/acl/acl.module";
import { BackupsModule } from "./modules/backups/backups.module";
import { AuditLogsModule } from "./modules/audit/audit-logs.module";
import { DisplayModule } from "./modules/display/display.module";
import { TerminalModule } from "./modules/terminal/terminal.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),

    TypeOrmModule.forRootAsync({
      useClass: DatabaseConfig,
    }),

    ServicesModule,
    OperatorsModule,
    TicketsModule,
    ClientsModule,
    QueueModule,
    SystemSettingsModule,
    HealthModule,
    AuthModule,
    CustomMessagesModule,
    ReportsModule,
    AclModule,
    BackupsModule,
    AuditLogsModule,
    DisplayModule,
    TerminalModule,
  ],
  providers: [DatabaseConfig],
})
export class AppModule {}
