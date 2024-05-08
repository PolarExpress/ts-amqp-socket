/*
 * This program has been developed by students from the bachelor
 * Computer Science at Utrecht University within the Software Project course.
 *
 * © Copyright Utrecht University
 * (Department of Information and Computing Sciences)
 */

import amqp from "amqplib";

import { RoutingKeyStore } from "./routingKeyStore";
import {
  AmqpConfig,
  AmqpFrontendMessage,
  AmqpRequestBody,
  AmqpResponse,
  AuthHandler,
  Handler,
  PublishContext
} from "./types";
import { panic } from "./utils";

/**
 * ## AmqpSocket
 *
 * AMQP connection wrapper for using request-response like endpoints over the
 * GraphPolaris AMQP architecture.
 *
 * ## Example
 *
 *     const amqpConfig: AmqpConfig = {
 *       // (see AmqpConfig for more details)
 *     };
 *     const store = createRoutingKeyStore();
 *     const amqp = await createAmqpSocket(amqpConfig, store);
 *
 *     amqp.handle("foo", (req, session) => {
 *       return { bar: "bar" };
 *     });
 *
 *     amqp.listen();
 */
export class AmqpSocket {
  private handlers: Record<string, AuthHandler> = {};

  public constructor(
    private config: AmqpConfig,
    private channel: amqp.Channel,
    private routingKeyStore: RoutingKeyStore
  ) {
    this.channel.assertQueue(config.queue.request);
    this.channel.assertExchange(config.exchange.request, "direct");
    this.channel.bindQueue(
      config.queue.request,
      config.exchange.request,
      config.routingKey.request
    );

    this.channel.assertExchange(config.exchange.response, "direct");
  }

  /**
   * Publishes a message to the frontend.
   *
   * @param context  Publish context needed to send the message.
   * @param response The response to send to the frontend.
   * @param type     The type of the message (used for type-based callbacks in
   *   the frontend)
   * @param status   The status of the message (e.g. success, error, ...)
   */
  private publish(context: PublishContext, response: unknown, type: string) {
    const responseMessage: AmqpResponse = {
      value: response,
      type: type,
      callID: context.callID
    };

    // serialize the contents to a buffer
    const buffer = Buffer.from(JSON.stringify(responseMessage));

    this.channel.publish(
      this.config.exchange.response,
      context.routingKey,
      buffer,
      { headers: context.headers }
    );
  }

  /**
   * Publishes an error message to the frontend.
   *
   * @param context Publish context needed to send the message.
   * @param error   The error message to send to the frontend.
   */
  private publishError(context: PublishContext, error: string) {
    this.publish(context, { error: error }, this.config.errorType);
  }

  /**
   * Publishes a success message to the frontend.
   *
   * @param context  Publish context needed to send the message.
   * @param response The response to send to the frontend.
   */
  private publishSuccess(context: PublishContext, response: unknown) {
    this.publish(context, response, this.config.successType);
  }

  /**
   * Registers a handler for a specific action.
   *
   * Handlers registered to `"__default"` will be called when no action is
   * specified. Errors thrown by handlers will be caught and forwarded to the
   * frontend as an error message.
   *
   * ## Example
   *
   *     amqp.handle("foo", (req, session) => {
   *       return { bar: "bar" };
   *     });
   *
   * @param key     The action to register the handler for.
   * @param handler The handler to register.
   */
  public handle(key: string, handler: AuthHandler | Handler) {
    this.handlers[key] = handler;
  }

  /**
   * Start listening for messages.
   */
  public listen() {
    this.channel.consume(this.config.queue.request, async message => {
      if (!message) {
        return;
      }
      this.channel.ack(message); // send acknowledge
      console.log("Received message:", message);

      // grab the message stored inside the header
      const headerContent = JSON.parse(
        message.properties.headers?.message.toString()
      ) as AmqpFrontendMessage;

      // get the body using the selector function
      const body: AmqpRequestBody = this.config.bodyMapper(message);

      // get the routing key of the session to respond to
      const sessionId = headerContent.sessionData.sessionID;
      const routingKey = await this.routingKeyStore.get(sessionId);

      if (routingKey == undefined) {
        console.warn("Routing key not found, session is no longer alive");
        console.warn("Ignoring...");
        return;
      }
      console.log("Routing key:", routingKey);

      // build a PublishContext
      // * callID is provided by original frontend message
      // * headers are the same as the incoming message
      const context: PublishContext = {
        routingKey: routingKey,
        callID: headerContent.fromFrontend.callID,
        headers: message.properties.headers
      };

      // if no action is specified and no __default handler exists,
      // return an error
      if (body.action == undefined && !("__default" in this.handlers)) {
        this.publishError(context, "No action specified");
        return;
      }
      // default action is __default
      body.action ??= "__default";

      // if the action doesn't exist, return an error
      if (!(body.action in this.handlers)) {
        this.publishError(context, `Action "${body.action}" doesn't exist`);
        return;
      }

      const handler = this.handlers[body.action];

      // call the handler and publish the response
      try {
        const response = await handler(body, headerContent.sessionData);
        this.publishSuccess(context, response);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "An error occurred";
        this.publishError(context, message);
      }
    });
  }
}

/**
 * Creates an AMQP socket.
 *
 * @param   config          Configuration for the AmqpSocket.
 * @param   routingKeyStore The routing-key store to use.
 *
 * @returns                 The created AMQP socket.
 */
export async function createAmqpSocket(
  config: AmqpConfig,
  routingKeyStore: RoutingKeyStore
) {
  // RabbitMQ credentials
  const opt = {
    credentials: amqp.credentials.plain(
      process.env.RABBIT_USER ?? panic("RABBIT_USER not set"),
      process.env.RABBIT_PASSWORD ?? panic("RABBIT_PASSWORD not set")
    )
  };

  const host = process.env.RABBIT_HOST ?? panic("RABBIT_HOST not set");
  const port = process.env.RABBIT_PORT ?? panic("RABBIT_PORT not set");
  const connection = await amqp.connect(`amqp://${host}:${port}`, opt);

  const channel = await connection.createChannel();

  return new AmqpSocket(config, channel, routingKeyStore);
}
