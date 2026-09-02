# Vendored reference data

`administrative-divisions.json` is generated from **china-division 2.7.0**:
https://github.com/modood/Administrative-divisions-of-China

Mainland source: National Bureau of Statistics 2023 statistical divisions, cutoff 2023-06-30. Includes statistical development zones, not just legal administrative counties. The upstream `HK-MO-TW.json` supplements names without codes; empty codes are intentional. Its 20 Taiwan cities/counties are supplemented with Kinmen/Lienchiang names (6 and 4 townships) from https://roaddig.kinmen.gov.tw/KMLocApi/Dss/TownList and https://travel.matsu.gov.tw/ . This supplement follows common form-address grouping, not a statement about legal jurisdiction or a new code standard. Do not treat this as a current official legal registry or synthesize missing codes. Runtime never fetches remote data.

License (upstream):

    DO WHAT THE FUCK YOU WANT TO PUBLIC LICENSE
    Version 2, December 2004

    Copyright (C) 2004 Sam Hocevar <sam@hocevar.net>

    Everyone is permitted to copy and distribute verbatim or modified
    copies of this license document, and changing it is allowed as long
    as the name is changed.

    DO WHAT THE FUCK YOU WANT TO PUBLIC LICENSE
    TERMS AND CONDITIONS FOR COPYING, DISTRIBUTION AND MODIFICATION

    0. You just DO WHAT THE FUCK YOU WANT TO.

`undergraduate-majors-2026.json` is extracted from the Ministry of Education's
2026 undergraduate major directory (教高函〔2026〕2号):
https://www.moe.gov.cn/srcsite/A08/moe_1034/s3882/202604/t20260427_1434931.html

Downloadable republication used because the ministry attachment was unavailable from the build host:
https://edu-sjtu.cn/ResourceCentreDetail?PK_ResourceGuid=639C5E21-27C3-4B28-8902-1AF02455E6FA

The catalog contains 13 disciplinary categories, 92 professional classes, and 883 majors. Interdisciplinary majors (category 14) have no professional-class layer in this edition; no fictitious class is added. Names/codes are factual directory data; annotations about degree awards are not substituted for disciplinary ownership. This is the **undergraduate** catalog, not a postgraduate/vocational catalog.

Rebuild scripts in `scripts/` validate source version and coverage before generating files. Review source changes and representative hierarchies before committing regenerated data.
