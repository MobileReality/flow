/* eslint-disable func-style */
// @ts-expect-error
import { send as grpcSend } from '@onflow/transport-grpc';
import * as grpc from '@grpc/grpc-js';
import assert from 'node:assert';
import { isArray, isString } from 'lodash';
import LRU from 'lru-cache';

function getErrorStackString(error: Error): string {
    return error.stack?.split('\n').slice(1).join('\n') ?? '<>';
}
function callErrorFromStatus(error: any, callerStack: string, node: string): Error {
    const stringError = isString(error);
    const stack = stringError ? callerStack : `${error.stack}\nfor call at\n${callerStack}`;
    return Object.assign(stringError ? new Error(error) : error, { stack, node });
}

const grpcClients = new LRU({
    max: 500,

    ttl: 15 * 60 * 1000,
    ttlResolution: 10_000,

    allowStale: true,
    updateAgeOnGet: true,
    noDeleteOnStaleGet: true,
});
let roundRobin = 0;

// Patch unary to use proper grpc
export async function send(ix: any, context: any, opts: any = {}) {
    assert(
        opts.node,
        `SDK Send Error: Either opts.node or "accessNode.api" in config must be defined.`,
    );
    assert(context.ix, `SDK Send Error: context.ix must be defined.`);

    let node = opts.node;
    const serviceName = opts.grpcServiceName;
    if (isArray(node)) node = node[roundRobin++ % node.length];
    if (roundRobin > 1000) roundRobin = 0;

    // eslint-disable-next-line unicorn/error-message
    const callerStackError = new Error();
    try {
        if (node.toLowerCase().startsWith('grpc://')) {
            node = node.slice(7);
        }
        if (node.toLowerCase().startsWith('http')) {
            return await grpcSend(ix, context, { ...opts, node });
        }
        return await grpcSend(ix, context, {
            unary: async (host: string, method: any, request: any, context: any) => {
                let grpcClient = grpcClients.get<grpc.Client>(host);
                if (!grpcClient) {
                    grpcClient = new grpc.Client(host, grpc.credentials.createInsecure());
                    grpcClients.set(host, grpcClient);
                }
                // eslint-disable-next-line no-async-promise-executor
                return await new Promise(async (resolve, reject) => {
                    try {
                        const metadataFromConfig = await context.config().get('grpc.metadata', {});
                        grpcClient!.makeUnaryRequest(
                            `/${serviceName ?? method.service.serviceName}/${method.methodName}`,
                            () => Buffer.from(request.serializeBinary()),
                            (value) => {
                                return method.responseType.deserializeBinary(value);
                            },
                            request,
                            grpc.Metadata.fromHttp2Headers(metadataFromConfig),
                            (err, result) => {
                                if (err) {
                                    reject(err);
                                } else {
                                    resolve(result);
                                }
                            },
                        );
                    } catch (err) {
                        reject(err);
                    }
                });
            },
            ...opts,
            node,
        });
    } catch (err) {
        throw callErrorFromStatus(err, getErrorStackString(callerStackError), node);
    }
}
