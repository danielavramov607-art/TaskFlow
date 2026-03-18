import { ApolloClient, InMemoryCache, HttpLink, split } from "@apollo/client";
import { getMainDefinition } from "@apollo/client/utilities";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { createClient } from "graphql-ws";

const BACKEND_HTTP = process.env.REACT_APP_BACKEND_URL || "http://localhost:4000";
const BACKEND_WS = process.env.REACT_APP_BACKEND_WS_URL || "ws://localhost:4000";

const httpLink = new HttpLink({
  uri: `${BACKEND_HTTP}/graphql`,
  fetch: (uri, options: any) => {
    const token = sessionStorage.getItem("token");
    if (token) {
      options.headers = { ...options.headers, authorization: `Bearer ${token}` };
    }
    return fetch(uri, options);
  },
});

const wsLink = new GraphQLWsLink(
  createClient({
    url: `${BACKEND_WS}/graphql`,
    connectionParams: () => ({
      authorization: sessionStorage.getItem("token") ? `Bearer ${sessionStorage.getItem("token")}` : "",
    }),
    on: {
      connected: () => console.log("WS connected"),
      error: (err) => console.error("WS error", err),
      closed: (e) => console.log("WS closed", e),
    },
  })
);

const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return definition.kind === "OperationDefinition" && definition.operation === "subscription";
  },
  wsLink,
  httpLink
);

export const client = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache(),
});
