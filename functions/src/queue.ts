import * as admin from 'firebase-admin';
import * as processors from './queue-processors';
import * as functions from "firebase-functions";

/**
 * Message processor interface.
 *
 * All the processors must implement this interface.
 */
export interface MessageProcessor {
    (data: Message): Promise<Message>;
}

/**
 * Message
 */
export interface Message {
    retry: number;
    retry_count?: number;
    processor: string;
    arguments?: any;
    delay?: number;
    created_at: number;
    execute_at: number;
    last_execution_at?: number;
}


const getCollection = (): string => {
    return 'queue';
}

/**
 * Handles a message with error
 * @param data
 * @param err
 */
const handleError = (data: admin.firestore.QueryDocumentSnapshot<Message>, err: any) => {
    const msg = data.data();
    const retry = msg.retry ?? 5;
    const retry_count = (msg.retry_count ?? 0) + 1;

    if (retry_count < retry) {
        console.log(`Retry ${retry_count}/${retry} for message ${data.id} failed. Attempting again on next run.`);
        data.ref.update({
            retry_count: admin.firestore.FieldValue.increment(1),
            last_execution_at: admin.firestore.Timestamp.now().toMillis()
        }).catch(e => console.error(e));
    } else {
        console.error(`Message ${data.id} exceeded the retry threshold`);
        data.ref.delete().catch(e => console.error(e));
    }
}

/**
 * Handles a processed message
 *
 * @param data
 */
const handleProcessed = (data: admin.firestore.QueryDocumentSnapshot<Message>) => {
    data.ref.delete().catch(err => console.error(err));
}

/**
 * Adds a new message to the queue
 *
 * @param msg
 */
export const queue = async (msg: Message): Promise<any> => {
    if (!msg.processor) {
        throw new functions.https.HttpsError('failed-precondition', 'The message must have a processor');
    }

    if (!(msg.processor in processors)) {
        throw new functions.https.HttpsError('failed-precondition', `There isn't any processor for the '${msg.processor}' function`);
    }

    msg.created_at = admin.firestore.Timestamp.now().toMillis();

    if (msg.delay) {
        msg.execute_at = msg.created_at + msg.delay;
    } else {
        msg.execute_at = msg.created_at;
    }

    return admin.firestore().collection(getCollection()).add(msg);
}

/**
 * Process messages in the queue
 */
export const worker = async () => {
    let processed = 0;
    let errors = 0;

    const now = admin.firestore.Timestamp.now().toMillis();
    const messages = await admin.firestore().collection(getCollection())
        .where('execute_at', '<=', now)
        .orderBy('execute_at')
        .stream();

    messages.on('data', (doc) => {
        const msg = doc.data() as Message;
        const fn = msg.processor.trim();
        const retry = msg.retry ?? 5;
        const retry_count = (msg.retry_count ?? 0) + 1;

        console.log(`Processing message ${doc.id} with processor ${fn}, try ${retry_count}/${retry}`);

        if (fn in processors) {
            try {
                // @ts-ignore
                const call = processors[fn].call(msg, msg) as Promise<Message>;

                call.then(() => {
                    handleProcessed(doc);
                    processed++;
                }).catch(err => {
                    handleError(doc, err);
                    errors++
                })
            } catch (err) {
                handleError(doc, err);
                errors++
            }
        }
    });

    messages.on('end', () => {
        console.log(`Finishing processing queue.`);
        console.log(`${processed} processed messages.`);
        console.log(`${errors} messages with errors.`)
    });
}