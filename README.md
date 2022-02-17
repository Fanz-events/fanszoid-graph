# Fanszoid tickets graph

Fanszoid's Marketplace and Tickets Graph, currently on Mumbai testnet:

https://thegraph.com/hosted-service/subgraph/fanszoid/fanszoid-tickets-mumbai (QmeuK8R9kdKoQyrSpnhUqSxS5GyeT7nS5vDRmUvz1meCZv)

## Queries

#### Get first 5 events, their tickets and the organizers

```typescript
{
  events(first: 5) {
    id
    ticketTypes {
      id
    }
    organizer {
      id
    }
  }
}
```

#### Get tickets that a user owns

```typescript
{
    tickets(where:{owner: $owner_address}) {
        id
        amount
    }
}
```

#### Get tickets that a user owns from a subset of ticket Types

```typescript
{
    tickets(where:{owner: $owner_address, ticketType_in: $ticketTypes}) {
        id
        amount
    }
}
```