# Wardrobe Logical Data Model

Date: 2026-06-30

This is an app-level logical schema. It deliberately omits network hostnames,
credentials, physical database targets, storage names, provider policies, and
credential locations.

If a future optional sync service is added, a reasonable relational shape is a
PostgreSQL schema named `wardrobe`.

## Design Principles

- User-confirmed data is more authoritative than inferred data.
- Every AI or web-enriched field should carry evidence and confidence.
- Wear history should preserve the weather as it was known that day.
- Photos, thumbnails, and deterministic outfit composites are media assets, not
  inline table blobs.
- Deletes should tombstone first so sync can converge across devices.
- Public release should support multiple users even if the first deployment is
  private.

## Core Tables

### users

App user boundary for future public release.

Important fields:

```text
id uuid primary key
email text unique nullable
display_name text nullable
timezone text
preferred_units text
created_at timestamptz
updated_at timestamptz
deleted_at timestamptz nullable
```

### devices

Each PWA install or browser profile gets a device id for local-first sync.

```text
id uuid primary key
user_id uuid not null
device_label text
last_seen_at timestamptz
last_pushed_op_id uuid nullable
created_at timestamptz
```

### items

One physical clothing article owned by a user.

```text
id uuid primary key
user_id uuid not null
category text not null
subcategory text nullable
item_type text nullable
nickname text nullable
brand text nullable
product_line text nullable
model_name text nullable
sku text nullable
gtin text nullable
retailer text nullable
source_url text nullable
status text not null
acquisition_type text nullable
purchase_date date nullable
purchase_price_cents integer nullable
purchase_currency char(3) nullable
estimated_current_value_cents integer nullable
estimated_age_months integer nullable
condition_rating integer nullable
storage_location text nullable
notes text nullable
times_worn integer not null default 0
last_worn_at timestamptz nullable
last_cleaned_at timestamptz nullable
dirty boolean not null default false
needs_repair boolean not null default false
created_at timestamptz
updated_at timestamptz
deleted_at timestamptz nullable
```

Suggested enum values:

```text
category: top, bottom, dress, suit, outerwear, underwear, socks, shoes,
          accessory, athletic, sleepwear, swimwear, formalwear, other
status: active, archived, donated, sold, lost, discarded
acquisition_type: purchased_new, purchased_used, gift, rental, inherited, other
```

### item_measurements

Measurements vary by category, so store both common fields and extensible JSON.

```text
id uuid primary key
item_id uuid not null
size_label text nullable
size_system text nullable
gender_label text nullable
fit text nullable
chest_cm numeric nullable
waist_cm numeric nullable
hip_cm numeric nullable
inseam_cm numeric nullable
outseam_cm numeric nullable
shoulder_cm numeric nullable
sleeve_cm numeric nullable
neck_cm numeric nullable
shoe_size_label text nullable
heel_height_cm numeric nullable
raw_measurements jsonb not null default '{}'
confirmed_by_user boolean not null default false
created_at timestamptz
updated_at timestamptz
```

### item_materials

Material composition by percentage and evidence.

```text
id uuid primary key
item_id uuid not null
material text not null
percentage numeric nullable
component text nullable
source text not null
confidence numeric nullable
confirmed_by_user boolean not null default false
created_at timestamptz
```

Examples:

```text
material: cotton, polyester, wool, merino wool, cashmere, leather, nylon,
          elastane, linen, rayon, silk, down, primaloft
component: shell, lining, fill, trim, sole, upper
source: user, label_ocr, barcode_lookup, product_page, ai_vision
```

### item_colors

Both human labels and machine-friendly color values.

```text
id uuid primary key
item_id uuid not null
role text not null
color_name text not null
hex text nullable
lab_l numeric nullable
lab_a numeric nullable
lab_b numeric nullable
coverage_pct numeric nullable
pattern text nullable
source text not null
confidence numeric nullable
confirmed_by_user boolean not null default false
created_at timestamptz
```

Role examples:

```text
primary, secondary, accent, hardware, sole, lining
```

Pattern examples:

```text
solid, stripe, plaid, check, herringbone, floral, graphic, logo, camo, denim,
melange, colorblock
```

### item_weather_profiles

How an item behaves in weather and activity contexts.

