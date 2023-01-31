## Summary

This `fcl` connector is a wrapper around `@onflow/transport-grpc` which uses real gRPC via `@grpc/grpc-js`, not gRPC-web as the original.
Original transport has problems communicating with regular gRPC endpoints.

If the node url starts with `http(s)://` it will fall back to using `@onflow/transport-grpc`

## Status
This package is working and in active development, breaking changes may happen.

## Usage

### Install

```bash
npm install --save @mobile-reality/flow-transport-real-grpc
```

### Integration with FCL

```javascript
import { config } from "@onflow/fcl"
import { send as sendGrpc } from "@mobile-reality/flow-transport-real-grpc"

config({
  "accessNode.api": "access.mainnet.nodes.onflow.org:9000",
  "sdk.transport": sendGrpc
})
```

### Experimental features

Node can be an array of nodes, in which case it will load balance between nodes using round robin. It recommended to perform loadbalancing yourself or using another library.

If you provide `opts.serviceName` it will override the grpc service namespace in the call, allowing you for example to query execution node gRPC (`'flow.execution.ExecutionAPI'`)

