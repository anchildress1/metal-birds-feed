# Changelog

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
