import * as admin from 'firebase-admin';
import * as functions from "firebase-functions";
import {Message, queue, worker} from "./queue";

admin.initializeApp();

exports.queue = functions.https.onCall(async (data: Message, context) => {
    if (!context.auth?.uid) {
        throw new functions.https.HttpsError('permission-denied', 'Permission denied');
    }

    return queue(data);
});


exports.worker = functions.pubsub.schedule('every 1 minutes').onRun(() => worker());