```text
id uuid primary key
item_id uuid not null
temp_min_c numeric nullable
temp_max_c numeric nullable
feels_like_min_c numeric nullable
feels_like_max_c numeric nullable
warmth_rating integer nullable
breathability_rating integer nullable
rain_rating integer nullable
wind_rating integer nullable
uv_rating integer nullable
waterproof_rating_mm integer nullable
breathability_g_m2_24h integer nullable
fabric_weight_gsm integer nullable
stretch_pct numeric nullable
layer_role text nullable
season_tags text[] not null default '{}'
activity_tags text[] not null default '{}'
confirmed_by_user boolean not null default false
created_at timestamptz
updated_at timestamptz
```

### item_care

Care, cleaning, and repair state.

```text
id uuid primary key
item_id uuid not null
wash_instructions text nullable
dry_instructions text nullable
iron_instructions text nullable
dry_clean boolean nullable
bleach_allowed boolean nullable
care_symbols text[] not null default '{}'
wash_count integer not null default 0
repair_count integer not null default 0
last_repair_at timestamptz nullable
notes text nullable
source text nullable
confirmed_by_user boolean not null default false
created_at timestamptz
updated_at timestamptz
```

### media_assets

Media metadata. Store bytes locally first in browser-owned storage. Future
backup targets should be optional and provider-neutral.

```text
id uuid primary key
user_id uuid not null
item_id uuid nullable
outfit_id uuid nullable
media_type text not null
local_storage_provider text not null
local_storage_key text nullable
cloud_storage_provider text nullable
cloud_storage_key text nullable
storage_state text not null
content_hash text not null
mime_type text not null
width integer nullable
height integer nullable
byte_size integer nullable
derived_from_media_id uuid nullable
generated_by text nullable
exif_stripped boolean not null default true
created_at timestamptz
cloud_uploaded_at timestamptz nullable
deleted_at timestamptz nullable
```

Media type examples:

```text
item_front, item_back, item_detail, brand_label, care_label, receipt,
item_thumbnail, outfit_composite, thumbnail
```

Storage state examples:

```text
local_only, upload_pending, cloud_synced, cloud_deleted, restore_pending,
restore_failed
```

Generated-by examples:

```text
user_capture, local_thumbnailer, outfit_composer, ai_background_removal
```

### outfits

Reusable outfit definition.

```text
id uuid primary key
user_id uuid not null
name text nullable
description text nullable
occasion_tags text[] not null default '{}'
category_tags text[] not null default '{}'
season_tags text[] not null default '{}'
formality integer nullable
favorite boolean not null default false
created_by text not null
created_at timestamptz
updated_at timestamptz
deleted_at timestamptz nullable
```

Category tag examples:

```text
daily, professional, formal, athletic, travel, weather_protective
```

### outfit_items

Assigns items to outfit slots.

```text
id uuid primary key
outfit_id uuid not null
item_id uuid not null
slot text not null
sort_order integer not null default 0
required boolean not null default true
created_at timestamptz
```

Slot examples:

```text
base_top, mid_layer, outerwear, bottom, dress, shoes, socks, belt, bag,
watch, hat, scarf, jewelry, umbrella
```

### outfit_previews

Deterministic rendered previews assembled from existing item photos.

```text
id uuid primary key
user_id uuid not null
outfit_id uuid not null
media_asset_id uuid nullable
layout_name text not null
layout_version integer not null
canvas_width integer not null
canvas_height integer not null
background_style text nullable
render_state jsonb not null default '{}'
created_at timestamptz
deleted_at timestamptz nullable
```

`render_state` stores slot boxes, item media ids, scale, crop/pad decisions, and
z-index so the preview can be regenerated deterministically.

### weather_snapshots

Immutable weather context used for a recommendation or actual wear.

```text
id uuid primary key
user_id uuid not null
provider text not null
provider_location_id text nullable
location_label text nullable
location_precision text not null
forecast_for timestamptz not null
observed_at timestamptz nullable
temperature_c numeric nullable
feels_like_c numeric nullable
humidity_pct numeric nullable
precipitation_probability_pct numeric nullable
precipitation_mm numeric nullable
wind_speed_kph numeric nullable
wind_gust_kph numeric nullable
uv_index numeric nullable
cloud_cover_pct numeric nullable
weather_code text nullable
daylight boolean nullable
raw_summary jsonb not null default '{}'
created_at timestamptz
```

