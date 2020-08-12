import {Message, MessageProcessor} from "./queue";

/**
 * Simple log processor
 *
 * @param msg
 */
export const log: MessageProcessor = (msg: Message): Promise<Message> => {
    console.log(msg.processor.toString(), msg.arguments.toString());

    return Promise.resolve(msg);
}


/* ADD YOUR PROCESSORS HERE */