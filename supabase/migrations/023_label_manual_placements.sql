-- Hand-arranged label artwork.
--
-- A template either lays itself out or is arranged by hand. Empty means the engine
-- decides, which is how every existing template keeps behaving after this runs.
-- When it is not empty it holds one box per field, in millimetres from the top-left
-- of the canvas:
--
--   {"barcode":{"x":2.5,"y":2.5,"w":19.2,"h":30.1},
--    "qr":{"x":100,"y":5,"w":20,"h":20},
--    "logo":{"x":88,"y":36,"w":40,"h":10},
--    "text":{"x":35,"y":5,"w":67,"h":40},
--    "site":{"x":4,"y":20,"w":5.2,"h":26.4}}
--
-- The boxes are what the eye sees, so the barcode and the QR include their quiet
-- zones. Sizes are clamped to what stays printable when the label is drawn — the
-- engine will not honour a UPC-A below 80% magnification whatever is stored here —
-- and the application refuses to save a box that falls outside the trim.

alter table label_templates
  add column if not exists placements jsonb not null default '{}'::jsonb;

alter table label_templates
  drop constraint if exists label_templates_placements_object;

alter table label_templates
  add constraint label_templates_placements_object
  check (jsonb_typeof(placements) = 'object');

comment on column label_templates.placements is
  'Per-field artwork boxes in mm, empty when the layout is left to the engine.';
