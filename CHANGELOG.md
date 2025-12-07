# Changelog
Todos los cambios notables del proyecto van acá.
Formato basado en "Keep a Changelog" y SemVer.

## [Unreleased]
### Added
- (Agregá acá lo nuevo que todavía no liberaste)

### Changed
- (Cambios que todavía no liberaste)

### Fixed
- (Arreglos que todavía no liberaste)

---

## [0.1.0] - YYYY-MM-DD
### Added
- Backend: endpoints Services (GET/POST/PUT/DELETE) y normalización.
- Tickets: POST /api/tickets/:serviceId, GET /api/tickets/:id, estimate y cancel.
- Frontend: api-client, api-mode, use-services, use-tickets.
- UIs: Terminal autoservicio y Display (cartelera) con audio/QR.

### Changed
- QueueContext: modo API inicia vacío; modo local con mocks + storage.

### Fixed
- Inputs numéricos (NaN) y 404 confusos de assets.