### wear_logs

Tracks when items or outfits were worn.

```text
id uuid primary key
user_id uuid not null
outfit_id uuid nullable
worn_at timestamptz not null
weather_snapshot_id uuid nullable
occasion text nullable
activity_tags text[] not null default '{}'
comfort_rating integer nullable
fit_rating integer nullable
style_rating integer nullable
notes text nullable
created_at timestamptz
updated_at timestamptz
deleted_at timestamptz nullable
```

### wear_log_items

The actual items worn, preserving the outfit even if the reusable outfit changes.

```text
id uuid primary key
wear_log_id uuid not null
item_id uuid not null
slot text nullable
was_planned boolean not null default true
created_at timestamptz
```

### item_relationships

Compatibility graph.

```text
id uuid primary key
user_id uuid not null
source_item_id uuid not null
target_item_id uuid not null
relationship_type text not null
weight numeric not null default 1
source text not null
evidence_count integer not null default 0
notes text nullable
created_at timestamptz
updated_at timestamptz
deleted_at timestamptz nullable
```

Relationship examples:

```text
goes_with, avoid_with, substitutes_for, layers_over, requires, same_set_as
```

### ai_jobs

Asynchronous AI work.

```text
id uuid primary key
user_id uuid not null
job_type text not null
status text not null
model_provider text nullable
model_name text nullable
input_refs jsonb not null default '{}'
output_refs jsonb not null default '{}'
error_message text nullable
created_at timestamptz
started_at timestamptz nullable
finished_at timestamptz nullable
```

Job types:

```text
classify_garment, extract_label, enrich_product, remove_background,
normalize_item_image, generate_embedding
```

### ai_drafts

Field-level draft metadata proposed by AI or enrichment.

```text
id uuid primary key
user_id uuid not null
job_id uuid nullable
entity_type text not null
entity_id uuid not null
field_path text not null
proposed_value jsonb not null
confidence numeric nullable
source_type text not null
source_ref text nullable
accepted_at timestamptz nullable
rejected_at timestamptz nullable
created_at timestamptz
```

### sync_operations

Server-side accepted operation history.

```text
id uuid primary key
user_id uuid not null
device_id uuid not null
entity_type text not null
entity_id uuid not null
operation text not null
patch jsonb not null
client_created_at timestamptz not null
server_version bigint not null
accepted_at timestamptz not null
```

## Derived Metrics

Derived metrics should be materialized only when needed for performance.

Examples:

- `cost_per_wear = purchase_price / max(times_worn, 1)`
- `days_since_last_worn`
- `weather_success_score` by item and temperature/rain bands
- `compatibility_score` between items
- `laundry_pressure_score`
- `underused_score`
- `outfit_diversity_score`

## Indexing Notes

Important indexes:

```text
items(user_id, status, category)
items(user_id, last_worn_at)
item_materials(item_id)
item_colors(item_id, role)
media_assets(user_id, item_id, media_type)
media_assets(user_id, outfit_id, media_type)
media_assets(user_id, storage_state)
outfit_previews(user_id, outfit_id)
outfits(user_id, favorite)
wear_logs(user_id, worn_at desc)
wear_log_items(item_id)
weather_snapshots(user_id, forecast_for)
item_relationships(user_id, source_item_id, relationship_type)
item_relationships(user_id, target_item_id, relationship_type)
ai_jobs(user_id, status, created_at)
sync_operations(user_id, server_version)
```

## Migration Guidance

Application migrations should:

- Create tables under `wardrobe`.
- Set `search_path` explicitly during migration.
- Never assume a physical database target.
- Never create cloud resources.
- Avoid cross-schema references in public app migrations.
- Include rollback notes for destructive changes.

## Example Logical Bootstrap

This is a logical shape only. The actual runtime role, database target, and
deployment path are managed outside this repo.

```sql
create schema if not exists wardrobe;

create table if not exists wardrobe.items (
  id uuid primary key,
  user_id uuid not null,
  category text not null,
  nickname text,
  brand text,
  status text not null default 'active',
  times_worn integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists wardrobe_items_user_status_category_idx
  on wardrobe.items (user_id, status, category);
```
