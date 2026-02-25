ALTER TABLE marketplace_events
ADD COLUMN max_items_per_scan integer NOT NULL DEFAULT 1;