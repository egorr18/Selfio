# Changelog
All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project follows Semantic Versioning.

## [Unreleased]
### Added
- Account page (profile, plan, session actions).
- Theme toggle (dark/light) support in app pages.
- Export data (local/demo export).

### Changed
- Unified header behavior for app pages.
- Improved auth flow (login/register redirects and plan sync).

### Fixed
- Plan selection edge-cases and UI sync.
- GitHub Actions CI issues (tests/mocks updated).

## [0.2.0] - 2026-01-19
### Added
- GitHub Actions CI workflow (fmt, vet, test, build, docker build).
- Account UI structure for profile/plan/session.

### Fixed
- Mock repository methods to satisfy updated repository interface.

## [0.1.0] - 2026-01-01
### Added
- Initial backend auth (register/login) with Postgres.
- Basic frontend pages and navigation.
