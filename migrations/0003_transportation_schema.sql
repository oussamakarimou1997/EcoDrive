-- Transportation storage, isolated from existing catalog tables.
CREATE TABLE IF NOT EXISTS transport_centers (
 id TEXT PRIMARY KEY CHECK(id IN ('dic','al_quoz')),
 name TEXT NOT NULL
);
INSERT OR IGNORE INTO transport_centers VALUES ('dic','DIC Centre'),('al_quoz','Al Quoz Centre');

CREATE TABLE IF NOT EXISTS transport_routes (
 id TEXT PRIMARY KEY,
 center_id TEXT NOT NULL REFERENCES transport_centers(id),
 route_code TEXT NOT NULL,
 title TEXT NOT NULL,
 schedule_type TEXT NOT NULL,
 capacity INTEGER NOT NULL CHECK(capacity > 0),
 center_eta_name TEXT NOT NULL,
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 UNIQUE(center_id,route_code)
);
CREATE TABLE IF NOT EXISTS transport_stops (
 id TEXT PRIMARY KEY,
 route_id TEXT NOT NULL REFERENCES transport_routes(id),
 name TEXT NOT NULL,
 landmark TEXT NOT NULL DEFAULT '',
 pin_url TEXT,
 latitude REAL CHECK(latitude BETWEEN -90 AND 90),
 longitude REAL CHECK(longitude BETWEEN -180 AND 180),
 position INTEGER NOT NULL CHECK(position >= 0),
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 CHECK((latitude IS NULL) = (longitude IS NULL)),
 UNIQUE(route_id,id)
);
CREATE TABLE IF NOT EXISTS transport_trips (
 id TEXT PRIMARY KEY,
 route_id TEXT NOT NULL REFERENCES transport_routes(id),
 position INTEGER NOT NULL CHECK(position >= 0),
 eta TEXT,
 departure TEXT,
 notes TEXT,
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 UNIQUE(route_id,id)
);
CREATE TABLE IF NOT EXISTS transport_stop_times (
 route_id TEXT NOT NULL,
 trip_id TEXT NOT NULL,
 stop_id TEXT NOT NULL,
 pickup_time TEXT NOT NULL,
 PRIMARY KEY(trip_id,stop_id),
 FOREIGN KEY(route_id,trip_id) REFERENCES transport_trips(route_id,id),
 FOREIGN KEY(route_id,stop_id) REFERENCES transport_stops(route_id,id)
);
-- Departures not paired with a pickup trip (including special destinations).
CREATE TABLE IF NOT EXISTS transport_departures (
 id TEXT PRIMARY KEY,
 route_id TEXT NOT NULL REFERENCES transport_routes(id),
 departure_time TEXT NOT NULL,
 destination TEXT,
 notes TEXT,
 position INTEGER NOT NULL CHECK(position >= 0),
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1))
);
CREATE TABLE IF NOT EXISTS transport_backups (
 id TEXT PRIMARY KEY,
 center_id TEXT NOT NULL REFERENCES transport_centers(id),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 source_filename TEXT,
 snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json))
);
CREATE INDEX IF NOT EXISTS idx_transport_routes_center ON transport_routes(center_id,active);
CREATE INDEX IF NOT EXISTS idx_transport_stops_route ON transport_stops(route_id,active,position);
CREATE INDEX IF NOT EXISTS idx_transport_trips_route ON transport_trips(route_id,active,position);
CREATE INDEX IF NOT EXISTS idx_transport_departures_route ON transport_departures(route_id,active,position);
CREATE INDEX IF NOT EXISTS idx_transport_backups_center ON transport_backups(center_id,created_at);
