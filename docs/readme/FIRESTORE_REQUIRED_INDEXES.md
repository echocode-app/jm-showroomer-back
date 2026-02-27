# Firestore Required Indexes (Backend)

This document lists all currently required **composite** Firestore indexes for backend query paths.

Source of truth:
- `/Users/annakotlyar/Desktop/projects/jm-showroomer-back/firestore.indexes.json`

Deployment:
```bash
firebase deploy --only firestore:indexes
```

## showrooms (composite)

1. `status ASCENDING | updatedAt DESCENDING | __name__ ASCENDING`
2. `status ASCENDING | submittedAt DESCENDING | __name__ ASCENDING`
3. `status ASCENDING | country ASCENDING | updatedAt DESCENDING | __name__ ASCENDING`
4. `status ASCENDING | type ASCENDING | updatedAt DESCENDING | __name__ ASCENDING`
5. `status ASCENDING | availability ASCENDING | updatedAt DESCENDING | __name__ ASCENDING`
6. `status ASCENDING | category ASCENDING | updatedAt DESCENDING | __name__ ASCENDING`
7. `status ASCENDING | categoryGroup ASCENDING | updatedAt DESCENDING | __name__ ASCENDING`
8. `status ASCENDING | subcategories CONTAINS | updatedAt DESCENDING | __name__ ASCENDING`
9. `status ASCENDING | categoryGroup ASCENDING | subcategories CONTAINS | updatedAt DESCENDING | __name__ ASCENDING`
10. `status ASCENDING | geo.cityNormalized ASCENDING | updatedAt DESCENDING | __name__ ASCENDING`
11. `status ASCENDING | brandsNormalized CONTAINS | updatedAt DESCENDING | __name__ ASCENDING`
12. `status ASCENDING | geo.geohash ASCENDING | __name__ ASCENDING`
13. `status ASCENDING | brandsMap.zara ASCENDING | geo.geohash ASCENDING | __name__ ASCENDING`
14. `status ASCENDING | nameNormalized ASCENDING | __name__ ASCENDING`
15. `ownerUid ASCENDING | updatedAt DESCENDING | __name__ ASCENDING`
16. `ownerUid ASCENDING | country ASCENDING | updatedAt DESCENDING | __name__ ASCENDING`
17. `ownerUid ASCENDING | type ASCENDING | updatedAt DESCENDING | __name__ ASCENDING`
18. `ownerUid ASCENDING | availability ASCENDING | updatedAt DESCENDING | __name__ ASCENDING`
19. `ownerUid ASCENDING | category ASCENDING | updatedAt DESCENDING | __name__ ASCENDING`
20. `ownerUid ASCENDING | geo.cityNormalized ASCENDING | updatedAt DESCENDING | __name__ ASCENDING`
21. `ownerUid ASCENDING | brandsNormalized CONTAINS | updatedAt DESCENDING | __name__ ASCENDING`
22. `ownerUid ASCENDING | geo.geohash ASCENDING | __name__ ASCENDING`
23. `ownerUid ASCENDING | nameNormalized ASCENDING | __name__ ASCENDING`
24. `status ASCENDING | country ASCENDING | geo.geohash ASCENDING | __name__ ASCENDING`
25. `ownerUid ASCENDING | country ASCENDING | geo.geohash ASCENDING | __name__ ASCENDING`
26. `country ASCENDING | geo.geohash ASCENDING | __name__ ASCENDING`
27. `status ASCENDING | country ASCENDING | nameNormalized ASCENDING | __name__ ASCENDING`
28. `ownerUid ASCENDING | country ASCENDING | nameNormalized ASCENDING | __name__ ASCENDING`
29. `country ASCENDING | nameNormalized ASCENDING | __name__ ASCENDING`

### Notes for map/counters paths
- The map/counters geohash path requires:
  - `status + geo.geohash (+ __name__)`
  - `status + country + geo.geohash (+ __name__)`
- Owner/admin variants are included as well to avoid role-specific index misses.

## lookbooks (composite)

1. `published ASCENDING | countryNormalized ASCENDING | seasonKey ASCENDING | sortRank ASCENDING | __name__ ASCENDING`
2. `published ASCENDING | countryNormalized ASCENDING | seasonKey ASCENDING | sortRank ASCENDING | publishedAt DESCENDING | __name__ ASCENDING`
3. `published ASCENDING | createdAt DESCENDING | __name__ DESCENDING`
4. `published ASCENDING | showroomId ASCENDING | createdAt DESCENDING | __name__ DESCENDING`

## events (composite)

1. `published ASCENDING | startsAt ASCENDING | __name__ ASCENDING`
2. `published ASCENDING | country ASCENDING | startsAt ASCENDING | __name__ ASCENDING`
3. `published ASCENDING | cityNormalized ASCENDING | startsAt ASCENDING | __name__ ASCENDING`
4. `published ASCENDING | country ASCENDING | cityNormalized ASCENDING | startsAt ASCENDING | __name__ ASCENDING`

## notifications

No extra composite index is required currently for notifications list/count paths.
Firestore rejected `notifications(createdAt DESC, __name__ DESC)` as unnecessary.
