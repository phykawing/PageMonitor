import {Model} from '@nozbe/watermelondb';
import {
  field,
  children,
  readonly,
  date,
  text,
  nochange,
} from '@nozbe/watermelondb/decorators';

export class MonitoredPage extends Model {
  static table = 'monitored_pages';
  static associations = {
    snapshots: {type: 'has_many' as const, foreignKey: 'page_id'},
    change_records: {type: 'has_many' as const, foreignKey: 'page_id'},
  };

  @text('url') url!: string;
  @text('title') title!: string;
  @field('is_active') isActive!: boolean;
  @field('check_interval_ms') checkIntervalMs!: number;
  @field('last_checked_at') lastCheckedAt!: number | null;
  @text('last_status') lastStatus!: 'ok' | 'changed' | 'error' | 'pending';
  @text('last_error') lastError!: string | null;
  @field('max_change_records') maxChangeRecords!: number | null;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  @children('snapshots') snapshots: any;
  @children('change_records') changeRecords: any;
}
