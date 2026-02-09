// Merge multiple Firestore snapshots by id.

export function mergeSnapshots(snapshots) {
    const map = new Map();
    snapshots.forEach(snapshot => {
        snapshot.docs.forEach(doc => {
            if (!map.has(doc.id)) {
                map.set(doc.id, { id: doc.id, ...doc.data() });
            }
        });
    });
    return Array.from(map.values());
}
