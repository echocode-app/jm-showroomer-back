// Purpose: Shared Firestore transaction runner.
// Responsibility: Provide one place for transaction invocation and future instrumentation.
// Invariant: callback must be side-effect free outside Firestore writes.

export async function runFirestoreTransaction(db, callback) {
    return db.runTransaction(async tx => callback(tx));
}
