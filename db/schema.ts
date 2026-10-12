import {sqliteTable,text,integer,primaryKey} from 'drizzle-orm/sqlite-core';
export const recipes = sqliteTable('recipes', {
  owner: text('owner').notNull(),
  id: text('id').notNull(),
  revision: text('revision').notNull(),
  deleted: integer('deleted').notNull().default(0),
  payload: text('payload'),
  updatedAt: integer('updated_at').notNull(),
}, table => [primaryKey({columns:[table.owner,table.id]})]);
