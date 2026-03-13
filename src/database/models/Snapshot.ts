import {Model} from '@nozbe/watermelondb';
import {field, text, relation} from '@nozbe/watermelondb/decorators';
import {MonitoredPage} from './MonitoredPage';

export class Snapshot extends Model {
  static table = 'snapshots';
  static associations = {
    monitored_pages: {type: 'belongs_to' as const, key: 'page_id'},
  };

  @text('page_id') pageId!: string;
  @text('text_content') textContent!: string;
  @text('links_json') linksJson!: string;
  @text('raw_html_hash') rawHtmlHash!: string;
  @field('fetched_at') fetchedAt!: number;
  @field('content_length') contentLength!: number;

  @relation('monitored_pages', 'page_id') page!: MonitoredPage;
}
