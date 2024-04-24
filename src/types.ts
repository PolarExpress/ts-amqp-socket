import amqp, { ConsumeMessage } from "amqplib";


/**
 * Message contained in the header of the AMQP message, which corresponds with
 * the initial frontend request. Identical to the message contents when receiving
 * directly from client-updater-service.
 */
export interface AmqpFrontendMessage {
    sessionData: SessionData;
    fromFrontend: {
        callID: string;
        body: string;
    };
}

/**
 * Contents of a response message
 */
export interface AmqpResponse {
    value: unknown;
    type: string;
    callID: string;
}

/**
 * An asynchronous pure data handler with authentication context
 */
export type AuthHandler = (
    req: object,
    session: SessionData
) => Promise<unknown>;

/**
 * An asynchronous pure data handler
 */
export type Handler = (req: object) => Promise<unknown>;

/**
 * Session data of the client
 */
export interface SessionData {
    username: string;
    userID: string;
    impersonateID: string;
    sessionID: string;
    saveStateID: string;
    roomID: string;
    jwt: string;
}

/**
 * Configuration for an AmqpSocket
 */
export interface AmqpConfig {
    queue: {
        /** name of the queue to consume messages from */
        request: string;
    };
    exchange: {
        /** name of the exchange the request queue is bound to */
        request: string;
        /** name of the exchange to publish responses to */
        response: string;
    };
    routingKey: {
        /** routing key to bind the request queue with */
        request: string;
    };
    /**
     * Contents of the `type` field in a success response.
     * `type` is used in the frontend to call explicit callback functions
    */
    successType: string;
    /**
     * Contents of the `type` field in an error response.
     * `type` is used in the frontend to call explicit callback functions
    */
    errorType: string;
    /**
     * Selector function for getting the body from the AMQP message.
     * @param message The received message
     * @returns The body to pass to the handlers.
     */
    bodyMapper: (message: ConsumeMessage) => AmqpRequestBody;
}

/**
 * The body to pass to the handlers. contains an optional `action` field
 * for selecting the handler.
 */
export interface AmqpRequestBody {
    action?: string;
}

/**
 * Context for publishing a message
 * @param routingKey The routing key to send the message to
 * @param callID The call ID of the message
 * @param headers The headers of the message
 */
export interface PublishContext {
    routingKey: string;
    callID: string;
    headers: amqp.MessagePropertyHeaders | undefined;
}
