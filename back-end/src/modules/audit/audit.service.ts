import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'password_hash',
  'currentpassword',
  'newpassword',
  'refreshtoken',
  'refresh_token',
  'accesstoken',
  'access_token',
  'idtoken',
  'id_token',
  'token',
  'tokenhash',
  'token_hash',
  'replacedbyhash',
  'replaced_by_hash',
  'secret',
  'apikey',
]);

export function sanitizeAuditMetadata(
  input?: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!input) return null;
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (SENSITIVE_KEYS.has(k.toLowerCase())) {
      continue;
    }
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      clean[k] = sanitizeAuditMetadata(v as Record<string, unknown>);
    } else {
      clean[k] = v;
    }
  }
  return clean;
}

export interface AuditLogInput {
  actorUserId?: number | null;
  action: string;
  targetType?: string | null;
  targetId?: string | number | null;
  status: 'SUCCESS' | 'FAILED';
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

@Injectable()
export class AuditService {
  constructor(private readonly dataSource: DataSource) {}

  async log(entry: AuditLogInput): Promise<void> {
    const safeMetadata = sanitizeAuditMetadata(entry.metadata);
    try {
      await this.dataSource.query(
        `
        INSERT INTO audit_logs (actor_user_id, action, target_type, target_id, status, metadata, ip_address)
        VALUES ($1, $2, $3, $4, $5, $6, $7);
        `,
        [
          entry.actorUserId ?? null,
          entry.action,
          entry.targetType ?? null,
          entry.targetId !== undefined && entry.targetId !== null
            ? String(entry.targetId)
            : null,
          entry.status,
          safeMetadata ? JSON.stringify(safeMetadata) : null,
          entry.ipAddress ?? null,
        ],
      );
    } catch {
      // Không làm sập luồng chính nếu chỉ ghi audit log gặp lỗi phụ
    }
  }
}
