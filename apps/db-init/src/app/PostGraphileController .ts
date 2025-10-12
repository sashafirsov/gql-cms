import { Controller, Get, Post, Req, Next, Res } from '@nestjs/common';
import { PostGraphileResponseNode } from 'postgraphile';
import { postgraphileMiddleware } from './postgraphile.middleware';
import type { IncomingMessage, ServerResponse } from 'node:http';

type NextFuncType = (e?: ('route' | Error)) => void;

@Controller('/')
export class PostGraphileController {
    @Get(postgraphileMiddleware.graphiqlRoute)
    graphiql(@Req() request: IncomingMessage, @Res() response: ServerResponse, @Next() next: NextFuncType) {
        if (postgraphileMiddleware.graphiqlRouteHandler)
            postgraphileMiddleware.graphiqlRouteHandler(
                new PostGraphileResponseNode(request, response, next)
            );

    }

    @Post(postgraphileMiddleware.graphqlRoute)
    graphql(@Req() request: IncomingMessage, @Res() response: ServerResponse, @Next() next: NextFuncType) {
        postgraphileMiddleware.graphqlRouteHandler(
            new PostGraphileResponseNode(request, response, next)
        );
    }
}
