import {schemaMigrations, addColumns} from '@nozbe/watermelondb/Schema/migrations';

export const migrations = schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        addColumns({
          table: 'monitored_pages',
          columns: [
            {name: 'max_change_records', type: 'number', isOptional: true},
          ],
        }),
      ],
    },
  ],
});
