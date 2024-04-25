# ts-amqp-socket
Provides an adapter to connect simple data-in-data-out handler functions to the
GraphPolaris AMQP-based microservice architecture.

## Example usage
```ts
import { 
  AmqpSocket, 
  AmqpConfig, 
  createRoutingKeyStore, 
  createAmqpSocket 
} from "ts-amqp-socket";

async function main() {
  const amqpConfig: AmqpConfig = {
    queue: {
      request: "exapmle-service-request-queue"
    },
    exchange: {
      request: "requests-exchange",
      response: "ui-direct-exchange"
    },
    routingKey: {
      request: "example-service-request"
    },

    successType: "example_service_result",
    errorType: "example_service_error",

    bodyMapper: (message) => {
      return JSON.parse(message.content.toString()).example.body;
    }
  };

  const routingKeyStore = await createRoutingKeyStore();
  const amqp = await createAmqpSocket(amqpConfig, routingKeyStore);

  amqp.handle("get-posts", getPostsHandler);
  amqp.handle("get-users", getUsersHandler);

  amqp.listen();
}

main()
```


## Handlers
AmqpSocket provides an Express.js-like API revolving around the concept of 
simple data-in-data-out handlers. Each handler receives the selected body of the
message, and returns a response object, or throws an error which is then caught.

This means that your handlers do not depend on anything related to the AMQP
network, and can for example be reused in a HTTP API (see marketplace-backend).

### The `bodyMapper` function
Because the message body might not always be in the same location in the
message, You need to specify a selector function to select and parse the body
inside the message. This function is defined in the `AmqpConfig` for the socket,
for example:

```ts
const config: AmqpConfig = {
  // ...,

  bodyMapper: (message) => {
    return JSON.parse(message.content.toString()).example.body;
  }
}
```

### Routing
In order to route messages to the correct handlers, AmqpSocket expects the
selected body to have an `action` field that corresponds with one of the keys 
your handlers are mapped to. If this field is not present, AmqpSocket will default
to the handler mapped to `"__default"`, if it exists.

All queue and exchange names required to set up the AMQP wiring for the service
are found in the 

As of now, responses are automatically routed to the frontend using the routing
key fetched from Redis. This behaviour should be encapsulated to make this 
module more general-purpose.

