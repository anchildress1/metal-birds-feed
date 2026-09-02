# Changelog

## [2.1.0](https://github.com/anchildress1/metal-birds-feed/compare/v2.0.0...v2.1.0) (2026-09-02)


### Features

* onboard hr-ccaa (Croatian Civil Aviation Agency register) ([#137](https://github.com/anchildress1/metal-birds-feed/issues/137)) ([303e762](https://github.com/anchildress1/metal-birds-feed/commit/303e76211ca63a1f60c6c1254fca9197cfe3e69c))


### Bug Fixes

* hold cadence to calendar days and escalate an overdue source ([#154](https://github.com/anchildress1/metal-birds-feed/issues/154)) ([1aa79a1](https://github.com/anchildress1/metal-birds-feed/commit/1aa79a11065bdab116affd2875e840ccb200f603))
* null br-anac's "normal situation" code so PRALL resolves ([#157](https://github.com/anchildress1/metal-birds-feed/issues/157)) ([a30fdfc](https://github.com/anchildress1/metal-birds-feed/commit/a30fdfc50c72e728c4b557aed1b2c6ed409e9e3b))
* read br-anac status from CD_INTERDICAO, not the cancellation date ([#156](https://github.com/anchildress1/metal-birds-feed/issues/156)) ([084bebc](https://github.com/anchildress1/metal-birds-feed/commit/084bebcc47a672df7bcf1616a930339650940b39))
* retry a translation run when only ambiguous duplicates failed ([#149](https://github.com/anchildress1/metal-birds-feed/issues/149)) ([68e3adf](https://github.com/anchildress1/metal-birds-feed/commit/68e3adf3b593b81fea8e6eb7bd7889323265f9d2))
* retry discovery-pattern matching, not just the discovery fetch ([#141](https://github.com/anchildress1/metal-birds-feed/issues/141)) ([7609b17](https://github.com/anchildress1/metal-birds-feed/commit/7609b17d1cc8a645550cb6b08607243c9343c17a))

## [2.0.0](https://github.com/anchildress1/metal-birds-feed/compare/v1.0.0...v2.0.0) (2026-08-21)


### ⚠ BREAKING CHANGES

* the per-source artifact's `status` column and the canonical `Aircraft` schema's `status` field are now nullable; a consumer built against user_version 11 or earlier must not assume every row carries a concrete status.

### Features

* non-developer onboarding — manual guide, AI-assisted guide, and a setup skill ([#120](https://github.com/anchildress1/metal-birds-feed/issues/120)) ([a3e4533](https://github.com/anchildress1/metal-birds-feed/commit/a3e4533e4c46397560e298521b1481021621a463))
* onboard TKA Lithuania, and fix what reviewing and running it exposed ([#127](https://github.com/anchildress1/metal-birds-feed/issues/127)) ([e8006e0](https://github.com/anchildress1/metal-birds-feed/commit/e8006e0b1cc0f5ea3546f091d6e786f0c6c4baa9))


### Bug Fixes

* reject inherited JSON paths and array descent in dotted-path traversal ([#114](https://github.com/anchildress1/metal-birds-feed/issues/114)) ([1ef490d](https://github.com/anchildress1/metal-birds-feed/commit/1ef490d68b4888d05c8fcbc7755d0b44fc6a49c1))
* repair sg-caas discovery and harden the Cloud Run deploy step ([#130](https://github.com/anchildress1/metal-birds-feed/issues/130)) ([7c1e675](https://github.com/anchildress1/metal-birds-feed/commit/7c1e6751816a62821f054d636e02ca50116ac9f4))
* repair the deploy failure and the bugs review surfaced along the way ([#128](https://github.com/anchildress1/metal-birds-feed/issues/128)) ([0fe6f40](https://github.com/anchildress1/metal-birds-feed/commit/0fe6f4033e8b9faa06e9d93d2b9cc4b47df82aab))
* repo-wide audit — silent-failure fixes, dead code, and CI hardening ([#123](https://github.com/anchildress1/metal-birds-feed/issues/123)) ([f1797d6](https://github.com/anchildress1/metal-birds-feed/commit/f1797d682ae8051175f044d7ee7f16e8508f90c7))

## [1.0.0](https://github.com/anchildress1/metal-birds-feed/compare/v0.1.1...v1.0.0) (2026-08-09)


### ⚠ BREAKING CHANGES

* **service:** feed DB PRAGMA user_version 4 -> 5; the feed table gains a registration_key column with a unique index, and cancelled registrations no longer appear in the served feed.
* **localize:** `translations_en` is gone from the canonical record; the `cancellation_reason_en` / `airworthiness_class_en` feed columns are now `cancellation_reason` / `airworthiness_class`. Consumers must re-read both databases.

### Features

* **localize:** persist translations per chunk instead of once per run ([#94](https://github.com/anchildress1/metal-birds-feed/issues/94)) ([c7ff632](https://github.com/anchildress1/metal-birds-feed/commit/c7ff632d330fe12190c074b6b2d881a3496b7c7a))
* **localize:** prune cache entries upstream no longer publishes ([#96](https://github.com/anchildress1/metal-birds-feed/issues/96)) ([ccb2aaa](https://github.com/anchildress1/metal-birds-feed/commit/ccb2aaa76879911fea9f6eee1e8167779f194cb2))
* **localize:** render translatable register fields English-primary via Gemini ([#93](https://github.com/anchildress1/metal-birds-feed/issues/93)) ([563075a](https://github.com/anchildress1/metal-birds-feed/commit/563075ab79574b8307825eebdf9e04875a66b3f2))
* **localize:** stop re-billing text the model reliably mangles ([#95](https://github.com/anchildress1/metal-birds-feed/issues/95)) ([8fb9fa9](https://github.com/anchildress1/metal-birds-feed/commit/8fb9fa9057a7232d813ee9b07b8ca68961cde3c8))
* **nz-caa:** add the CAA New Zealand register as a hex-bearing source ([#92](https://github.com/anchildress1/metal-birds-feed/issues/92)) ([54816e9](https://github.com/anchildress1/metal-birds-feed/commit/54816e91bafc772d957d86034d3110fe9f3bfcf6))
* **service:** add a registration lookup alongside the hex one ([#105](https://github.com/anchildress1/metal-birds-feed/issues/105)) ([ce93df6](https://github.com/anchildress1/metal-birds-feed/commit/ce93df6ba07a12e977b329f241c325a881596a3f))


### Bug Fixes

* **mv-caa:** match the register PDF's relative discover href ([#85](https://github.com/anchildress1/metal-birds-feed/issues/85)) ([47fc9ed](https://github.com/anchildress1/metal-birds-feed/commit/47fc9ed366359b9728564535a4166c7058caa99a))
* **sources:** map the register values that were nulling 15,749 rows ([#108](https://github.com/anchildress1/metal-birds-feed/issues/108)) ([8dbae08](https://github.com/anchildress1/metal-birds-feed/commit/8dbae08f5e54fcd155806e08ba0de31f8778c17f))

## [0.1.1](https://github.com/anchildress1/metal-birds-feed/compare/v0.1.0...v0.1.1) (2026-07-26)


### Features

* **cl-dgac:** onboard Chile register + merge-duplicates engine capability ([cdbb989](https://github.com/anchildress1/metal-birds-feed/commit/cdbb98909aae101023c2f97aa8f7a4dd465cef08))
* **no-caa:** onboard Norway register + deploy/runtime docs + FAA/TC cadence ([#77](https://github.com/anchildress1/metal-birds-feed/issues/77)) ([a412e28](https://github.com/anchildress1/metal-birds-feed/commit/a412e2878fdb546e43e27112f39d538201b6ceac))


## [0.1.0](https://github.com/anchildress1/metal-birds-feed/compare/v0.0.12...v0.1.0) (2026-07-21)


### Features

* private feed service (Cloud Run + baked SQLite) ([#72](https://github.com/anchildress1/metal-birds-feed/issues/72)) ([3e6af95](https://github.com/anchildress1/metal-birds-feed/commit/3e6af955bc240d3e8f9e7a893d07bd0141f97074))
* **service:** per-source attribution + display-ready type/engine on /feed ([#75](https://github.com/anchildress1/metal-birds-feed/issues/75)) ([48af14f](https://github.com/anchildress1/metal-birds-feed/commit/48af14f7a3fd9d01ccd6c5af712b86dbbbccff57))


### Bug Fixes

* FAA/br-anac live-data drift + land feed-service hardening missed by [#72](https://github.com/anchildress1/metal-birds-feed/issues/72) ([#74](https://github.com/anchildress1/metal-birds-feed/issues/74)) ([e247952](https://github.com/anchildress1/metal-birds-feed/commit/e247952c3920ed041a5c9900e33afa0e5419000b))


### Miscellaneous Chores

* Release as 0.1.0 ([191f0c6](https://github.com/anchildress1/metal-birds-feed/commit/191f0c603643c9da393c2b79ae17ed1fa8fb5eea))

## [0.0.12](https://github.com/anchildress1/metal-birds-feed/compare/v0.0.11...v0.0.12) (2026-07-14)


### Features

* **es-aesa:** onboard AESA Spain aircraft register ([#59](https://github.com/anchildress1/metal-birds-feed/issues/59)) ([f61cfd3](https://github.com/anchildress1/metal-birds-feed/commit/f61cfd3d862a6804ec8b9e11dbb2d5d2239c8f1c))


### Bug Fixes

* fail ambiguous source_id collisions instead of guessing by recency ([#63](https://github.com/anchildress1/metal-birds-feed/issues/63)) ([cc36c40](https://github.com/anchildress1/metal-birds-feed/commit/cc36c40a7515ad2f2111e33a4a6842d9e99eb727))
* log when a lookup default silently absorbs an unrecognized value ([14607fe](https://github.com/anchildress1/metal-birds-feed/commit/14607fea36b45e6b8965529b1c873f11b0468c02))
* remove stale pipeline.ts coverage exclusion, close its real gaps ([#65](https://github.com/anchildress1/metal-birds-feed/issues/65)) ([6f57b04](https://github.com/anchildress1/metal-birds-feed/commit/6f57b04bbc49aaa227e1dda59c0361a22df5ec14))
* replace reissued duplicate source_id rows instead of failing ([#61](https://github.com/anchildress1/metal-birds-feed/issues/61)) ([268c838](https://github.com/anchildress1/metal-birds-feed/commit/268c8382191f5d899980a0a29ea325098eddca5d))
* repo-wide review — parsing, config validation, cadence, hot-path perf ([#66](https://github.com/anchildress1/metal-birds-feed/issues/66)) ([14607fe](https://github.com/anchildress1/metal-birds-feed/commit/14607fea36b45e6b8965529b1c873f11b0468c02))

## [0.0.11](https://github.com/anchildress1/metal-birds-feed/compare/v0.0.10...v0.0.11) (2026-07-07)


### Features

* **sg-caas:** onboard CAAS Singapore register + correct license tracker ([#57](https://github.com/anchildress1/metal-birds-feed/issues/57)) ([2e85079](https://github.com/anchildress1/metal-birds-feed/commit/2e85079df5b15f3e9c264588fa7115cbba21e58d))

## [0.0.10](https://github.com/anchildress1/metal-birds-feed/compare/v0.0.9...v0.0.10) (2026-07-05)


### Bug Fixes

* **build:** make build emits again + CI gate so it can't silently regress ([#55](https://github.com/anchildress1/metal-birds-feed/issues/55)) ([dd03850](https://github.com/anchildress1/metal-birds-feed/commit/dd03850df0d39eff2b945b16de8fd170fb142479))

## [0.0.9](https://github.com/anchildress1/metal-birds-feed/compare/v0.0.8...v0.0.9) (2026-07-05)


### Features

* onboard Estonia (Transpordiamet) register via HTML parser path ([#47](https://github.com/anchildress1/metal-birds-feed/issues/47)) ([91d3a93](https://github.com/anchildress1/metal-birds-feed/commit/91d3a9331e76451db00dd7a28cb7af1b825f9c15))
* stream large zip downloads instead of buffering whole archives ([#52](https://github.com/anchildress1/metal-birds-feed/issues/52)) ([876090b](https://github.com/anchildress1/metal-birds-feed/commit/876090bc0c6de6e5090de848b4a98ecccdb2edd8))


### Bug Fixes

* silent-corruption guards across parser, engine, schema, and writer ([#51](https://github.com/anchildress1/metal-birds-feed/issues/51)) ([c4474d5](https://github.com/anchildress1/metal-birds-feed/commit/c4474d58ff0bcc2ce57b049f9b033888ea723924))

## [0.0.8](https://github.com/anchildress1/metal-birds-feed/compare/v0.0.7...v0.0.8) (2026-06-27)


### Features

* onboard CAA Maldives register via new PDF parser path ([#45](https://github.com/anchildress1/metal-birds-feed/issues/45)) ([bf7a06e](https://github.com/anchildress1/metal-birds-feed/commit/bf7a06ef7795ebc7afb79b334cefeee04b6fc168))


### Bug Fixes

* br-anac duplicate-row refresh failure + license-doc consolidation ([#43](https://github.com/anchildress1/metal-birds-feed/issues/43)) ([7af3458](https://github.com/anchildress1/metal-birds-feed/commit/7af34584f73d144810127bd148955e541e2f0479))

## [0.0.7](https://github.com/anchildress1/metal-birds-feed/compare/v0.0.6...v0.0.7) (2026-06-22)


### Features

* add Switzerland (FOCA/BAZL) register via JSON-over-POST path ([#41](https://github.com/anchildress1/metal-birds-feed/issues/41)) ([8a8b77f](https://github.com/anchildress1/metal-birds-feed/commit/8a8b77ff38d0d23ce1ae7765c2587f65e03686df))


### Bug Fixes

* make the daily refresh resilient to transient R2 errors ([#36](https://github.com/anchildress1/metal-birds-feed/issues/36)) ([bec1f8e](https://github.com/anchildress1/metal-birds-feed/commit/bec1f8eb7d27d1fdb20de46cfd4a41f16d13b116))

## [0.0.6](https://github.com/anchildress1/metal-birds-feed/compare/v0.0.5...v0.0.6) (2026-06-13)


### Features

* **br-anac:** ship ANAC Brasil registry (RAB) ([#33](https://github.com/anchildress1/metal-birds-feed/issues/33)) ([6330ddc](https://github.com/anchildress1/metal-birds-feed/commit/6330ddcf8660ef7bb183fe3c1ed66b3b0f0e192c))


### Bug Fixes

* **writer:** raise r2 write concurrency and socket ceiling ([#29](https://github.com/anchildress1/metal-birds-feed/issues/29)) ([30794e0](https://github.com/anchildress1/metal-birds-feed/commit/30794e0b733c901dc834daf9a0006db03108e7d7))

## [0.0.5](https://github.com/anchildress1/metal-birds-feed/compare/v0.0.4...v0.0.5) (2026-06-02)


### Features

* **cadence:** per-source cadence gating with daily cron and staleness alerts ([#28](https://github.com/anchildress1/metal-birds-feed/issues/28)) ([8aea69b](https://github.com/anchildress1/metal-birds-feed/commit/8aea69b1cfc68a4d04693e76ed05e02450aecbb4))
* **tw-caa:** ship CAA Taiwan (OGDL v1.0) + docs cleanup ([#23](https://github.com/anchildress1/metal-birds-feed/issues/23)) ([7b48a9b](https://github.com/anchildress1/metal-birds-feed/commit/7b48a9bae2062cdbb57b5e219aa250f26cb19a1e))

## [0.0.4](https://github.com/anchildress1/metal-birds-feed/compare/v0.0.3...v0.0.4) (2026-05-13)


### Features

* **au-casa:** ship CASA Australia + canonical operator/IDERA fields ([#14](https://github.com/anchildress1/metal-birds-feed/issues/14)) ([cc1669f](https://github.com/anchildress1/metal-birds-feed/commit/cc1669ffca1e56c6a4552dc68344dd2fad9fc387))
* **lv-caa:** ship CAA Latvia + add `fixed-wing` airframe enum ([#18](https://github.com/anchildress1/metal-birds-feed/issues/18)) ([0e7b861](https://github.com/anchildress1/metal-birds-feed/commit/0e7b8619ac83871c1cc5807c27b98675a84b27de))
* NL ILT live + registry roadmap reframe + 54-source license triage ([#12](https://github.com/anchildress1/metal-birds-feed/issues/12)) ([28189e6](https://github.com/anchildress1/metal-birds-feed/commit/28189e63940378b1d8c9c751751c65718731f516))

## [0.0.3](https://github.com/anchildress1/metal-birds-feed/compare/v0.0.2...v0.0.3) (2026-05-04)


### Features

* add Transport Canada (tc-ca) registry — R1.1, R1.2 ([#7](https://github.com/anchildress1/metal-birds-feed/issues/7)) ([68e2e97](https://github.com/anchildress1/metal-birds-feed/commit/68e2e973819ecb31c731610e0faed1779f3c816f))

## [0.0.2](https://github.com/anchildress1/metal-birds-feed/compare/metal-birds-feed-v0.0.1...metal-birds-feed-v0.0.2) (2026-05-03)


### Features

* FAA pipeline — R0.1–R0.9 complete ([#5](https://github.com/anchildress1/metal-birds-feed/issues/5)) ([daf5137](https://github.com/anchildress1/metal-birds-feed/commit/daf5137dc511b0072a57a2fb1ea201a913c57a6b))


### Bug Fixes

* refresh pipeline R2 throughput + parser correctness ([#8](https://github.com/anchildress1/metal-birds-feed/issues/8)) ([80c44f7](https://github.com/anchildress1/metal-birds-feed/commit/80c44f751687ba628145948b0175c223d6dac395))

## Changelog
