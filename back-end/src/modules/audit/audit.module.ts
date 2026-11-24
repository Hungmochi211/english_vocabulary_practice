import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { AuditService } from './audit.service';
import { OperationalMonitorService } from './operational-monitor.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  providers: [AuditService, OperationalMonitorService],
  exports: [AuditService, OperationalMonitorService],
})
export class AuditModule {}
