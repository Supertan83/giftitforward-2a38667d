UPDATE marketplace_item_allocations SET allocated_quantity = 227, updated_at = now()
WHERE item_type_id = (SELECT id FROM item_types WHERE external_material_id = 987)
  AND marketplace_id = '6ed111b0-f003-46e8-a719-d76cc1800431';

UPDATE marketplace_item_allocations SET allocated_quantity = 223, updated_at = now()
WHERE item_type_id = (SELECT id FROM item_types WHERE external_material_id = 658)
  AND marketplace_id = '6ed111b0-f003-46e8-a719-d76cc1800431';

UPDATE marketplace_item_allocations SET allocated_quantity = 2056, updated_at = now()
WHERE item_type_id = (SELECT id FROM item_types WHERE external_material_id = 621)
  AND marketplace_id = '6ed111b0-f003-46e8-a719-d76cc1800431';