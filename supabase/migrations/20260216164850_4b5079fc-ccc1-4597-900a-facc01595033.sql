
-- Since marketplace_item_allocations already has a unique constraint on (marketplace_id, item_type_id),
-- we just need to delete allocations pointing to duplicate item_types, then delete the duplicate item_types.

-- Step 1: Identify which item_types to keep (oldest per external_material_id)
-- and delete allocations pointing to duplicates
WITH kept AS (
  SELECT DISTINCT ON (external_material_id) id AS keep_id, external_material_id
  FROM item_types
  WHERE external_material_id IS NOT NULL
  ORDER BY external_material_id, created_at ASC
),
dupes AS (
  SELECT it.id AS dupe_id
  FROM item_types it
  JOIN kept k ON it.external_material_id = k.external_material_id AND it.id != k.keep_id
)
DELETE FROM marketplace_item_allocations WHERE item_type_id IN (SELECT dupe_id FROM dupes);

-- Step 2: Delete orphaned manual counts
WITH kept AS (
  SELECT DISTINCT ON (external_material_id) id AS keep_id, external_material_id
  FROM item_types
  WHERE external_material_id IS NOT NULL
  ORDER BY external_material_id, created_at ASC
),
dupes AS (
  SELECT it.id AS dupe_id
  FROM item_types it
  JOIN kept k ON it.external_material_id = k.external_material_id AND it.id != k.keep_id
)
DELETE FROM marketplace_manual_counts WHERE item_type_id IN (SELECT dupe_id FROM dupes);

-- Step 3: Delete orphaned traceability logs
WITH kept AS (
  SELECT DISTINCT ON (external_material_id) id AS keep_id, external_material_id
  FROM item_types
  WHERE external_material_id IS NOT NULL
  ORDER BY external_material_id, created_at ASC
),
dupes AS (
  SELECT it.id AS dupe_id
  FROM item_types it
  JOIN kept k ON it.external_material_id = k.external_material_id AND it.id != k.keep_id
)
DELETE FROM allocation_traceability_logs WHERE item_type_id IN (SELECT dupe_id FROM dupes);

-- Step 4: Delete orphaned warehouse_returns
WITH kept AS (
  SELECT DISTINCT ON (external_material_id) id AS keep_id, external_material_id
  FROM item_types
  WHERE external_material_id IS NOT NULL
  ORDER BY external_material_id, created_at ASC
),
dupes AS (
  SELECT it.id AS dupe_id
  FROM item_types it
  JOIN kept k ON it.external_material_id = k.external_material_id AND it.id != k.keep_id
)
DELETE FROM warehouse_returns WHERE item_type_id IN (SELECT dupe_id FROM dupes);

-- Step 5: Delete duplicate item_types
WITH kept AS (
  SELECT DISTINCT ON (external_material_id) id AS keep_id, external_material_id
  FROM item_types
  WHERE external_material_id IS NOT NULL
  ORDER BY external_material_id, created_at ASC
)
DELETE FROM item_types
WHERE external_material_id IS NOT NULL
  AND id NOT IN (SELECT keep_id FROM kept);

-- Step 6: Add unique partial index on item_types.external_material_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_item_types_external_material_id_unique
ON item_types (external_material_id)
WHERE external_material_id IS NOT NULL;
