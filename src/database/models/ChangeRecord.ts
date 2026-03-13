import {Model} from '@nozbe/watermelondb';
import {field, text, relation} from '@nozbe/watermelondb/decorators';
import {MonitoredPage} from './MonitoredPage';

export class ChangeRecord extends Model {
  static table = 'change_records';
  static associations = {
    monitored_pages: {type: 'belongs_to' as const, key: 'page_id'},
  };

  @text('page_id') pageId!: string;
  @text('old_snapshot_id') oldSnapshotId!: string;
  @text('new_snapshot_id') newSnapshotId!: string;
  @text('text_diff_json') textDiffJson!: string;
  @text('links_added_json') linksAddedJson!: string;
  @text('links_removed_json') linksRemovedJson!: string;
  @text('change_summary') changeSummary!: string;
  @field('detected_at') detectedAt!: number;
  @field('was_notified') wasNotified!: boolean;

  @relation('monitored_pages', 'page_id') page!: MonitoredPage;
}
