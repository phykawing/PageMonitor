import {appSchema, tableSchema} from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 2,
  tables: [
    tableSchema({
      name: 'monitored_pages',
      columns: [
        {name: 'url', type: 'string'},
        {name: 'title', type: 'string'},
        {name: 'is_active', type: 'boolean'},
        {name: 'check_interval_ms', type: 'number'},
        {name: 'last_checked_at', type: 'number', isOptional: true},
        {name: 'last_status', type: 'string'},
        {name: 'last_error', type: 'string', isOptional: true},
        {name: 'max_change_records', type: 'number', isOptional: true},
        {name: 'created_at', type: 'number'},
        {name: 'updated_at', type: 'number'},
      ],
    }),
    tableSchema({
      name: 'snapshots',
      columns: [
        {name: 'page_id', type: 'string', isIndexed: true},
        {name: 'text_content', type: 'string'},
        {name: 'links_json', type: 'string'},
        {name: 'raw_html_hash', type: 'string'},
        {name: 'fetched_at', type: 'number'},
        {name: 'content_length', type: 'number'},
      ],
    }),
    tableSchema({
      name: 'change_records',
      columns: [
        {name: 'page_id', type: 'string', isIndexed: true},
        {name: 'old_snapshot_id', type: 'string'},
        {name: 'new_snapshot_id', type: 'string'},
        {name: 'text_diff_json', type: 'string'},
        {name: 'links_added_json', type: 'string'},
        {name: 'links_removed_json', type: 'string'},
        {name: 'change_summary', type: 'string'},
        {name: 'detected_at', type: 'number'},
        {name: 'was_notified', type: 'boolean'},
      ],
    }),
  ],
});
