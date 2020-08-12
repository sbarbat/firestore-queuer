# Firebase Firestore Queue System
  
This is a queue system that uses Firebase Firestore to store the messages and Firebase Cloud Functions. Using Firestore
we make sure our queue system is performant, scalable and easy to maintain.

The worker that process each message in the queue uses Firestore `stream()` method to fetch the messages from the queue
collection so it can process a lot of data without overloading the database.

## Configuration

### Worker

The worker by default is configured to check if there are any new messages to process every 1 minute, but this can
be changed on the [index](functions/src/index.ts) file.

### Processors

The processors are the functions that are going to be used to process a message stored on the queue. They
must be defined on the [queue-processors](functions/src/queue-processors.ts) file and each needs to implement
the following interface:

```typescript
/**
 * Message processor interface.
 *
 * All the processors must implement this interface.
 */
export interface MessageProcessor {
    (data: Message): Promise<Message>;
}
```

Each processor needs to return a promise. If the promise fails, the worker will try to reprocess the file 
the amount of times specified on the message in the `retry` field or use the default (5 retries). If the
promise was resolved, the message will be removed from the queue since it's been processed.

There is processor example that will log the processor function and arguments in the 
[queue-processors](functions/src/queue-processors.ts) file:

```typescript
/**
 * Simple log processor
 *
 * @param msg message
 */
export const log: MessageProcessor = (msg: Message): Promise<Message> => {
    console.log(msg.processor.toString(), msg.arguments.toString());

    return Promise.resolve(msg);
}

```

## Deployment

- [Make sure to have installed and configured the Firebase CLI for your project.](https://firebase.google.com/docs/cli#sign-in-test-cli)
- Replace the `your-firebase-project-id-here` with your Firebase project id in the [.firebaserc](.firebaserc) file.
- Run the `firebase deploy` command.

## Queue a message

A HTTP `queue` function is exposed to send messages to the queue. By default only logged users in can send messages
to the queue but this can be changed on the [index](functions/src/index.ts) file.

Check the offical firebase documenation for more ways of calling the function to queue a message: 
[Call functions via HTTP requests](https://firebase.google.com/docs/functions/http-events)

The `queue` function can have the following parameters:
- processor: The name of the function to use to process the message, for our example `log`
- arguments: Any argument we want to send to the processor function. Default: null
- retry: The number of times to attempt to process the message if it fails. Default: 5
- delay: Delay to process the message from when its added to the queue. Defalt: 0